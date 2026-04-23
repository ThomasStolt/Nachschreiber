# Sprint 2 — Sitzplatz-Tausch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow teachers to drag & drop students within a room and use a scissors/clipboard mechanism to move them between rooms, with desk and seat stored persistently in each Entry.

**Architecture:** Backend: `Entry` model gains `desk` + `seat` fields (stored, no longer computed); session migration handles legacy data; new `PATCH /api/entries/{id}/seat` endpoint handles moves and swaps. Frontend: `@dnd-kit/core` for drag within a room; scissors icon sets a clipboard state in `DashboardPage`; an amber clipboard strip persists across room tab switches; clicking paste targets calls the same move API.

**Tech Stack:** FastAPI, Pydantic v2, pytest | React 18, TypeScript, @dnd-kit/core, @dnd-kit/utilities

---

## File Map

```
backend/app/
  models.py          — add desk/seat to Entry; add SeatUpdate model
  session.py         — add _migrate() called before model_validate
  seating.py         — read entry.desk/seat directly instead of computing
  routers/entries.py — update create_entry to store desk/seat; add PATCH /{id}/seat

tests/
  test_seating.py    — update make_entry() helper; update position tests
  test_api.py        — add seat-move tests

frontend/src/
  types.ts                       — add desk/seat to Entry interface
  api.ts                         — add moveEntry()
  pages/DashboardPage.tsx        — clipboard state + handlers
  components/SeatingGrid.tsx     — dnd-kit, scissors icon, paste targets, ClipboardStrip
```

---

## Task 1: Backend — Add `desk`/`seat` to Entry + Migration

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/session.py`
- Modify: `tests/test_seating.py`

- [ ] **Step 1: Update `backend/app/models.py`**

Add `desk` and `seat` to `Entry`, and add `SeatUpdate` for the PATCH endpoint:

```python
# backend/app/models.py
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class Student(BaseModel):
    id: str
    last_name: str
    first_name: str
    class_name: str


class Entry(BaseModel):
    id: str
    student_id: str
    subject: str
    duration_minutes: int = Field(ge=1, le=300)
    aids: str = ""
    teacher: str
    room: Literal["A", "B", "C"]
    desk: int = Field(ge=1, le=16)
    seat: int = Field(ge=1, le=2)


class EntryCreate(BaseModel):
    student_id: str
    subject: str
    duration_minutes: int = Field(ge=1, le=300)
    aids: str = ""
    teacher: str


class SeatUpdate(BaseModel):
    desk: int = Field(ge=1, le=16)
    seat: int = Field(ge=1, le=2)
    room: Literal["A", "B", "C"]


class SeatAssignment(BaseModel):
    desk: int = Field(ge=1, le=16)
    seat: int = Field(ge=1, le=2)
    entry: Entry
    student: Student


class RoomPlan(BaseModel):
    room: Literal["A", "B", "C"]
    label: str
    capacity: int = 32
    assignments: list[SeatAssignment] = []


class SeatingPlan(BaseModel):
    room_a: RoomPlan
    room_b: RoomPlan
    room_c: RoomPlan


class SessionData(BaseModel):
    students: list[Student] = []
    entries: list[Entry] = []
```

- [ ] **Step 2: Update `backend/app/session.py` — add migration**

```python
# backend/app/session.py
import json
import os
from pathlib import Path
from .models import SessionData


def _data_path() -> Path:
    return Path(os.getenv("DATA_DIR", "/data")) / "session.json"


def _migrate(raw: dict) -> dict:
    """Assign desk/seat to legacy entries that lack them."""
    entries = raw.get("entries", [])
    occupied: dict[str, set] = {"A": set(), "B": set(), "C": set()}
    for e in entries:
        if e.get("desk") and e.get("seat"):
            occupied[e.get("room", "A")].add((e["desk"], e["seat"]))
    for e in entries:
        if not e.get("desk") or not e.get("seat"):
            room = e.get("room", "A")
            for i in range(32):
                d, s = (i // 2) + 1, (i % 2) + 1
                if (d, s) not in occupied[room]:
                    e["desk"], e["seat"] = d, s
                    occupied[room].add((d, s))
                    break
    raw["entries"] = entries
    return raw


def load() -> SessionData:
    p = _data_path()
    if not p.exists():
        return SessionData()
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return SessionData.model_validate(_migrate(raw))
    except Exception:
        return SessionData()


def save(session: SessionData) -> None:
    p = _data_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    try:
        tmp.write_text(session.model_dump_json(indent=2), encoding="utf-8")
        tmp.replace(p)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
```

- [ ] **Step 3: Update `tests/test_seating.py` — fix `make_entry` helper**

`Entry` now requires `desk` and `seat`. Update the helper and tests:

```python
# tests/test_seating.py
import pytest
from app.seating import assign_room, compute_seating
from app.models import Student, Entry, SessionData
import uuid


def make_entry(
    room: str,
    subject: str = "Mathe",
    duration: int = 45,
    desk: int = 1,
    seat: int = 1,
) -> Entry:
    return Entry(
        id=str(uuid.uuid4()),
        student_id="s1",
        subject=subject,
        duration_minutes=duration,
        teacher="Fr. Test",
        room=room,  # type: ignore
        desk=desk,
        seat=seat,
    )


def make_student() -> Student:
    return Student(id="s1", last_name="Müller", first_name="Anna", class_name="10a")


class TestAssignRoom:
    def test_room_a_boundary(self):
        assert assign_room(1) == "A"
        assert assign_room(45) == "A"

    def test_room_b_boundary(self):
        assert assign_room(46) == "B"
        assert assign_room(59) == "B"

    def test_room_c_boundary(self):
        assert assign_room(60) == "C"
        assert assign_room(120) == "C"


class TestComputeSeating:
    def test_empty_session(self):
        plan = compute_seating(SessionData())
        assert plan.room_a.assignments == []
        assert plan.room_b.assignments == []
        assert plan.room_c.assignments == []

    def test_reads_stored_desk_seat(self):
        student = make_student()
        entries = [
            make_entry("A", "Mathe", desk=1, seat=1),
            make_entry("A", "Deutsch", desk=1, seat=2),
        ]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        a = plan.room_a.assignments
        assert a[0].desk == 1 and a[0].seat == 1
        assert a[1].desk == 1 and a[1].seat == 2

    def test_reads_non_sequential_desk_seat(self):
        student = make_student()
        entries = [
            make_entry("A", "Mathe", desk=5, seat=2),
            make_entry("A", "Deutsch", desk=3, seat=1),
        ]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        subjects = {a.entry.subject: (a.desk, a.seat) for a in plan.room_a.assignments}
        assert subjects["Mathe"] == (5, 2)
        assert subjects["Deutsch"] == (3, 1)

    def test_room_capacity_label(self):
        plan = compute_seating(SessionData())
        assert plan.room_a.label == "≤ 45 min"
        assert plan.room_b.label == "46–59 min"
        assert plan.room_c.label == "≥ 60 min"

    def test_count_matches_entries(self):
        student = make_student()
        entries = [make_entry("A", f"F{i}", desk=(i // 2) + 1, seat=(i % 2) + 1) for i in range(5)]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        assert len(plan.room_a.assignments) == 5

    def test_entries_stay_in_correct_room(self):
        student = make_student()
        entry_a = make_entry("A", "Mathe", duration=45, desk=1, seat=1)
        entry_b = make_entry("B", "Deutsch", duration=50, desk=1, seat=1)
        entry_c = make_entry("C", "Physik", duration=90, desk=1, seat=1)
        session = SessionData(students=[student], entries=[entry_a, entry_b, entry_c])
        plan = compute_seating(session)
        assert len(plan.room_a.assignments) == 1
        assert len(plan.room_b.assignments) == 1
        assert len(plan.room_c.assignments) == 1
        assert plan.room_a.assignments[0].entry.subject == "Mathe"
```

- [ ] **Step 4: Run tests (some will fail until Task 2)**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/backend"
source .venv/bin/activate
cd ..
pytest tests/test_seating.py tests/test_session.py -v
```

Expected: `test_seating.py` tests pass (compute_seating now reads stored values), session tests pass. API tests fail (entries no longer create with desk/seat yet).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/app/session.py tests/test_seating.py
git commit -m "feat: add desk/seat to Entry model, migration for legacy session data"
```

---

## Task 2: Backend — Update `seating.py` + `create_entry`

**Files:**
- Modify: `backend/app/seating.py`
- Modify: `backend/app/routers/entries.py`

- [ ] **Step 1: Update `backend/app/seating.py`** — read desk/seat from entry

```python
# backend/app/seating.py
from typing import Literal
from .models import SessionData, RoomPlan, SeatAssignment, SeatingPlan, Entry, Student


def assign_room(duration_minutes: int) -> Literal["A", "B", "C"]:
    if duration_minutes <= 45:
        return "A"
    elif duration_minutes <= 59:
        return "B"
    else:
        return "C"


def next_free_seat(entries: list[Entry], room: str) -> tuple[int, int]:
    """Return the next available (desk, seat) in the given room."""
    occupied = {(e.desk, e.seat) for e in entries if e.room == room}
    for i in range(32):
        d, s = (i // 2) + 1, (i % 2) + 1
        if (d, s) not in occupied:
            return d, s
    raise ValueError(f"Raum {room} ist voll (32/32 Plätze belegt)")


def _build_room_plan(
    room: Literal["A", "B", "C"],
    label: str,
    entries: list[Entry],
    students_map: dict[str, Student],
) -> RoomPlan:
    room_entries = [e for e in entries if e.room == room and e.student_id in students_map]
    assignments = [
        SeatAssignment(
            desk=entry.desk,
            seat=entry.seat,
            entry=entry,
            student=students_map[entry.student_id],
        )
        for entry in room_entries
    ]
    return RoomPlan(room=room, label=label, assignments=assignments)


def compute_seating(session: SessionData) -> SeatingPlan:
    students_map = {s.id: s for s in session.students}
    return SeatingPlan(
        room_a=_build_room_plan("A", "≤ 45 min", session.entries, students_map),
        room_b=_build_room_plan("B", "46–59 min", session.entries, students_map),
        room_c=_build_room_plan("C", "≥ 60 min", session.entries, students_map),
    )
```

- [ ] **Step 2: Update `backend/app/routers/entries.py`** — store desk/seat at creation

```python
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
        (e for e in session.entries if e.room == body.room and e.desk == body.desk and e.seat == body.seat and e.id != entry_id),
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
```

- [ ] **Step 3: Run all tests**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/backend"
source .venv/bin/activate
cd ..
pytest tests/ -v
```

Expected: All existing tests pass. (API tests for entry creation now work because desk/seat are stored.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/seating.py backend/app/routers/entries.py
git commit -m "feat: store desk/seat in entry, PATCH seat endpoint, next_free_seat helper"
```

---

## Task 3: Backend — Tests for PATCH Seat Endpoint

**Files:**
- Modify: `tests/test_api.py`

- [ ] **Step 1: Add seat-move tests to `tests/test_api.py`**

Append to the existing file:

```python
# --- Seat move tests ---

def test_create_entry_stores_desk_seat(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    assert r.status_code == 201
    data = r.json()
    assert data["desk"] == 1
    assert data["seat"] == 1


def test_second_entry_gets_next_seat(client):
    sid = _upload(client)
    students = client.get("/api/students").json()
    sid2 = students[1]["id"]
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.post("/api/entries", json={"student_id": sid2, "subject": "Deutsch", "duration_minutes": 30, "teacher": "T"})
    assert r.json()["desk"] == 1
    assert r.json()["seat"] == 2


def test_move_entry_to_free_seat(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    eid = r.json()["id"]
    r2 = client.patch(f"/api/entries/{eid}/seat", json={"desk": 5, "seat": 2, "room": "A"})
    assert r2.status_code == 200
    updated = r2.json()
    assert len(updated) == 1
    assert updated[0]["desk"] == 5
    assert updated[0]["seat"] == 2
    assert updated[0]["room"] == "A"


def test_swap_entries_within_room(client):
    sid = _upload(client)
    students = client.get("/api/students").json()
    sid2 = students[1]["id"]
    r1 = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r2 = client.post("/api/entries", json={"student_id": sid2, "subject": "Deutsch", "duration_minutes": 30, "teacher": "T"})
    eid1, eid2 = r1.json()["id"], r2.json()["id"]
    # Move entry1 to entry2's seat → swap
    r = client.patch(f"/api/entries/{eid1}/seat", json={"desk": 1, "seat": 2, "room": "A"})
    assert r.status_code == 200
    updated = {e["id"]: e for e in r.json()}
    assert updated[eid1]["desk"] == 1 and updated[eid1]["seat"] == 2
    assert updated[eid2]["desk"] == 1 and updated[eid2]["seat"] == 1


def test_cross_room_move_to_free_seat(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    eid = r.json()["id"]
    r2 = client.patch(f"/api/entries/{eid}/seat", json={"desk": 3, "seat": 1, "room": "C"})
    assert r2.status_code == 200
    assert r2.json()[0]["room"] == "C"
    assert r2.json()[0]["desk"] == 3


def test_cross_room_move_to_occupied_seat_rejected(client):
    sid = _upload(client)
    students = client.get("/api/students").json()
    sid2 = students[1]["id"]
    r1 = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    client.post("/api/entries", json={"student_id": sid2, "subject": "Bio", "duration_minutes": 90, "teacher": "T"})
    eid1 = r1.json()["id"]
    # Try to move room-A entry to room-C seat 1/1 which is occupied
    r = client.patch(f"/api/entries/{eid1}/seat", json={"desk": 1, "seat": 1, "room": "C"})
    assert r.status_code == 409
```

- [ ] **Step 2: Run all tests**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/backend"
source .venv/bin/activate
cd ..
pytest tests/ -v
```

Expected: All tests pass including the 6 new seat-move tests.

- [ ] **Step 3: Commit**

```bash
git add tests/test_api.py
git commit -m "test: add seat move and swap API tests"
```

---

## Task 4: Frontend — Types, API client, DashboardPage wiring

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Run: `npm install @dnd-kit/core @dnd-kit/utilities`

- [ ] **Step 1: Install dnd-kit**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/frontend"
npm install @dnd-kit/core @dnd-kit/utilities
```

Expected: packages installed without errors.

- [ ] **Step 2: Update `frontend/src/types.ts`** — add desk/seat to Entry

```typescript
export interface Student {
  id: string;
  last_name: string;
  first_name: string;
  class_name: string;
}

export interface Entry {
  id: string;
  student_id: string;
  subject: string;
  duration_minutes: number;
  aids: string;
  teacher: string;
  room: 'A' | 'B' | 'C';
  desk: number;
  seat: number;
}

export interface EntryCreate {
  student_id: string;
  subject: string;
  duration_minutes: number;
  aids: string;
  teacher: string;
}

export interface SeatAssignment {
  desk: number;
  seat: number;
  entry: Entry;
  student: Student;
}

export interface RoomPlan {
  room: 'A' | 'B' | 'C';
  label: string;
  capacity: number;
  assignments: SeatAssignment[];
}

export interface SeatingPlan {
  room_a: RoomPlan;
  room_b: RoomPlan;
  room_c: RoomPlan;
}
```

- [ ] **Step 3: Update `frontend/src/api.ts`** — add `moveEntry`

Add to the `api` object (after `deleteEntry`):

```typescript
moveEntry: (id: string, body: { desk: number; seat: number; room: 'A' | 'B' | 'C' }) =>
  request<Entry[]>(`/api/entries/${id}/seat`, { method: 'PATCH', body: JSON.stringify(body) }),
```

The full `api` object after the addition:

```typescript
import type { Student, Entry, EntryCreate, SeatingPlan } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  uploadCsv: async (file: File): Promise<{ students: number }> => {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: form });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
  },
  getClasses: () => request<string[]>('/api/classes'),
  getStudents: (className?: string) =>
    request<Student[]>(className ? `/api/students?class_name=${encodeURIComponent(className)}` : '/api/students'),
  getEntries: () => request<Entry[]>('/api/entries'),
  createEntry: (body: EntryCreate) =>
    request<Entry>('/api/entries', { method: 'POST', body: JSON.stringify(body) }),
  deleteEntry: async (id: string): Promise<void> => {
    const r = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
  moveEntry: (id: string, body: { desk: number; seat: number; room: 'A' | 'B' | 'C' }) =>
    request<Entry[]>(`/api/entries/${id}/seat`, { method: 'PATCH', body: JSON.stringify(body) }),
  getSeating: () => request<SeatingPlan>('/api/seating'),
  reset: () => request<{ entries: number }>('/api/reset', { method: 'POST' }),
  exportUrl: (format: 'excel' | 'word') => `/api/export/${format}`,
};
```

- [ ] **Step 4: Update `frontend/src/pages/DashboardPage.tsx`** — clipboard state + move handlers

Replace the entire file with:

```tsx
// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SeatingPlan, SeatAssignment } from '../types';
import StudentForm from '../components/StudentForm';
import SeatingGrid, { RoomGrid } from '../components/SeatingGrid';
import ExportButtons from '../components/ExportButtons';

const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', label: '≥ 60 min', capacity: 32, assignments: [] },
};

const ROOM_LABEL: Record<'room_a' | 'room_b' | 'room_c', string> = {
  room_a: 'Raum A', room_b: 'Raum B', room_c: 'Raum C',
};

const ROOM_LETTER: Record<'room_a' | 'room_b' | 'room_c', 'A' | 'B' | 'C'> = {
  room_a: 'A', room_b: 'B', room_c: 'C',
};

const PRINT_ROOMS = [
  { key: 'room_a' as const, label: 'Raum A' },
  { key: 'room_b' as const, label: 'Raum B' },
  { key: 'room_c' as const, label: 'Raum C' },
];

export default function DashboardPage() {
  const [plan, setPlan] = useState<SeatingPlan>(EMPTY_PLAN);
  const [activeRoom, setActiveRoom] = useState<'room_a' | 'room_b' | 'room_c'>('room_a');
  const [clipboardEntry, setClipboardEntry] = useState<SeatAssignment | null>(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try { setPlan(await api.getSeating()); } catch { /* empty on first load */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleReset() {
    if (!confirm('Alle Einträge löschen? Die Stammdaten bleiben erhalten.')) return;
    await api.reset();
    setClipboardEntry(null);
    await refresh();
  }

  async function handleDeleteEntry(entryId: string) {
    await api.deleteEntry(entryId);
    if (clipboardEntry?.entry.id === entryId) setClipboardEntry(null);
    await refresh();
  }

  async function handleDrop(sourceEntryId: string, targetDesk: number, targetSeat: number) {
    await api.moveEntry(sourceEntryId, {
      desk: targetDesk,
      seat: targetSeat,
      room: ROOM_LETTER[activeRoom],
    });
    await refresh();
  }

  async function handlePaste(targetDesk: number, targetSeat: number) {
    if (!clipboardEntry) return;
    await api.moveEntry(clipboardEntry.entry.id, {
      desk: targetDesk,
      seat: targetSeat,
      room: ROOM_LETTER[activeRoom],
    });
    setClipboardEntry(null);
    await refresh();
  }

  const today = new Date().toLocaleDateString('de-DE');

  return (
    <>
      <div className="flex h-[calc(100vh-57px)]">
        <div
          className="w-80 shrink-0 flex flex-col p-4 gap-4 border-r overflow-y-auto no-print"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
        >
          <StudentForm onEntryAdded={refresh} plan={plan} />
          <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--c-border)' }}>
            <ExportButtons activeRoom={activeRoom} />
            <button onClick={handleReset} className="w-full text-sm py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}>
              Neue Sitzung
            </button>
            <button onClick={() => navigate('/')} className="w-full text-sm py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}>
              ← Neue CSV hochladen
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden print-active-room flex flex-col">
          <div className="print-single-heading p-4 pb-0" style={{ display: 'none' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
              {ROOM_LABEL[activeRoom]} — {plan[activeRoom].label} · {plan[activeRoom].assignments.length} Schüler
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>Nachschreiber — {today}</p>
          </div>
          <SeatingGrid
            plan={plan}
            activeRoom={activeRoom}
            onActiveRoomChange={setActiveRoom}
            onDeleteEntry={handleDeleteEntry}
            clipboardEntry={clipboardEntry}
            onScissors={setClipboardEntry}
            onCancelClipboard={() => setClipboardEntry(null)}
            onPaste={handlePaste}
            onDrop={handleDrop}
          />
        </div>
      </div>

      <div className="print-all-rooms">
        {PRINT_ROOMS.map(({ key, label }) => (
          <div key={key} className="print-room-section">
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
                {label} — {plan[key].label} · {plan[key].assignments.length} Schüler
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>Nachschreiber — {today}</p>
            </div>
            <RoomGrid room_plan={plan[key]} />
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Verify TypeScript build**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/frontend"
npm run build
```

Expected: Build succeeds. (SeatingGrid will have TypeScript errors about missing props — that is expected until Task 5.)

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/types.ts frontend/src/api.ts frontend/src/pages/DashboardPage.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add desk/seat to TS types, moveEntry API, clipboard state in DashboardPage"
```

---

## Task 5: Frontend — SeatingGrid with dnd-kit, Scissors, Clipboard Strip, Paste Targets

**Files:**
- Modify: `frontend/src/components/SeatingGrid.tsx`

- [ ] **Step 1: Replace `frontend/src/components/SeatingGrid.tsx` entirely**

```tsx
// frontend/src/components/SeatingGrid.tsx
import { useState } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { SeatingPlan, RoomPlan, SeatAssignment } from '../types';

interface Props {
  plan: SeatingPlan;
  activeRoom: 'room_a' | 'room_b' | 'room_c';
  onActiveRoomChange: (room: 'room_a' | 'room_b' | 'room_c') => void;
  onDeleteEntry: (entryId: string) => void;
  clipboardEntry: SeatAssignment | null;
  onScissors: (assignment: SeatAssignment) => void;
  onCancelClipboard: () => void;
  onPaste: (desk: number, seat: number) => void;
  onDrop: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
}

// ── Seat Slot ─────────────────────────────────────────────────────────────
interface SeatSlotProps {
  desk: number;
  seat: number;
  assignment: SeatAssignment | null;
  clipboardEntry: SeatAssignment | null;
  activeRoomLetter: 'A' | 'B' | 'C';
  onScissors: (a: SeatAssignment) => void;
  onPaste: (desk: number, seat: number) => void;
}

function SeatSlot({ desk, seat, assignment, clipboardEntry, activeRoomLetter, onScissors, onPaste }: SeatSlotProps) {
  const dropId = `${desk}-${seat}`;
  // Non-empty id required by dnd-kit even when disabled
  const dragId = assignment ? `entry-${assignment.entry.id}` : `empty-${desk}-${seat}`;

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    disabled: !assignment || clipboardEntry !== null,
  });

  const dragStyle = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  // Paste target: empty slot always; occupied slot only in same room (for swap)
  const isPasteTarget = clipboardEntry !== null && (
    !assignment || activeRoomLetter === clipboardEntry.entry.room
  );

  const isClipboardSource = clipboardEntry?.entry.id === assignment?.entry.id;

  const slotStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: '4px',
    padding: '3px 4px',
    minHeight: '2.25rem',
    position: 'relative',
    cursor: isPasteTarget ? 'pointer' : assignment && !clipboardEntry ? 'grab' : 'default',
    background: isClipboardSource
      ? 'rgba(245,158,11,0.08)'
      : assignment
        ? 'var(--c-bg)'
        : undefined,
    border: isPasteTarget
      ? '1.5px dashed var(--c-accent)'
      : isClipboardSource
        ? '1px dashed var(--c-accent)'
        : assignment
          ? undefined
          : '1px dashed var(--c-border)',
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isOver ? '0 0 0 2px var(--c-accent)' : undefined,
  };

  function handleClick() {
    if (isPasteTarget) onPaste(desk, seat);
  }

  return (
    <div ref={setDropRef} style={{ flex: 1 }}>
      <div
        ref={assignment && !clipboardEntry ? setDragRef : null}
        style={{ ...slotStyle, ...dragStyle }}
        onClick={handleClick}
        {...(assignment && !clipboardEntry ? { ...attributes, ...listeners } : {})}
      >
        {assignment && !isClipboardSource ? (
          <>
            <p className="font-semibold truncate" style={{ fontSize: '0.7rem', paddingRight: '18px' }}>
              {assignment.student.last_name}, {assignment.student.first_name}
            </p>
            <p className="truncate" style={{ fontSize: '0.65rem', color: 'var(--c-text-secondary)' }}>
              {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); onScissors(assignment); }}
              style={{
                position: 'absolute', top: '2px', right: '2px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.7rem', opacity: 0.5, padding: '1px',
                lineHeight: 1,
              }}
              title="Ausschneiden"
            >
              ✂️
            </button>
          </>
        ) : isClipboardSource ? (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-accent)', textAlign: 'center', paddingTop: '0.4rem' }}>
            ✂️ ausgeschnitten
          </p>
        ) : isPasteTarget ? (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-accent)', textAlign: 'center', paddingTop: '0.4rem' }}>
            📋 einsetzen
          </p>
        ) : (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-muted)', textAlign: 'center', paddingTop: '0.4rem' }}>
            frei
          </p>
        )}
      </div>
    </div>
  );
}

// ── Desk Card ─────────────────────────────────────────────────────────────
interface DeskCardProps {
  desk: number;
  slots: [SeatAssignment | null, SeatAssignment | null];
  clipboardEntry: SeatAssignment | null;
  activeRoomLetter: 'A' | 'B' | 'C';
  onScissors: (a: SeatAssignment) => void;
  onPaste: (desk: number, seat: number) => void;
}

function DeskCard({ desk, slots, clipboardEntry, activeRoomLetter, onScissors, onPaste }: DeskCardProps) {
  const hasOccupied = slots.some(Boolean);
  const isPasteTarget = clipboardEntry !== null;
  return (
    <div
      className="rounded-lg p-2 text-xs"
      style={{
        background: 'var(--c-surface)',
        border: `1px ${hasOccupied ? 'solid' : 'dashed'} ${hasOccupied ? 'var(--c-accent)' : isPasteTarget ? 'rgba(245,158,11,0.4)' : 'var(--c-border)'}`,
      }}
    >
      <p className="font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--c-text-secondary)', fontSize: '0.65rem' }}>
        Tisch {desk}
      </p>
      <div className="flex gap-1">
        {slots.map((a, i) => (
          <SeatSlot
            key={i}
            desk={desk}
            seat={i + 1}
            assignment={a}
            clipboardEntry={clipboardEntry}
            activeRoomLetter={activeRoomLetter}
            onScissors={onScissors}
            onPaste={onPaste}
          />
        ))}
      </div>
    </div>
  );
}

// ── Room Grid ─────────────────────────────────────────────────────────────
export function RoomGrid({
  room_plan,
  clipboardEntry = null,
  onScissors,
  onPaste,
  onDrop,
}: {
  room_plan: RoomPlan;
  clipboardEntry?: SeatAssignment | null;
  onScissors?: (a: SeatAssignment) => void;
  onPaste?: (desk: number, seat: number) => void;
  onDrop?: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
}) {
  const assignmentMap = new Map<string, SeatAssignment>();
  for (const a of room_plan.assignments) {
    assignmentMap.set(`${a.desk}-${a.seat}`, a);
  }

  const desks = Array.from({ length: 16 }, (_, i) => {
    const desk = i + 1;
    return {
      desk,
      slots: [
        assignmentMap.get(`${desk}-1`) ?? null,
        assignmentMap.get(`${desk}-2`) ?? null,
      ] as [SeatAssignment | null, SeatAssignment | null],
    };
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !onDrop) return;
    const entryId = (active.id as string).replace('entry-', '');
    const [desk, seat] = (over.id as string).split('-').map(Number);
    if (!isNaN(desk) && !isNaN(seat)) {
      onDrop(entryId, desk, seat);
    }
  }

  const noop = () => {};

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-2">
        {desks.map(({ desk, slots }) => (
          <DeskCard
            key={desk}
            desk={desk}
            slots={slots}
            clipboardEntry={clipboardEntry}
            activeRoomLetter={room_plan.room}
            onScissors={onScissors ?? noop}
            onPaste={onPaste ?? noop}
          />
        ))}
      </div>
    </DndContext>
  );
}

// ── Clipboard Strip ───────────────────────────────────────────────────────
function ClipboardStrip({ assignment, onCancel }: { assignment: SeatAssignment; onCancel: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-sm no-print"
      style={{
        background: 'rgba(245,158,11,0.12)',
        borderBottom: '1px solid rgba(245,158,11,0.3)',
      }}
    >
      <span>📋</span>
      <span style={{ flex: 1 }}>
        <strong style={{ color: 'var(--c-accent)' }}>Zwischenablage:</strong>{' '}
        <span style={{ color: 'var(--c-text)' }}>
          {assignment.student.last_name}, {assignment.student.first_name}
        </span>{' '}
        <span style={{ color: 'var(--c-text-secondary)' }}>
          · {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
          {' '}(war: Raum {assignment.entry.room}, Tisch {assignment.desk})
        </span>
      </span>
      <button
        onClick={onCancel}
        className="text-sm px-2 py-0.5 rounded border"
        style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}
      >
        ✕ Abbrechen
      </button>
    </div>
  );
}

// ── SeatingGrid (main export) ─────────────────────────────────────────────
const ROOMS = [
  { key: 'room_a' as const, label: 'Raum A' },
  { key: 'room_b' as const, label: 'Raum B' },
  { key: 'room_c' as const, label: 'Raum C' },
];

export default function SeatingGrid({
  plan, activeRoom, onActiveRoomChange, onDeleteEntry: _onDeleteEntry,
  clipboardEntry, onScissors, onCancelClipboard, onPaste, onDrop,
}: Props) {
  const active = plan[activeRoom];

  return (
    <div className="flex flex-col h-full">
      {clipboardEntry && (
        <ClipboardStrip assignment={clipboardEntry} onCancel={onCancelClipboard} />
      )}

      <div className="flex gap-2 p-4 pb-2 no-print">
        {ROOMS.map(({ key, label }) => {
          const count = plan[key].assignments.length;
          const isActive = activeRoom === key;
          return (
            <button
              key={key}
              onClick={() => onActiveRoomChange(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? 'var(--c-accent)' : 'var(--c-surface)',
                color: isActive ? 'white' : 'var(--c-text-secondary)',
                border: isActive ? 'none' : '1px solid var(--c-border)',
              }}
            >
              {label}
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--c-bg)' }}>
                {count}/32
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-4 text-xs pb-2 no-print" style={{ color: 'var(--c-text-secondary)' }}>
        {active.label} · {active.assignments.length} Schüler
        {clipboardEntry && <span style={{ color: 'var(--c-accent)' }}> · Zielplatz wählen oder Raum wechseln</span>}
      </p>

      <div className="overflow-y-auto flex-1 px-4 pb-4">
        <RoomGrid
          room_plan={active}
          clipboardEntry={clipboardEntry}
          onScissors={onScissors}
          onPaste={onPaste}
          onDrop={onDrop}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript build**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/frontend"
npm run build
```

Expected: `✓ built in Xs` — no TypeScript errors.

- [ ] **Step 3: Manual end-to-end test**

Start backend and frontend:
```bash
# Terminal 1
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

Test flow:
1. Upload `beispiel_schueler.csv`, add 4 students across Rooms A and C
2. **Drag & drop**: drag a student from Tisch 1 to Tisch 3 → both cards update
3. **Swap**: drag a student onto another occupied Tisch → they swap
4. **Scissors to same room**: click ✂️ → amber strip appears → click another Tisch → student moves
5. **Scissors cross-room**: click ✂️ on Room A student → switch to Room C tab → click empty Tisch → student appears in Room C
6. **Cancel**: click ✂️, then "✕ Abbrechen" → student stays where they were
7. **Print**: ✂️ strips hide in print (no-print class on ClipboardStrip)

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/components/SeatingGrid.tsx
git commit -m "feat: drag & drop seats, scissors clipboard strip, paste targets"
```

---

## Task 6: Deploy to Raspberry Pi

- [ ] **Step 1: Run all backend tests**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/backend"
source .venv/bin/activate
cd ..
pytest tests/ -q
```

Expected: All tests pass.

- [ ] **Step 2: Final frontend build**

```bash
cd frontend && npm run build
```

Expected: Clean build.

- [ ] **Step 3: Push to GitHub**

```bash
cd ..
git push
```

- [ ] **Step 4: Deploy on Pi**

```bash
ssh pi@192.168.2.54 "cd Nachschreiber && git pull && docker compose up -d --build"
```

Expected: Both containers rebuilt and running.

- [ ] **Step 5: Smoke test**

Open http://192.168.2.54:3002, upload CSV, add entries, test drag & drop and scissors.
