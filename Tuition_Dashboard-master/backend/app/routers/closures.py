# backend/app/routers/closures.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from ..db import get_db
from .. import models

from pydantic import BaseModel

router = APIRouter(prefix="/closures", tags=["Closures"])


# Pydantic schemas local to this router (simple and usable for now)
class ClosureIn(BaseModel):
    start_date: date
    end_date: date
    reason: Optional[str] = None
    type: Optional[str] = None


class ClosureOut(ClosureIn):
    id: int

    class Config:
        from_attributes = True


@router.post("/", response_model=ClosureOut)
def create_closure(payload: ClosureIn, db: Session = Depends(get_db)):
    # Basic validation: start <= end
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")

    c = models.Closure(
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        type=payload.type
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    # models.Closure uses column name closure_id for primary key; map to "id" in output
    return ClosureOut(id=c.id, start_date=c.start_date, end_date=c.end_date, reason=c.reason, type=c.type)


@router.get("/", response_model=List[ClosureOut])
def list_closures(db: Session = Depends(get_db)):
    rows = db.query(models.Closure).order_by(models.Closure.start_date).all()
    # map model to response schema
    results = [ClosureOut(
        id=r.id,
        start_date=r.start_date,
        end_date=r.end_date,
        reason=r.reason,
        type=r.type
    ) for r in rows]
    return results


@router.delete("/{closure_id}")
def delete_closure(closure_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Closure).filter(models.Closure.id == closure_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Closure not found")
    db.delete(c)
    db.commit()
    return {"status": "ok", "id": closure_id}

@router.patch("/{closure_id}", response_model=ClosureOut)
def update_closure(closure_id: int, payload: ClosureIn, db: Session = Depends(get_db)):
    """
    Update an existing closure.
    Allows modifying start_date, end_date, reason, and type.
    Full replace semantics (same fields as create). You can change this to partial if you prefer.
    """
    c = db.query(models.Closure).filter(models.Closure.id == closure_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Closure not found")

    # Validate
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")

    # Update fields
    c.start_date = payload.start_date
    c.end_date = payload.end_date
    c.reason = payload.reason
    c.type = payload.type

    db.commit()
    db.refresh(c)

    return ClosureOut(id=c.id, start_date=c.start_date, end_date=c.end_date, reason=c.reason, type=c.type)
