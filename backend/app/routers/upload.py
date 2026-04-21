# backend/app/routers/upload.py
from fastapi import APIRouter, HTTPException, UploadFile, File
from ..parser import parse_students
from ..session import load, save

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload", status_code=200)
async def upload_csv(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    try:
        students = parse_students(content)
    except ValueError as e:
        raise HTTPException(422, str(e))
    session = load()
    session.students = students
    session.entries = []  # reset entries when new master data is loaded
    save(session)
    return {"students": len(students)}
