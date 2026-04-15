# backend/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # DB URL used by SQLAlchemy. Adjust if you used a different DB name.
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@db:5432/tuition"

    # Redis for Celery/background tasks
    REDIS_URL: str = "redis://redis:6379/0"

    # App options (used by db.py and elsewhere)
    DEBUG: bool = True
    SECRET_KEY: str = "change-me"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
