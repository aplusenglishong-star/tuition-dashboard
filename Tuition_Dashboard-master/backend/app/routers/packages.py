from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date, datetime, timedelta
import io
import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill

from fastapi.responses import StreamingResponse
from ..services.scheduler import load_closure_dates
from ..schemas import LessonEditPayload

from ..db import get_db
from .. import models, schemas, crud

DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

router = APIRouter(prefix="/packages", tags=["Packages"])
extra_router = APIRouter(tags=["Packages"])

class CreateFromPreviewPayload(BaseModel):
    lesson_dates: List[date]

class MakeupPayload(BaseModel):
    lesson_date: date
    
FILL_ATTENDED = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
FILL_LEAVE = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
FILL_MU = PatternFill(start_color="EAD1DC", end_color="EAD1DC", fill_type="solid")

# =========================================================
# PAYMENT
# =========================================================
@extra_router.post("/students/packages/{package_id}/mark_paid")
def mark_paid(package_id: int, db: Session = Depends(get_db)):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")
    pkg = crud.toggle_payment(db, pkg, True)
    return {"status": "ok", "payment_status": pkg.payment_status}


@extra_router.post("/students/packages/{package_id}/mark_unpaid")
def mark_unpaid(package_id: int, db: Session = Depends(get_db)):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")
    pkg = crud.toggle_payment(db, pkg, False)
    return {"status": "ok", "payment_status": pkg.payment_status}


# =========================================================
# CREATE PACKAGE FROM FUTURE PREVIEW
# =========================================================
@extra_router.post(
    "/students/packages/{package_id}/create_from_preview",
    response_model=schemas.PackageOut
)
def create_package_from_preview(
    package_id: int,
    payload: CreateFromPreviewPayload,
    mark_paid: bool = Query(False),
    db: Session = Depends(get_db),
):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")

    student = pkg.student
    if not student:
        raise HTTPException(404, "Student not found")

    # ✅ use preview dates directly
    dates = payload.lesson_dates[:pkg.package_size]

    if not dates:
        raise HTTPException(400, "No preview dates")

    # optional safety: check end_date
    if student.end_date and dates[0] > student.end_date:
        raise HTTPException(400, "Preview dates exceed student's end date")

    # create new package
    new_pkg = models.Package(
        student_id=student.student_id,
        package_size=pkg.package_size,
        payment_status=bool(mark_paid),
    )
    db.add(new_pkg)
    db.flush()

    # create lessons EXACTLY as previewed
    for i, d in enumerate(dates, start=1):
        db.add(models.Lesson(
            package_id=new_pkg.package_id,
            lesson_number=i,
            lesson_date=d,
            is_first=(i == 1),
            is_manual_override=False,
        ))

    new_pkg.first_lesson_date = dates[0]

    # ✅ THIS WAS MISSING
    db.commit()
    db.refresh(new_pkg)

    return new_pkg

# =========================================================
# REGENERATE (POST)
# =========================================================
@extra_router.post("/students/packages/{package_id}/regenerate")
def regenerate_lessons(package_id: int, db: Session = Depends(get_db)):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    crud.regenerate_package(db, pkg)
    return {"status": "ok", "package_id": package_id}


@router.post("/students/packages/{package_id}/regenerate")
def regenerate_lessons(package_id: int, db: Session = Depends(get_db)):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    crud.regenerate_package(db, pkg)
    return {"status": "ok", "package_id": package_id}

# =========================================================
# REGENERATE PREVIEW (GET)
# =========================================================
@extra_router.get("/students/packages/{package_id}/regenerate")
def regenerate_preview(
    package_id: int,
    preview: bool = Query(True),
    extend: bool = Query(False),
    db: Session = Depends(get_db),
):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")

    from ..services.scheduler import generate_lessons_for_package

    student = pkg.student
    if not student:
        raise HTTPException(404, "Student not found")

    # =====================================================
    # SINGLE PACKAGE PREVIEW (Regenerate button)
    # =====================================================
    if not extend:
        # ALWAYS define prev_pkg
        prev_pkg = (
            db.query(models.Package)
            .filter(
                models.Package.student_id == student.student_id,
                models.Package.package_id < pkg.package_id
            )
            .order_by(models.Package.package_id.desc())
            .first()
        )

        if prev_pkg and prev_pkg.lessons:
            last_prev_date = max(
                l.lesson_date for l in prev_pkg.lessons if l.lesson_date
            )
            start_from = last_prev_date + timedelta(days=1)
        else:
            start_from = student.start_date

        # Collect manual overrides
        manual_overrides = {}
        if pkg.lessons:
            for l in pkg.lessons:
                if l.is_manual_override:
                    manual_overrides[l.lesson_number] = l

        proposed = generate_lessons_for_package(
            db,
            student,
            pkg,
            override_existing=False,
            start_from=start_from,
            manual_overrides=manual_overrides
        ) or []

        out = []
        for idx, l in enumerate(proposed, start=1):
            out.append({
                "lesson_number": idx,
                "lesson_date": l.lesson_date.isoformat(),
                "is_manual_override": getattr(l, "is_manual_override", False),
                "is_first": (idx == 1),
            })

        return {
            "preview": True,
            "package_id": pkg.package_id,
            "proposed_lessons": out,
        }

    # =====================================================
    # EXTENDED PREVIEW (Show Future)
    # =====================================================
    flat: List[Dict] = []

    last_date = max(
        [l.lesson_date for l in pkg.lessons if l.lesson_date],
        default=student.start_date
    )
    cursor = last_date + timedelta(days=1)
    end_cutoff = student.end_date or cursor + timedelta(days=365 * 2)

    while cursor <= end_cutoff:
        block = generate_lessons_for_package(
            db,
            student,
            pkg,
            start_from=cursor
        )
        if not block:
            break

        for idx, l in enumerate(block, start=1):
            flat.append({
                "lesson_number": idx,
                "lesson_date": l.lesson_date.isoformat(),
                "is_manual_override": False,
                "is_first": (idx == 1),
            })

        cursor = block[-1].lesson_date + timedelta(days=1)

    
        # Sort explicitly
        flat.sort(key=lambda x: date.fromisoformat(x["lesson_date"]))

        return {
        "preview": True,
        "package_id": pkg.package_id,
        "proposed_lessons": flat,
    }
    
# =========================================================
# EDIT LESSON
# =========================================================
@extra_router.patch("/lessons/{lesson_id}/status")
def update_lesson_status(
    lesson_id: int,
    payload: schemas.LessonStatusUpdate,
    db: Session = Depends(get_db),
):
    lesson = db.query(models.Lesson).filter(
        models.Lesson.lesson_id == lesson_id
    ).first()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # ✅ Update status only
    lesson.status = payload.status
    if payload.remark is not None:
        lesson.remark = payload.remark

    db.commit()
    db.refresh(lesson)

    return {
        "lesson_id": lesson.lesson_id,
        "lesson_date": lesson.lesson_date,
        "status": lesson.status,
        "is_makeup": lesson.is_makeup,
        "remark": lesson.remark,
    }
    
# =========================================================
# EXPORT DASHBOARD (UNCHANGED CORE LOGIC)
# =========================================================
@extra_router.get("/export/dashboard.xlsx")
def export_dashboard_xlsx(
    tab: str = Query("all"),   # all | 4 | 8
    group: str = Query(""),
    day: str = Query(""),
    db: Session = Depends(get_db)
):
    # determine how many lesson columns to export
    max_lessons = 4 if tab == "4" else 8

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Dashboard"

    header = ["Name", "CEFR", "Group", "Lesson Day", "Package Size"]
    for i in range(1, max_lessons + 1):
        header.append(f"L{i}")
    header.append("Paid")

    ws.append(header)

    students = db.query(models.Student).order_by(models.Student.name).all()

    for s in students:
        first_row_for_student = True

        for pkg in s.packages or []:
            # tab filter
            if tab == "4" and pkg.package_size != 4:
                continue
            if tab == "8" and pkg.package_size != 8:
                continue

            regular_lessons = [l for l in pkg.lessons if not l.is_makeup]
            makeup_lessons = [l for l in pkg.lessons if l.is_makeup]

            regular_map = {
                l.lesson_number: l.lesson_date.isoformat()
                for l in regular_lessons
            }

            row = [
                s.name if first_row_for_student else "",
                s.cefr or "" if first_row_for_student else "",
                s.group_name or "" if first_row_for_student else "",
                DAY_LABELS[s.lesson_day_1] if first_row_for_student else "",
                pkg.package_size if first_row_for_student else "",
            ]

            for i in range(1, max_lessons + 1):
                row.append("")

            row.append("Paid" if pkg.payment_status else "Unpaid")
            ws.append(row)
            current_row = ws.max_row 
            for i in range(1, max_lessons + 1):
                lesson = next((l for l in regular_lessons if l.lesson_number == i), None)
                format_lesson_cell(ws, current_row, 5 + i, lesson)
            first_row_for_student = False
            
            if makeup_lessons:
                mu_row = ["", "", "", "", "MU"]
                for _ in range(max_lessons):
                    mu_row.append("")
                mu_row.append("")
                ws.append(mu_row)

                mu_row_idx = ws.max_row

                for idx, lesson in enumerate(makeup_lessons):
                    col = 6 + idx
                    format_lesson_cell(ws, mu_row_idx, col, lesson)


    # ✅ SAVE & RETURN — OUTSIDE ALL LOOPS
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = (
        "dashboard_all.xlsx" if tab == "all"
        else f"dashboard_{tab}_lesson.xlsx"
    )

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
def format_lesson_cell(ws, row_idx, col_idx, lesson):
    if not lesson:
        return

    text = lesson.lesson_date.isoformat()

    if lesson.is_makeup:
        text += " (MU)"
        ws.cell(row=row_idx, column=col_idx).fill = FILL_MU

    if lesson.status == "leave":
        text += " (L)"
        ws.cell(row=row_idx, column=col_idx).fill = FILL_LEAVE

    if lesson.status == "attended":
        text += " ✓"
        ws.cell(row=row_idx, column=col_idx).fill = FILL_ATTENDED

    ws.cell(row=row_idx, column=col_idx).value = text
        
@extra_router.delete("/students/packages/{package_id}")
def delete_package(package_id: int, db: Session = Depends(get_db)):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")

    # Optional safety: block deletion if paid
    # if pkg.payment_status:
    #     raise HTTPException(400, "Cannot delete a paid package")

    # Delete lessons first (safe)
    db.query(models.Lesson).filter(
        models.Lesson.package_id == pkg.package_id
    ).delete(synchronize_session=False)

    db.delete(pkg)
    db.commit()

    return {"status": "deleted", "package_id": package_id}

@extra_router.post("/students/packages/{package_id}/add_makeup")
def add_makeup_lesson(
    package_id: int,
    payload: MakeupPayload,
    db: Session = Depends(get_db)
):
    pkg = crud.get_package(db, package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")

    student = pkg.student
    if not student:
        raise HTTPException(404, "Student not found")

    makeup_date = payload.lesson_date

    # 1️⃣ check closure
    blocked = load_closure_dates(db)
    if makeup_date in blocked:
        raise HTTPException(400, "Selected date is a closure")

    # 2️⃣ check duplicate date for this student
    existing = (
        db.query(models.Lesson)
        .join(models.Package)
        .filter(
            models.Package.student_id == student.student_id,
            models.Lesson.lesson_date == makeup_date
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Student already has a lesson on this date"
        )
        
    # 3️⃣ add lesson (append to package)
    new_lesson = models.Lesson(
        package_id=pkg.package_id,
        lesson_number=len(pkg.lessons) + 1,
        lesson_date=makeup_date,
        status="scheduled",
        is_makeup=True,
        is_manual_override=True,
        is_first=False,
    )

    db.add(new_lesson)
    db.commit()

    return {
        "status": "ok",
        "lesson_date": makeup_date.isoformat()
    }
    
    
@extra_router.patch("/lessons/{lesson_id}", response_model=schemas.LessonOut)
def edit_lesson(
    lesson_id: int,
    payload: LessonEditPayload,
    db: Session = Depends(get_db)
):
    lesson = db.query(models.Lesson).filter_by(lesson_id=lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    student = lesson.package.student

    # -------------------------------
    # 🚫 BLOCK make-up on regular days
    # -------------------------------
    if payload.is_makeup is True and payload.lesson_date is not None:
        weekday = payload.lesson_date.weekday()

        regular_days = {student.lesson_day_1}
        if student.lesson_day_2 is not None:
            regular_days.add(student.lesson_day_2)

        if weekday in regular_days:
            raise HTTPException(
                status_code=400,
                detail="Make-up cannot be scheduled on regular lesson days"
            )
            
    lesson = db.query(models.Lesson).filter_by(lesson_id=lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    student = lesson.package.student

    # 🚫 BLOCK duplicate lesson date for the same student
    if payload.lesson_date is not None:
        conflict = (
            db.query(models.Lesson)
            .join(models.Package)
            .filter(
                models.Package.student_id == student.student_id,
                models.Lesson.lesson_date == payload.lesson_date,
                models.Lesson.lesson_id != lesson.lesson_id,  # 👈 exclude self
            )
            .first()
        )

        if conflict:
            raise HTTPException(
                status_code=400,
                detail="Student already has a lesson on this date"
            )


    # ---------------------------------------
    # APPLY UPDATES (NO BLOCKING HERE)
    # ---------------------------------------
    if payload.lesson_date is not None:
        lesson.lesson_date = payload.lesson_date

    if payload.status is not None:
        lesson.status = payload.status

    if payload.is_makeup is not None:
        lesson.is_makeup = payload.is_makeup
        lesson.is_manual_override = payload.is_makeup

    if payload.is_manual_override is not None:
        lesson.is_manual_override = payload.is_manual_override

    if payload.remark is not None:
        lesson.remark = payload.remark

    db.commit()
    db.refresh(lesson)
    return lesson

@extra_router.delete("/lessons/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db)
):
    lesson = db.query(models.Lesson).filter(
        models.Lesson.lesson_id == lesson_id
    ).first()

    if not lesson:
        raise HTTPException(404, "Lesson not found")

    if not lesson.is_makeup:
        raise HTTPException(
            status_code=400,
            detail="Only make-up lessons can be deleted individually"
        )

    db.delete(lesson)
    db.commit()

    return {"status": "deleted", "lesson_id": lesson_id}
