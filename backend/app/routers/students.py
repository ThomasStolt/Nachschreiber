# backend/app/routers/students.py
from fastapi import APIRouter, HTTPException
from ..models import Student
from ..session import load, save

router = APIRouter(prefix="/api", tags=["students"])


@router.get("/classes")
def get_classes() -> list[str]:
    session = load()
    return sorted({s.class_name for s in session.students})


@router.get("/students")
def get_students(class_name: str | None = None) -> list[Student]:
    session = load()
    if class_name:
        return [s for s in session.students if s.class_name == class_name]
    return session.students


@router.delete("/students/{student_id}", status_code=204)
def delete_student(student_id: str) -> None:
    session = load()
    before = len(session.students)
    session.students = [s for s in session.students if s.id != student_id]
    if len(session.students) == before:
        raise HTTPException(404, "Schüler nicht gefunden")
    session.entries = [e for e in session.entries if e.student_id != student_id]
    save(session)
