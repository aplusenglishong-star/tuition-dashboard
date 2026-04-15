# backend/app/routers/students.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Any

from .. import crud, schemas, models
from ..db import get_db
from ..date_utils import parse_iso_date, ensure_end_after_start

router = APIRouter(prefix="/students", tags=["students"])

# ... other endpoints (GET / POST etc.)
@router.post("/", response_model=schemas.StudentOut)
def create_student(payload: schemas.StudentCreate, db: Session = Depends(get_db)):
    student = crud.create_student(db, payload)
    return student

@router.get("", response_model=list[schemas.StudentOut])
@router.get("/", response_model=list[schemas.StudentOut])
def list_students(db: Session = Depends(get_db)):
    return crud.get_all_students(db)

@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = crud.get_student(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    # optional: delete cascade packages/lessons (your models may already cascade)
    db.delete(student)
    db.commit()
    return {"status": "ok", "student_id": student_id}

@router.patch("/{student_id}", response_model=schemas.StudentOut)
def update_student(student_id: int, payload: schemas.StudentUpdate, db: Session = Depends(get_db)):
    student = crud.get_student(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # apply updates
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(student, k, v)

    db.commit()
    db.refresh(student)

    # 🔴 IMPORTANT: re-fetch after prune / commit side-effects
    return crud.get_student(db, student_id)


    # if end_date was present in payload (explicitly changed), prune packages
    if hasattr(payload, "end_date"):
        try:
            from ..crud import prune_packages_to_end_date
            prune_result = prune_packages_to_end_date(db, student, student.end_date)
            # Log the prune result - you can return this to the frontend if you want
            print("Prune result:", prune_result)
        except Exception as e:
            # log and continue (do not fail PATCH because of pruning)
            print("Error pruning packages after end_date update:", e)
