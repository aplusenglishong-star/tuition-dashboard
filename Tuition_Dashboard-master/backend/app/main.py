from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.packages import extra_router
from .db import Base, engine
from .routers import students, packages, closures, teacher_leave
from .routers.closures import router as closures_router
from app.db import Base, engine
from app import models

# Create DB tables (DEV ONLY — disable in production, use Alembic instead)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tuition Lesson Dashboard API", redirect_slashes=False)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"   # optional — allow all during dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # or ["*"] for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("DEBUG: CORS middleware installed with allow_origins=['*']")
# --------------------------------------------------------
# ROUTES
# --------------------------------------------------------
app.include_router(students.router)
app.include_router(packages.router)
app.include_router(extra_router)
app.include_router(closures.router)
app.include_router(closures_router)
app.include_router(teacher_leave.router)

# --------------------------------------------------------
# ROOT ENDPOINT (for testing)
# --------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Backend is running!"}
