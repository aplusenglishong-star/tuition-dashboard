# backend/app/db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from urllib.parse import urlparse, parse_qs
from .config import settings

DATABASE_URL = settings.DATABASE_URL

def _should_use_ssl(url: str) -> bool:
    try:
        parsed = urlparse(url)
        q = parse_qs(parsed.query or "")
        if "sslmode" in q and any(v and v[0].lower() == "require" for v in q.values()):
            return True
        host = (parsed.hostname or "").lower()
        if "supabase.co" in host or "neon.tech" in host or "neon.aws" in host or "railway" in host:
            return True
    except Exception:
        pass
    return False

_connect_args = {}
if _should_use_ssl(DATABASE_URL):
    _connect_args = {"sslmode": "require"}

# ALWAYS pass a dict (empty or with sslmode) — do NOT pass None
engine = create_engine(
    DATABASE_URL,
    echo=settings.DEBUG,
    future=True,

    # ✅ REQUIRED for Neon + Render
    pool_pre_ping=True,     # detect dead connections
    pool_recycle=1800,      # recycle every 30 minutes
    pool_size=5,            # safe default for Render
    max_overflow=10,
    pool_timeout=30,

    connect_args=_connect_args,
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True
)
Base = declarative_base(metadata=None)
Base.metadata.schema = "public"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
