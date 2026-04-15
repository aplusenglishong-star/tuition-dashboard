# backend/app/services/scheduler.py
from datetime import date, timedelta
from typing import List, Set
from sqlalchemy.orm import Session
from types import SimpleNamespace

from ..models import Closure, Student, Package, Lesson

# ---------------------------------------------------------
# Helper: iterate date range
# ---------------------------------------------------------
def _daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)

# ---------------------------------------------------------
# Load blocked closure dates
# ---------------------------------------------------------
def load_closure_dates(db: Session) -> Set[date]:
    blocked = set()
    closures = db.query(Closure).all()
    for c in closures:
        for d in _daterange(c.start_date, c.end_date):
            blocked.add(d)
    return blocked

# ---------------------------------------------------------
# Produce valid lesson dates
# ---------------------------------------------------------
def collect_valid_dates(
    start_from: date,
    days_of_week: List[int],
    package_size: int,
    blocked: Set[date],
    end_date: date | None
) -> List[date]:

    results: List[date] = []
    cur = start_from

    # safety cutoff = 2 years
    cutoff = start_from + timedelta(days=365 * 2)
    if end_date and end_date < cutoff:
        cutoff = end_date

    while len(results) < package_size and cur <= cutoff:
        if cur.weekday() in days_of_week and cur not in blocked:
            results.append(cur)
        cur += timedelta(days=1)

    return results

# ---------------------------------------------------------
# MAIN FUNCTION: generate lessons
# ---------------------------------------------------------
def generate_lessons_for_package(
    db: Session,
    student: Student,
    pkg: Package,
    override_existing: bool = False,
    start_from: date | None = None,
    manual_overrides: dict | None = None
):
    """
    Final clean generator.
    Produces up to pkg.package_size lessons OR until student.end_date.
    Respects manual_overrides ({lesson_number: LessonObject}) to preserve dates/status.
    """

    blocked = load_closure_dates(db)
    manual_overrides = manual_overrides or {}

    # Determine weekdays
    if pkg.package_size == 8 and student.lesson_day_2 is not None:
        days = sorted({student.lesson_day_1, student.lesson_day_2})
    else:
        days = [student.lesson_day_1]

    # Determine starting date
    start_date = start_from or student.start_date
    if start_date is None:
        start_date = date.today()

    end_date = student.end_date   # may be None → fallback to 2-year safety below
    pkg_size = int(pkg.package_size)

    # Build lesson objects directly
    lessons = []
    
    cur = start_date
    limit = start_date + timedelta(days=365 * 2)
    if end_date and end_date < limit:
        limit = end_date

    count = 0       # lessons generated so far
    lesson_num = 1  # current lesson number targeting

    while count < pkg_size and cur <= limit:
        # 1. Check if this lesson number involves a manual override
        if lesson_num in manual_overrides:
            existing = manual_overrides[lesson_num]
            user_date = existing.lesson_date
            
            # Use preserved lesson
            lessons.append(
                SimpleNamespace(
                    lesson_date=user_date,
                    lesson_number=lesson_num,
                    is_manual_override=True,
                    is_first=(lesson_num == 1),
                    status=getattr(existing, "status", "scheduled"),
                    is_makeup=getattr(existing, "is_makeup", False)
                )
            )
            
            # Update cursor to avoid date collision if users put dates wildly
            # We assume subsequent lessons should naturally happen *after* this one
            # if possible.
            if user_date >= cur:
                cur = user_date + timedelta(days=1)

            count += 1
            lesson_num += 1
            continue

        # 2. No override: find next valid date
        if cur.weekday() in days and cur not in blocked:
            lessons.append(
                SimpleNamespace(
                    lesson_date=cur,
                    lesson_number=lesson_num,
                    is_manual_override=False,
                    is_first=(lesson_num == 1),
                    status="scheduled",
                    is_makeup=False
                )
            )
            count += 1
            lesson_num += 1
        
        # Advance day
        cur += timedelta(days=1)

    return lessons

# ---------------------------------------------------------
# NEW: Append a single lesson (Teacher Leave Logic)
# ---------------------------------------------------------
def append_opt_in_lesson(
    db: Session,
    student: Student,
    pkg: Package,
    start_from: date
) -> Lesson:
    """
    Finds the NEXT valid date starting from `start_from` (inclusive)
    that respects closures and student schedule.
    Creates and returns a new Lesson object (NOT saved to DB yet).
    """
    blocked = load_closure_dates(db)
    
    if pkg.package_size == 8 and student.lesson_day_2 is not None:
        days = sorted({student.lesson_day_1, student.lesson_day_2})
    else:
        days = [student.lesson_day_1]

    cur = start_from
    limit = cur + timedelta(days=365) # safety

    while cur <= limit:
        if cur.weekday() in days and cur not in blocked:
            # Check for ANY existing lesson on this date to be safe
            # (Though caller should likely ensure start_from is after last lesson)
            existing = (
                db.query(Lesson)
                .join(Package)
                .filter(Package.student_id == student.student_id)
                .filter(Lesson.lesson_date == cur)
                .first()
            )
            if not existing:
                # Found a slot!
                # Note: We don't set lesson_number here, caller must determine it.
                return Lesson(
                    package_id=pkg.package_id,
                    lesson_date=cur,
                    status="scheduled",
                    is_makeup=False,
                    is_manual_override=False, 
                    is_first=False
                )
        
        cur += timedelta(days=1)
    
    return None
