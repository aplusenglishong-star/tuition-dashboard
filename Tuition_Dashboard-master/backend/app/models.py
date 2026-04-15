# backend/app/models.py
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from .db import Base
from datetime import datetime

class Student(Base):
    __tablename__ = "students"

    student_id = Column("student_id", Integer, primary_key=True, index=True)
    name = Column("name", String, nullable=False)
    cefr = Column("CEFR", String, nullable=True)           # keeps the header case you asked
    group_name = Column("group", String, nullable=True)    # "group" as requested
    # 0=Mon, 1=Tue, ..., 6=Sun
    lesson_day_1 = Column("lesson_day_1", Integer, nullable=False)
    lesson_day_2 = Column("lesson_day_2", Integer, nullable=True)

    package_size = Column("package_size", Integer, nullable=False)  # 4 or 8
    start_date = Column("start_date", Date, nullable=False)
    end_date = Column("end_date", Date, nullable=True)

    status = Column("status", String, default="active")

    packages = relationship("Package", back_populates="student", cascade="all, delete-orphan", passive_deletes=True)


class Package(Base):
    __tablename__ = "packages"

    package_id = Column("package_id", Integer, primary_key=True, index=True)
    student_id = Column("student_id", Integer, ForeignKey("students.student_id"), nullable=False)

    package_size = Column("package_size", Integer, nullable=False)  # 4 or 8
    # Optional: you asked for first_lesson_date in the desired model — keep created_at too
    first_lesson_date = Column("first_lesson_date", Date, nullable=True)
    payment_status = Column("payment_status", Boolean, default=False)

    created_at = Column("created_at", DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="packages")
    lessons = relationship(
        "Lesson",
        back_populates="package",
        cascade="all, delete-orphan",   # ✅ REQUIRED
        passive_deletes=True,           # ✅ REQUIRED
        lazy="selectin",
        order_by="Lesson.lesson_number"
    )

class Lesson(Base):
    __tablename__ = "lessons"

    lesson_id = Column("lesson_id", Integer, primary_key=True, index=True)
    package_id = Column(
        "package_id",
        Integer,
        ForeignKey("packages.package_id", ondelete="CASCADE"),
        nullable=False
    )

    lesson_number = Column("lesson_number", Integer, nullable=False)
    lesson_date = Column("lesson_date", Date, nullable=False)

    is_first = Column("is_first", Boolean, default=False)
    is_manual_override = Column("is_manual_override", Boolean, default=False)

    # ✅ NEW — STEP 1
    status = Column(String, default="scheduled")
    is_makeup = Column(Boolean, default=False)
    remark = Column(String, nullable=True)

    package = relationship("Package", back_populates="lessons")

    __table_args__ = (
        UniqueConstraint(
            'package_id',
            'lesson_number',
            name='unique_lesson_per_package'
        ),
    )


class Closure(Base):
    __tablename__ = "closures"

    id = Column("closure_id", Integer, primary_key=True, index=True)
    start_date = Column("start_date", Date, nullable=False)
    end_date = Column("end_date", Date, nullable=False)
    reason = Column("reason", String, nullable=True)
    type = Column("type", String, nullable=True)
