# backend/app/schemas.py
from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional, Literal

# --------------------------------------------
# Lesson Schema
# --------------------------------------------
class LessonOut(BaseModel):
    lesson_id: int
    lesson_number: int
    lesson_date: Optional[date]
    is_first: bool
    is_manual_override: bool

    status: Optional[Literal["scheduled", "attended", "leave", "teacher_leave", "remark", "paid_until_here"]] = "scheduled"
    is_makeup: Optional[bool] = False
    remark: Optional[str] = None

    class Config:
        from_attributes = True

class LessonStatusUpdate(BaseModel):
    status: Literal["scheduled", "attended", "leave", "teacher_leave", "remark", "paid_until_here", "cancelled"]
    remark: Optional[str] = None
    
# --------------------------------------------
# Package Schema
# --------------------------------------------
class PackageOut(BaseModel):
    package_id: int
    package_size: int
    payment_status: bool
    first_lesson_date: Optional[date]
    created_at: Optional[datetime]
    lessons: List[LessonOut] = []

    class Config:
        from_attributes = True

# --------------------------------------------
# Student Schema
# --------------------------------------------
class StudentOut(BaseModel):
    student_id: int
    name: str
    cefr: Optional[str]
    group_name: Optional[str]
    lesson_day_1: int
    lesson_day_2: Optional[int]
    package_size: int
    start_date: Optional[date]     
    end_date: Optional[date]
    status: Optional[str] = None
    packages: List[PackageOut] = []

    class Config:
        from_attributes = True

Student = StudentOut
# --------------------------------------------
# Input Schema for Creating Students
# --------------------------------------------
class StudentCreate(BaseModel):
    name: str
    cefr: Optional[str] = None
    group_name: Optional[str] = None
    lesson_day_1: int
    lesson_day_2: Optional[int] = None
    package_size: int
    start_date: date
    end_date: Optional[date] = None  

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    cefr: Optional[str] = None
    group_name: Optional[str] = None
    lesson_day_1: Optional[int] = None
    lesson_day_2: Optional[int] = None
    package_size: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None  
    status: Optional[str] = None
    
class LessonEditPayload(BaseModel):
    lesson_date: Optional[date] = None
    is_manual_override: Optional[bool] = None
    status: Optional[Literal["scheduled", "attended", "leave", "teacher_leave", "remark", "paid_until_here"]] = None
    is_makeup: Optional[bool] = None
    remark: Optional[str] = None