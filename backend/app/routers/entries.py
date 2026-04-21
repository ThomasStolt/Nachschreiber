# backend/app/routers/entries.py
import uuid
from fastapi import APIRouter, HTTPException
from ..models import Entry, EntryCreate
from ..session import load, save
from ..seating import assign_room

router = APIRouter(prefix="/api/entries", tags=["entries"])


@router.get("")
def get_entries() -> list[Entry]:
    return load().entries


@router.post("", status_code=201)
def create_entry(body: EntryCreate) -> Entry:
    session = load()

    student = next((s for s in session.students if s.id == body.student_id), None)
    if not student:
        raise HTTPException(404, "Schüler nicht gefunden")

    duplicate = any(
        e.student_id == body.student_id
        and e.subject.strip().lower() == body.subject.strip().lower()
        for e in session.entries
    )
    if duplicate:
        raise HTTPException(
            409,
            f"{student.last_name}, {student.first_name} ist bereits für '{body.subject}' eingetragen",
        )

    room = assign_room(body.duration_minutes)
    room_count = sum(1 for e in session.entries if e.room == room)
    if room_count >= 32:
        raise HTTPException(422, f"Raum {room} ist voll (32/32 Plätze belegt)")

    entry = Entry(id=str(uuid.uuid4()), room=room, **body.model_dump())
    session.entries.append(entry)
    save(session)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: str) -> None:
    session = load()
    before = len(session.entries)
    session.entries = [e for e in session.entries if e.id != entry_id]
    if len(session.entries) == before:
        raise HTTPException(404, "Eintrag nicht gefunden")
    save(session)
