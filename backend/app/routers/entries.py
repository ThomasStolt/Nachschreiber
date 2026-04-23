# backend/app/routers/entries.py
import uuid
from fastapi import APIRouter, HTTPException
from ..models import Entry, EntryCreate, SeatUpdate
from ..session import load, save
from ..seating import assign_room, next_free_seat

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
    try:
        desk, seat = next_free_seat(session.entries, room)
    except ValueError as e:
        raise HTTPException(422, str(e))

    entry = Entry(id=str(uuid.uuid4()), room=room, desk=desk, seat=seat, **body.model_dump())
    session.entries.append(entry)
    save(session)
    return entry


@router.patch("/{entry_id}/seat")
def move_entry(entry_id: str, body: SeatUpdate) -> list[Entry]:
    session = load()

    entry = next((e for e in session.entries if e.id == entry_id), None)
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")

    target = next(
        (e for e in session.entries
         if e.room == body.room and e.desk == body.desk and e.seat == body.seat and e.id != entry_id),
        None,
    )

    if target and target.room != entry.room:
        raise HTTPException(409, "Zielplatz in anderem Raum ist bereits belegt")

    updated: list[Entry] = []
    if target:
        # Swap: target gets entry's current position
        target.room = entry.room
        target.desk = entry.desk
        target.seat = entry.seat
        updated.append(target)

    entry.room = body.room
    entry.desk = body.desk
    entry.seat = body.seat
    updated.append(entry)

    save(session)
    return updated


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: str) -> None:
    session = load()
    before = len(session.entries)
    session.entries = [e for e in session.entries if e.id != entry_id]
    if len(session.entries) == before:
        raise HTTPException(404, "Eintrag nicht gefunden")
    save(session)
