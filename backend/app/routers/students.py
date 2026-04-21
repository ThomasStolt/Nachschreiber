# backend/app/routers/students.py
from fastapi import APIRouter
from ..models import Student
from ..session import load

router = APIRouter(prefix="/api", tags=["students"])


@router.get("/students")
def get_students(class_name: str | None = None) -> list[Student]:
    session = load()
    if class_name:
        return [s for s in session.students if s.class_name == class_name]
    return session.students
