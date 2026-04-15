from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List

from ..db import get_db
from .. import models, schemas
from ..services.scheduler import append_opt_in_lesson

router = APIRouter(prefix="/teacher_leave", tags=["Teacher Leave"])

# ---------------------------------------------------------
# PREVIEW: See who is affected
# ---------------------------------------------------------
@router.get("/preview")
def preview_teacher_leave(
    date: date,
    db: Session = Depends(get_db)
):
    """
    Returns a list of students/packages that have a scheduled lesson on this date.
    """
    # Find all lessons on this date
    # Filter by status="scheduled" to only affect active lessons? 
    # Or strict 'all lessons' deletion? Requirement says "Delete all Lesson records".
    # We will target all, but usually only "scheduled" matters for future. 
    # Let's assume we target valid active lessons (scheduled/attended? usually strictly scheduled for future leave).
    # But user requirement says "Remove all Lesson records". Let's stick to safe "scheduled" checks or just all?
    # Context: "when a teacher is absent". Usually implies future dates.
    # If a lesson was already "attended", deleting it might be wrong... 
    # But sticking to the strict requirement: "Deletes all Lesson records matching that leave_date".
    
    lessons = (
        db.query(models.Lesson)
        .filter(models.Lesson.lesson_date == date)
        .join(models.Package)
        .join(models.Student)
        .all()
    )

    results = []
    for l in lessons:
        stu = l.package.student
        results.append({
            "student_id": stu.student_id,
            "student_name": stu.name,
            "package_id": l.package_id,
            "lesson_id": l.lesson_id,
            "current_status": l.status
        })

    return {
        "date": date,
        "affected_count": len(results),
        "affected_items": results
    }


# ---------------------------------------------------------
# EXECUTE: Delete & Append
# ---------------------------------------------------------
@router.post("/execute")
def execute_teacher_leave(
    date: date,
    db: Session = Depends(get_db)
):
    """
    1. Deletes all lessons on `date`.
    2. Appends 1 new lesson to each affected package.
    """
    # 1. Gather all affected lessons
    lessons_to_delete = (
        db.query(models.Lesson)
        .filter(models.Lesson.lesson_date == date)
        .all()
    )

    if not lessons_to_delete:
        return {"status": "no_actions_needed", "message": "No lessons found on this date."}

    # Group by package to handle shifting
    # A package might theoretically have 2 lessons on same day (rare but possible with makeup).
    # We need to append 1 replacement for EACH deleted lesson.
    
    affected_packages = {}
    for l in lessons_to_delete:
        pid = l.package_id
        if pid not in affected_packages:
            affected_packages[pid] = {
                "pkg": l.package,
                "count": 0
            }
        affected_packages[pid]["count"] += 1

    # 2. Process Deletion
    # We delete them now so they don't block the new schedule generation?
    # Or delete after? 
    # If we delete first, `append_opt_in_lesson` won't see them as collision (good).
    
    for l in lessons_to_delete:
        db.delete(l)
    
    # Flush to ensure they are gone from query view for the next step?
    db.flush()

    # 3. Process Append
    replacements_created = 0
    
    for pid, data in affected_packages.items():
        pkg = data["pkg"]
        count_needed = data["count"]
        student = pkg.student
        
        # Determine where to start looking for new slots.
        # It must be AFTER the current last lesson of the package.
        # Re-query lessons because we just deleted some.
        
        # Note: pkg.lessons might be stale due to session cache, better to re-fetch or trust DB query.
        # Let's query the specific last lesson date from DB.
        
        last_lesson = (
            db.query(models.Lesson)
            .filter(models.Lesson.package_id == pid)
            .order_by(models.Lesson.lesson_date.desc())
            .first()
        )
        
        if last_lesson and last_lesson.lesson_date:
            start_search = last_lesson.lesson_date + timedelta(days=1)
        else:
            # Fallback if package became empty? Start from tomorrow or original date?
            # If we deleted the only lesson, start from the deleted date + 1?
            start_search = date + timedelta(days=1)
            
        # Ensure we don't start in the past if the leave was for today?
        # Actually `start_search` logic above handles it (last lesson + 1).

        current_cursor = start_search

        for _ in range(count_needed):
            # Find next valid slot
            new_lesson = append_opt_in_lesson(db, student, pkg, start_from=current_cursor)
            
            if new_lesson:
                # Assign lesson number. 
                # Since we deleted some, the numbering might be sparse (gapped).
                # We want to append to the end.
                # Max number currently?
                max_num = (
                    db.query(models.Lesson.lesson_number)
                    .filter(models.Lesson.package_id == pid)
                    .order_by(models.Lesson.lesson_number.desc())
                    .first()
                )
                next_num = (max_num[0] + 1) if max_num else 1
                
                new_lesson.lesson_number = next_num
                db.add(new_lesson)
                
                # Update cursor so next iteration (if double lesson deleted) starts after this one
                current_cursor = new_lesson.lesson_date + timedelta(days=1)
                replacements_created += 1

    db.commit()

    return {
        "status": "success",
        "deleted_count": len(lessons_to_delete),
        "appended_count": replacements_created
    }
