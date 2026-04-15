# backend/app/tasks.py
from celery import Celery
from .config import settings
from .db import SessionLocal
from . import models, crud

celery_app = Celery(
    "tuition_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

@celery_app.task
def regenerate_package_task(package_id: int):
    db = SessionLocal()
    try:
        # use package_id field
        pkg = db.query(models.Package).filter(models.Package.package_id == package_id).first()
        if pkg:
            crud.regenerate_package(db, pkg)
    finally:
        db.close()

    return {"status": "ok", "package_id": package_id}
