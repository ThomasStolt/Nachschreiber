# backend/app/routers/upload.py
from fastapi import APIRouter, HTTPException, UploadFile, File
from ..parser import parse_students, parse_teachers, parse_subjects
from ..session import load, save

router = APIRouter(prefix="/api", tags=["upload"])


MAX_UPLOAD_BYTES = 1 * 1024 * 1024  # 1 MB


@router.post("/upload", status_code=200)
async def upload_csv(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Nur CSV-Dateien erlaubt")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Datei zu groß (max 1 MB)")
    try:
        students = parse_students(content)
    except ValueError as e:
        raise HTTPException(422, str(e))
    session = load()
    session.students = students
    session.entries = []  # reset entries when new master data is loaded
    save(session)
    return {"students": len(students)}


@router.post("/upload/teachers", status_code=200)
async def upload_teachers(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    try:
        teachers = parse_teachers(content)
    except ValueError as e:
        raise HTTPException(422, str(e))
    session = load()
    session.teachers = teachers
    save(session)
    return {"teachers": len(teachers)}


@router.post("/upload/subjects", status_code=200)
async def upload_subjects(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    try:
        subjects = parse_subjects(content)
    except ValueError as e:
        raise HTTPException(422, str(e))
    session = load()
    session.subjects = subjects
    save(session)
    return {"subjects": len(subjects)}
