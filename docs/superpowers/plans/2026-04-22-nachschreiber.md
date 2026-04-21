# Nachschreiber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app for managing weekly school makeup exam scheduling — CSV upload of student master data, a live split-view dashboard to register students with exam details, automatic room/seat assignment, and Excel + Word export.

**Architecture:** FastAPI backend with atomic JSON session persistence + React/TypeScript/Tailwind frontend (live split-view dashboard), served via nginx reverse proxy, deployed as two Docker containers on port 3002.

**Tech Stack:** Python 3.12, FastAPI 0.111, uvicorn, openpyxl 3.1.2, python-docx 1.1.2, pytest 8.2, httpx 0.27 | React 18, TypeScript, Vite 5, Tailwind CSS 3.4, react-router-dom 6

---

## File Map

```
Nachschreiber/
├── backend/
│   ├── app/
│   │   ├── main.py           — FastAPI app init + router mounting + CORS
│   │   ├── models.py         — Pydantic models (Student, Entry, SessionData, SeatingPlan, …)
│   │   ├── session.py        — atomic JSON load/save to /data/session.json
│   │   ├── parser.py         — CSV parsing (semicolon-delimited, UTF-8-BOM safe)
│   │   ├── seating.py        — room assignment logic + dynamic seat computation
│   │   ├── exporter.py       — Excel (openpyxl) + Word (python-docx) generation
│   │   └── routers/
│   │       ├── upload.py     — POST /api/upload
│   │       ├── students.py   — GET /api/students, GET /api/classes
│   │       ├── entries.py    — GET/POST/DELETE /api/entries
│   │       ├── seating.py    — GET /api/seating
│   │       ├── export.py     — GET /api/export/excel, GET /api/export/word
│   │       └── misc.py       — POST /api/reset, GET /api/health
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx          — React mount point
│   │   ├── App.tsx           — router, dark mode toggle, header
│   │   ├── types.ts          — TypeScript interfaces
│   │   ├── api.ts            — typed fetch wrapper for all API routes
│   │   ├── index.css         — Tailwind + CSS custom properties (design tokens)
│   │   └── pages/
│   │       ├── UploadPage.tsx    — CSV upload step
│   │       └── DashboardPage.tsx — split-view main page
│   │   └── components/
│   │       ├── StudentForm.tsx   — left panel: form to add a student entry
│   │       ├── SeatingGrid.tsx   — right panel: room tabs + 4×4 desk grid
│   │       └── ExportButtons.tsx — Excel / Word download buttons
│   ├── index.html
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── tsconfig.json
├── tests/
│   ├── conftest.py
│   ├── test_parser.py
│   ├── test_seating.py
│   ├── test_api.py
│   └── test_exporter.py
├── docker-compose.yml
├── pytest.ini
├── .gitignore
├── CLAUDE.md
└── docs/
    └── superpowers/
        ├── specs/2026-04-22-nachschreiber-design.md
        └── plans/2026-04-22-nachschreiber.md   ← this file
```

---

## Task 1: Project Scaffold & Git Init

**Files:**
- Create: all root config files and empty stubs

- [ ] **Step 1: Git-Repository initialisieren**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber"
git init
```

Expected: `Initialized empty Git repository in .../Nachschreiber/.git/`

- [ ] **Step 2: Verzeichnisstruktur anlegen**

```bash
mkdir -p backend/app/routers frontend/src/pages frontend/src/components tests
```

- [ ] **Step 3: `pytest.ini` erstellen**

```ini
# pytest.ini
[pytest]
testpaths = tests
```

- [ ] **Step 4: `backend/requirements.txt` erstellen**

```
fastapi==0.111.0
uvicorn==0.29.0
pydantic==2.7.0
python-multipart==0.0.9
openpyxl==3.1.2
python-docx==1.1.2
pytest==8.2.0
httpx==0.27.0
```

- [ ] **Step 5: `backend/app/__init__.py` und Router-Stubs anlegen**

```bash
touch backend/app/__init__.py backend/app/routers/__init__.py
touch tests/__init__.py
```

- [ ] **Step 6: `backend/app/main.py` (leere App)**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Nachschreiber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Abhängigkeiten installieren und App testen**

```bash
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload
```

Öffne http://localhost:8000/api/health — erwartet: `{"status":"ok"}`  
Dann mit Ctrl+C stoppen.

- [ ] **Step 8: `frontend/package.json` erstellen**

```json
{
  "name": "nachschreiber",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}
```

- [ ] **Step 9: `frontend/tsconfig.json` erstellen**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 10: `frontend/vite.config.ts` erstellen**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 11: `frontend/postcss.config.js` erstellen**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 12: `frontend/tailwind.config.js` erstellen**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 13: Frontend-Abhängigkeiten installieren**

```bash
cd frontend && npm install
```

Expected: `added NNN packages`

- [ ] **Step 14: Initialer Commit**

```bash
cd ..
git add .
git commit -m "chore: initial project scaffold"
```

---

## Task 2: Backend — Pydantic-Modelle + Session-Persistenz

**Files:**
- Create: `backend/app/models.py`
- Create: `backend/app/session.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: `backend/app/models.py` schreiben**

```python
# backend/app/models.py
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel


class Student(BaseModel):
    id: str
    last_name: str
    first_name: str
    class_name: str


class Entry(BaseModel):
    id: str
    student_id: str
    subject: str
    duration_minutes: int
    aids: str = ""
    teacher: str
    room: Literal["A", "B", "C"]


class EntryCreate(BaseModel):
    student_id: str
    subject: str
    duration_minutes: int
    aids: str = ""
    teacher: str


class SeatAssignment(BaseModel):
    desk: int    # 1–16
    seat: int    # 1–2
    entry: Entry
    student: Student


class RoomPlan(BaseModel):
    room: Literal["A", "B", "C"]
    label: str
    capacity: int = 32
    assignments: list[SeatAssignment]


class SeatingPlan(BaseModel):
    room_a: RoomPlan
    room_b: RoomPlan
    room_c: RoomPlan


class SessionData(BaseModel):
    students: list[Student] = []
    entries: list[Entry] = []
```

- [ ] **Step 2: `backend/app/session.py` schreiben**

```python
# backend/app/session.py
import os
from pathlib import Path
from .models import SessionData

DATA_PATH = Path(os.getenv("DATA_DIR", "/data")) / "session.json"


def load() -> SessionData:
    if DATA_PATH.exists():
        return SessionData.model_validate_json(DATA_PATH.read_text())
    return SessionData()


def save(session: SessionData) -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_PATH.with_suffix(".tmp")
    tmp.write_text(session.model_dump_json(indent=2))
    tmp.replace(DATA_PATH)
```

- [ ] **Step 3: `tests/conftest.py` schreiben**

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    import app.session as session_module
    session_module.DATA_PATH = tmp_path / "session.json"
    from app.main import app
    return TestClient(app)


SAMPLE_CSV = b"Nachname;Vorname;Klasse\nMueller;Anna;10a\nSchmidt;Max;9b\n"
```

- [ ] **Step 4: Session-Persistenz-Test schreiben**

Datei `tests/test_session.py`:

```python
# tests/test_session.py
from app.models import SessionData, Student
import uuid


def test_roundtrip(tmp_path, monkeypatch):
    import app.session as s
    s.DATA_PATH = tmp_path / "session.json"

    session = SessionData(students=[
        Student(id=str(uuid.uuid4()), last_name="Meier", first_name="Hans", class_name="10a")
    ])
    s.save(session)
    loaded = s.load()
    assert len(loaded.students) == 1
    assert loaded.students[0].last_name == "Meier"


def test_load_empty(tmp_path, monkeypatch):
    import app.session as s
    s.DATA_PATH = tmp_path / "session.json"
    result = s.load()
    assert result.students == []
    assert result.entries == []
```

- [ ] **Step 5: Test ausführen (erwartet: PASS)**

```bash
cd backend && pytest ../tests/test_session.py -v
```

Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/session.py tests/conftest.py tests/test_session.py
git commit -m "feat: add Pydantic models and atomic session persistence"
```

---

## Task 3: Backend — CSV-Parser + Upload-API

**Files:**
- Create: `backend/app/parser.py`
- Create: `backend/app/routers/upload.py`
- Create: `tests/test_parser.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Failing-Tests für den Parser schreiben**

```python
# tests/test_parser.py
import pytest
from app.parser import parse_students


def test_parse_valid_csv():
    csv = b"Nachname;Vorname;Klasse\nMueller;Anna;10a\nSchmidt;Max;9b\n"
    students = parse_students(csv)
    assert len(students) == 2
    assert students[0].last_name == "Mueller"
    assert students[0].first_name == "Anna"
    assert students[0].class_name == "10a"
    assert students[1].last_name == "Schmidt"


def test_parse_bom_csv():
    # Excel on Windows adds UTF-8 BOM
    csv = b"\xef\xbb\xbfNachname;Vorname;Klasse\nMueller;Anna;10a\n"
    students = parse_students(csv)
    assert len(students) == 1


def test_parse_empty_raises():
    csv = b"Nachname;Vorname;Klasse\n"
    with pytest.raises(ValueError, match="keine Schüler"):
        parse_students(csv)


def test_parse_missing_column_raises():
    csv = b"Name;Klasse\nMueller;10a\n"
    with pytest.raises(ValueError):
        parse_students(csv)


def test_parse_strips_whitespace():
    csv = b"Nachname;Vorname;Klasse\n  Mueller ;  Anna ;  10a  \n"
    students = parse_students(csv)
    assert students[0].last_name == "Mueller"
    assert students[0].class_name == "10a"
```

- [ ] **Step 2: Test ausführen (erwartet: FAIL — ImportError)**

```bash
cd backend && pytest ../tests/test_parser.py -v
```

Expected: `ERROR collecting` — `parser` nicht gefunden.

- [ ] **Step 3: `backend/app/parser.py` implementieren**

```python
# backend/app/parser.py
import csv
import io
import uuid
from .models import Student


def parse_students(content: bytes) -> list[Student]:
    text = content.decode("utf-8-sig")  # strips UTF-8 BOM from Excel
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    students: list[Student] = []
    for i, row in enumerate(reader, start=2):
        try:
            students.append(Student(
                id=str(uuid.uuid4()),
                last_name=row["Nachname"].strip(),
                first_name=row["Vorname"].strip(),
                class_name=row["Klasse"].strip(),
            ))
        except KeyError as e:
            raise ValueError(f"Zeile {i}: Spalte {e} fehlt. Erwartet: Nachname;Vorname;Klasse") from e
    if not students:
        raise ValueError("CSV enthält keine Schüler")
    return students
```

- [ ] **Step 4: Tests ausführen (erwartet: PASS)**

```bash
cd backend && pytest ../tests/test_parser.py -v
```

Expected: `5 passed`

- [ ] **Step 5: Upload-Router schreiben**

```python
# backend/app/routers/upload.py
from fastapi import APIRouter, HTTPException, UploadFile, File
from ..parser import parse_students
from ..session import load, save
from ..models import Student

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
```

- [ ] **Step 6: Router in `main.py` einbinden**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload

app = FastAPI(title="Nachschreiber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: API-Upload-Test schreiben und ausführen**

```python
# In tests/test_api.py (neue Datei anlegen)
from tests.conftest import SAMPLE_CSV


def test_upload_csv(client):
    r = client.post("/api/upload", files={"file": ("students.csv", SAMPLE_CSV, "text/csv")})
    assert r.status_code == 200
    assert r.json()["students"] == 2


def test_upload_invalid_csv(client):
    r = client.post("/api/upload", files={"file": ("bad.csv", b"Falsch;Format\n", "text/csv")})
    assert r.status_code == 422
```

```bash
cd backend && pytest ../tests/test_api.py::test_upload_csv ../tests/test_api.py::test_upload_invalid_csv -v
```

Expected: `2 passed`

- [ ] **Step 8: Commit**

```bash
git add backend/app/parser.py backend/app/routers/upload.py backend/app/main.py tests/test_parser.py tests/test_api.py
git commit -m "feat: CSV parser and upload API"
```

---

## Task 4: Backend — Sitzplan-Logik (Seating)

**Files:**
- Create: `backend/app/seating.py`
- Create: `tests/test_seating.py`

- [ ] **Step 1: Failing-Tests schreiben**

```python
# tests/test_seating.py
import pytest
from app.seating import assign_room, compute_seating
from app.models import Student, Entry, SessionData
import uuid


def make_entry(room: str, subject: str = "Mathe", duration: int = 45) -> Entry:
    return Entry(
        id=str(uuid.uuid4()),
        student_id="s1",
        subject=subject,
        duration_minutes=duration,
        teacher="Fr. Test",
        room=room,  # type: ignore
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

    def test_sequential_seats_same_desk(self):
        student = make_student()
        entries = [make_entry("A", "Mathe"), make_entry("A", "Deutsch")]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        a = plan.room_a.assignments
        assert a[0].desk == 1 and a[0].seat == 1
        assert a[1].desk == 1 and a[1].seat == 2

    def test_sequential_seats_next_desk(self):
        student = make_student()
        entries = [make_entry("A", f"Fach{i}") for i in range(3)]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        a = plan.room_a.assignments
        assert a[2].desk == 2 and a[2].seat == 1

    def test_room_capacity_label(self):
        plan = compute_seating(SessionData())
        assert plan.room_a.label == "≤ 45 min"
        assert plan.room_b.label == "46–59 min"
        assert plan.room_c.label == "≥ 60 min"

    def test_count_matches_entries(self):
        student = make_student()
        entries = [make_entry("A", f"F{i}") for i in range(5)]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        assert len(plan.room_a.assignments) == 5
```

- [ ] **Step 2: Test ausführen (erwartet: FAIL)**

```bash
cd backend && pytest ../tests/test_seating.py -v
```

Expected: `ERROR` — `seating` nicht gefunden.

- [ ] **Step 3: `backend/app/seating.py` implementieren**

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


def _build_room_plan(
    room: Literal["A", "B", "C"],
    label: str,
    entries: list[Entry],
    students_map: dict[str, Student],
) -> RoomPlan:
    room_entries = [e for e in entries if e.room == room]
    assignments = [
        SeatAssignment(
            desk=(i // 2) + 1,
            seat=(i % 2) + 1,
            entry=entry,
            student=students_map[entry.student_id],
        )
        for i, entry in enumerate(room_entries)
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

- [ ] **Step 4: Tests ausführen (erwartet: PASS)**

```bash
cd backend && pytest ../tests/test_seating.py -v
```

Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/seating.py tests/test_seating.py
git commit -m "feat: room assignment and dynamic seat computation"
```

---

## Task 5: Backend — Entries API

**Files:**
- Create: `backend/app/routers/entries.py`
- Modify: `backend/app/main.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Tests für Entries-API schreiben**

Füge folgendes zu `tests/test_api.py` hinzu:

```python
# tests/test_api.py (ergänzen)
from tests.conftest import SAMPLE_CSV


def _upload(client):
    client.post("/api/upload", files={"file": ("s.csv", SAMPLE_CSV, "text/csv")})
    students = client.get("/api/students").json()
    return students[0]["id"]


def test_create_entry(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={
        "student_id": sid,
        "subject": "Mathematik",
        "duration_minutes": 45,
        "aids": "Taschenrechner",
        "teacher": "Fr. Schmidt",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["room"] == "A"
    assert data["subject"] == "Mathematik"


def test_duplicate_entry_rejected(client):
    sid = _upload(client)
    payload = {"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"}
    client.post("/api/entries", json=payload)
    r = client.post("/api/entries", json=payload)
    assert r.status_code == 409


def test_different_subject_same_student_allowed(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Deutsch", "duration_minutes": 30, "teacher": "T"})
    assert r.status_code == 201


def test_delete_entry(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Bio", "duration_minutes": 90, "teacher": "T"})
    eid = r.json()["id"]
    r2 = client.delete(f"/api/entries/{eid}")
    assert r2.status_code == 204
    entries = client.get("/api/entries").json()
    assert all(e["id"] != eid for e in entries)


def test_room_c_for_60_minutes(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Physik", "duration_minutes": 60, "teacher": "T"})
    assert r.json()["room"] == "C"


def test_room_b_for_59_minutes(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Chemie", "duration_minutes": 59, "teacher": "T"})
    assert r.json()["room"] == "B"
```

- [ ] **Step 2: Test ausführen (erwartet: FAIL — 404 Not Found)**

```bash
cd backend && pytest ../tests/test_api.py -k "entry" -v
```

Expected: FAIL (routes not registered)

- [ ] **Step 3: `backend/app/routers/students.py` (Stub für `GET /api/students`) erstellen**

Wird in Task 6 um `/api/classes` erweitert.

```python
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
```

Und in `main.py` einbinden (temporär, wird in Task 6 vervollständigt):

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, entries, students

app = FastAPI(title="Nachschreiber")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(upload.router)
app.include_router(entries.router)
app.include_router(students.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: `backend/app/routers/entries.py` implementieren**

```python
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
```

- [ ] **Step 4: `entries`-Router in `main.py` einbinden** (students wurde bereits in Step 3 hinzugefügt)

```python
# backend/app/main.py — vollständige Datei nach Task 5
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, entries, students

app = FastAPI(title="Nachschreiber")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(upload.router)
app.include_router(entries.router)
app.include_router(students.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Tests ausführen (erwartet: PASS)**

```bash
cd backend && pytest ../tests/test_api.py -k "entry" -v
```

Expected: `6 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/entries.py backend/app/main.py tests/test_api.py
git commit -m "feat: entries API with duplicate check and room overflow guard"
```

---

## Task 6: Backend — Classes, Seating Plan & Reset APIs

**Files:**
- Modify: `backend/app/routers/students.py` (GET /api/classes hinzufügen)
- Create: `backend/app/routers/seating_router.py`
- Create: `backend/app/routers/misc.py`
- Modify: `backend/app/main.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Tests schreiben**

Füge zu `tests/test_api.py` hinzu:

```python
def test_get_classes(client):
    client.post("/api/upload", files={"file": ("s.csv", SAMPLE_CSV, "text/csv")})
    r = client.get("/api/classes")
    assert r.status_code == 200
    assert "10a" in r.json()
    assert "9b" in r.json()


def test_get_students_filtered(client):
    client.post("/api/upload", files={"file": ("s.csv", SAMPLE_CSV, "text/csv")})
    r = client.get("/api/students?class_name=10a")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["class_name"] == "10a"


def test_seating_plan(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.get("/api/seating")
    assert r.status_code == 200
    plan = r.json()
    assert len(plan["room_a"]["assignments"]) == 1
    assert plan["room_a"]["assignments"][0]["desk"] == 1
    assert plan["room_a"]["assignments"][0]["seat"] == 1


def test_reset(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.post("/api/reset")
    assert r.status_code == 200
    assert client.get("/api/entries").json() == []
    # students remain after reset
    assert len(client.get("/api/students").json()) == 2
```

- [ ] **Step 2: Tests ausführen (erwartet: FAIL)**

```bash
cd backend && pytest ../tests/test_api.py -k "classes or students or seating_plan or reset" -v
```

- [ ] **Step 3: `GET /api/classes` zu `backend/app/routers/students.py` hinzufügen**

Die Datei existiert bereits aus Task 5. Füge den fehlenden Endpunkt hinzu:

```python
# backend/app/routers/students.py — vollständige Datei nach Task 6
from fastapi import APIRouter
from ..models import Student
from ..session import load

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
```

- [ ] **Step 4: `backend/app/routers/seating_router.py` implementieren**

```python
# backend/app/routers/seating_router.py
from fastapi import APIRouter
from ..models import SeatingPlan
from ..session import load
from ..seating import compute_seating

router = APIRouter(prefix="/api", tags=["seating"])


@router.get("/seating")
def get_seating() -> SeatingPlan:
    return compute_seating(load())
```

- [ ] **Step 5: `backend/app/routers/misc.py` implementieren**

```python
# backend/app/routers/misc.py
from fastapi import APIRouter
from ..session import load, save

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/reset")
def reset() -> dict:
    session = load()
    session.entries = []
    save(session)
    return {"entries": 0}
```

- [ ] **Step 6: Alle neuen Router in `main.py` einbinden**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, entries, students, seating_router, misc

app = FastAPI(title="Nachschreiber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(entries.router)
app.include_router(students.router)
app.include_router(seating_router.router)
app.include_router(misc.router)
```

- [ ] **Step 7: Alle Tests ausführen (erwartet: alle grün)**

```bash
cd backend && pytest ../tests/ -v
```

Expected: alle Tests grün, kein FAIL.

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/students.py backend/app/routers/seating_router.py backend/app/routers/misc.py backend/app/main.py tests/test_api.py
git commit -m "feat: students, classes, seating plan and reset APIs"
```

---

## Task 7: Backend — Excel- und Word-Export

**Files:**
- Create: `backend/app/exporter.py`
- Create: `backend/app/routers/export.py`
- Create: `tests/test_exporter.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Tests für den Exporter schreiben**

```python
# tests/test_exporter.py
import io
import openpyxl
from app.exporter import build_excel, build_word
from app.models import SessionData, Student, Entry, SeatingPlan
from app.seating import compute_seating
import uuid


def _make_session() -> SessionData:
    student = Student(id="s1", last_name="Müller", first_name="Anna", class_name="10a")
    entry = Entry(
        id=str(uuid.uuid4()),
        student_id="s1",
        subject="Mathematik",
        duration_minutes=45,
        aids="Taschenrechner",
        teacher="Fr. Schmidt",
        room="A",
    )
    return SessionData(students=[student], entries=[entry])


def test_excel_has_three_sheets():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    assert set(wb.sheetnames) == {"Raum A", "Raum B", "Raum C"}


def test_excel_room_a_has_data():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    # Row 1 = header, Row 2 = first student
    assert ws.cell(2, 3).value == "Müller"   # Nachname
    assert ws.cell(2, 4).value == "Anna"     # Vorname


def test_word_returns_bytes():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_word(plan)
    assert isinstance(buf, bytes)
    assert len(buf) > 100  # non-empty DOCX
```

- [ ] **Step 2: Tests ausführen (erwartet: FAIL)**

```bash
cd backend && pytest ../tests/test_exporter.py -v
```

- [ ] **Step 3: `backend/app/exporter.py` implementieren**

```python
# backend/app/exporter.py
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from docx import Document
from docx.shared import Pt
from .models import SeatingPlan, RoomPlan

_HEADERS = ["Tisch", "Platz", "Nachname", "Vorname", "Klasse", "Fach", "Dauer (min)", "Hilfsmittel", "Lehrkraft"]
_ROOMS = [("room_a", "Raum A"), ("room_b", "Raum B"), ("room_c", "Raum C")]


def _fill_sheet(ws, room_plan: RoomPlan) -> None:
    ws.append(_HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="D97706")
        cell.font = Font(bold=True, color="FFFFFF")
        cell.alignment = Alignment(horizontal="center")

    assignment_map = {(a.desk, a.seat): a for a in room_plan.assignments}
    for desk in range(1, 17):
        for seat in range(1, 3):
            a = assignment_map.get((desk, seat))
            if a:
                ws.append([
                    desk, seat,
                    a.student.last_name, a.student.first_name, a.student.class_name,
                    a.entry.subject, a.entry.duration_minutes,
                    a.entry.aids, a.entry.teacher,
                ])
            else:
                ws.append([desk, seat, "", "", "", "", "", "", ""])

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 16


def build_excel(plan: SeatingPlan) -> bytes:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # remove default sheet
    for attr, title in _ROOMS:
        ws = wb.create_sheet(title)
        _fill_sheet(ws, getattr(plan, attr))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _add_room_table(doc: Document, room_plan: RoomPlan, title: str) -> None:
    doc.add_heading(title, level=1)
    table = doc.add_table(rows=1, cols=len(_HEADERS))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(_HEADERS):
        hdr[i].text = h
        hdr[i].paragraphs[0].runs[0].font.bold = True

    assignment_map = {(a.desk, a.seat): a for a in room_plan.assignments}
    for desk in range(1, 17):
        for seat in range(1, 3):
            a = assignment_map.get((desk, seat))
            row = table.add_row().cells
            row[0].text = str(desk)
            row[1].text = str(seat)
            if a:
                row[2].text = a.student.last_name
                row[3].text = a.student.first_name
                row[4].text = a.student.class_name
                row[5].text = a.entry.subject
                row[6].text = str(a.entry.duration_minutes)
                row[7].text = a.entry.aids
                row[8].text = a.entry.teacher


def build_word(plan: SeatingPlan) -> bytes:
    doc = Document()
    doc.core_properties.title = "Nachschreiber Sitzplan"
    for i, (attr, title) in enumerate(_ROOMS):
        if i > 0:
            doc.add_page_break()
        _add_room_table(doc, getattr(plan, attr), title)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
```

- [ ] **Step 4: Tests ausführen (erwartet: PASS)**

```bash
cd backend && pytest ../tests/test_exporter.py -v
```

Expected: `3 passed`

- [ ] **Step 5: Export-Router implementieren**

```python
# backend/app/routers/export.py
from fastapi import APIRouter
from fastapi.responses import Response
from ..session import load
from ..seating import compute_seating
from ..exporter import build_excel, build_word

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/excel")
def export_excel() -> Response:
    plan = compute_seating(load())
    data = build_excel(plan)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=nachschreiber_sitzplan.xlsx"},
    )


@router.get("/word")
def export_word() -> Response:
    plan = compute_seating(load())
    data = build_word(plan)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=nachschreiber_sitzplan.docx"},
    )
```

- [ ] **Step 6: Export-Router in `main.py` einbinden**

```python
# backend/app/main.py — vollständige Datei
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, entries, students, seating_router, misc, export

app = FastAPI(title="Nachschreiber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(entries.router)
app.include_router(students.router)
app.include_router(seating_router.router)
app.include_router(export.router)
app.include_router(misc.router)
```

- [ ] **Step 7: Alle Backend-Tests ausführen**

```bash
cd backend && pytest ../tests/ -v
```

Expected: alle Tests grün.

- [ ] **Step 8: Commit**

```bash
git add backend/app/exporter.py backend/app/routers/export.py backend/app/main.py tests/test_exporter.py
git commit -m "feat: Excel and Word export"
```

---

## Task 8: Frontend — Scaffold + Design System

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: `frontend/index.html` erstellen**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nachschreiber</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
    <script>
      (function () {
        const dark = localStorage.getItem('theme') === 'dark' ||
          (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.classList.add('dark');
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: `frontend/src/main.tsx` erstellen**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 3: `frontend/src/index.css` erstellen (Design-Tokens — gleiche Sprache wie Kurswahl)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --c-bg: #faf9f6;
    --c-surface: #ffffff;
    --c-border: #e5e0d8;
    --c-text: #1c1917;
    --c-text-secondary: #78716c;
    --c-accent: #d97706;
    --c-accent-hover: #b45309;
    --c-success: #16a34a;
    --c-error: #dc2626;
    --c-muted: #a8a29e;
  }

  .dark {
    --c-bg: #0f0e0d;
    --c-surface: #1c1917;
    --c-border: #292524;
    --c-text: #fafaf9;
    --c-text-secondary: #a8a29e;
    --c-accent: #f59e0b;
    --c-accent-hover: #fbbf24;
    --c-success: #4ade80;
    --c-error: #f87171;
    --c-muted: #57534e;
  }

  body {
    background-color: var(--c-bg);
    color: var(--c-text);
    font-family: 'DM Sans', sans-serif;
  }

  h1, h2, h3 {
    font-family: 'Bricolage Grotesque', sans-serif;
  }
}
```

- [ ] **Step 4: `frontend/src/types.ts` erstellen**

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

- [ ] **Step 5: `frontend/src/api.ts` erstellen**

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
  getSeating: () => request<SeatingPlan>('/api/seating'),
  reset: () => request<{ entries: number }>('/api/reset', { method: 'POST' }),
  exportUrl: (format: 'excel' | 'word') => `/api/export/${format}`,
};
```

- [ ] **Step 6: `frontend/src/App.tsx` erstellen**

```tsx
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';

function Header() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
      <button onClick={() => navigate('/')} className="font-display text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--c-text)' }}>
        Nachschreiber
      </button>
      <button onClick={toggleDark} className="text-sm px-3 py-1 rounded-md border" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}>
        {dark ? '☀️' : '🌙'}
      </button>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--c-bg)' }}>
        <Header />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Platzhalter-Pages anlegen (damit die App kompiliert)**

```tsx
// frontend/src/pages/UploadPage.tsx
export default function UploadPage() {
  return <div className="p-8">Upload (coming soon)</div>;
}
```

```tsx
// frontend/src/pages/DashboardPage.tsx
export default function DashboardPage() {
  return <div className="p-8">Dashboard (coming soon)</div>;
}
```

- [ ] **Step 8: Frontend starten und prüfen**

```bash
cd frontend && npm run dev
```

Öffne http://localhost:5173 — erwartet: Header mit „Nachschreiber", Dark-Mode-Toggle funktioniert, Routing auf `/` zeigt Upload-Placeholder.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with design tokens, routing and API client"
```

---

## Task 9: Frontend — Upload Page

**Files:**
- Modify: `frontend/src/pages/UploadPage.tsx`

- [ ] **Step 1: `UploadPage.tsx` implementieren**

```tsx
// frontend/src/pages/UploadPage.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      await api.uploadCsv(file);
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Schülerdaten importieren
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--c-text-secondary)' }}>
            CSV-Datei mit den Spalten <code>Nachname;Vorname;Klasse</code> (Semikolon-getrennt)
          </p>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className="cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors"
          style={{
            borderColor: dragging ? 'var(--c-accent)' : 'var(--c-border)',
            background: dragging ? 'rgba(217,119,6,0.05)' : 'var(--c-surface)',
          }}
        >
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium">CSV-Datei hier ablegen</p>
          <p className="text-sm mt-1" style={{ color: 'var(--c-text-secondary)' }}>oder klicken zum Auswählen</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {loading && <p className="text-center text-sm" style={{ color: 'var(--c-text-secondary)' }}>Wird hochgeladen…</p>}
        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--c-error)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Backend starten und Upload testen**

Terminal 1: `cd backend && uvicorn app.main:app --reload`  
Terminal 2: `cd frontend && npm run dev`

Öffne http://localhost:5173, lade eine CSV hoch — erwartet: Weiterleitung zu `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/UploadPage.tsx
git commit -m "feat: CSV upload page with drag-and-drop"
```

---

## Task 10: Frontend — Dashboard, linke Seite (Student Form)

**Files:**
- Create: `frontend/src/components/StudentForm.tsx`
- Create: `frontend/src/components/ExportButtons.tsx`

- [ ] **Step 1: `ExportButtons.tsx` implementieren**

```tsx
// frontend/src/components/ExportButtons.tsx
import { api } from '../api';

export default function ExportButtons() {
  function download(format: 'excel' | 'word') {
    window.open(api.exportUrl(format), '_blank');
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => download('excel')}
        className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium transition-colors"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)' }}
      >
        📄 Excel
      </button>
      <button
        onClick={() => download('word')}
        className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium transition-colors"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)' }}
      >
        📝 Word
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `StudentForm.tsx` implementieren**

```tsx
// frontend/src/components/StudentForm.tsx
import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Student, EntryCreate } from '../types';

interface Props {
  onEntryAdded: () => void;
}

export default function StudentForm({ onEntryAdded }: Props) {
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [form, setForm] = useState<EntryCreate>({
    student_id: '', subject: '', duration_minutes: 45, aids: '', teacher: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getClasses().then(setClasses); }, []);

  useEffect(() => {
    if (selectedClass) {
      api.getStudents(selectedClass).then(setStudents);
      setForm(f => ({ ...f, student_id: '' }));
    }
  }, [selectedClass]);

  function set<K extends keyof EntryCreate>(key: K, value: EntryCreate[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createEntry(form);
      setForm(f => ({ ...f, student_id: '', subject: '', aids: '' }));
      onEntryAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: 'var(--c-bg)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text)',
    borderRadius: '6px',
    padding: '6px 10px',
    width: '100%',
    fontSize: '0.875rem',
  } as const;

  const labelStyle = { fontSize: '0.75rem', color: 'var(--c-text-secondary)', marginBottom: '3px', display: 'block' } as const;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 h-full">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
        Schüler hinzufügen
      </p>

      <div>
        <label style={labelStyle}>Klasse</label>
        <select style={inputStyle} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} required>
          <option value="">— Klasse wählen —</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Schüler</label>
        <select style={inputStyle} value={form.student_id} onChange={e => set('student_id', e.target.value)} required disabled={!selectedClass}>
          <option value="">— Schüler wählen —</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Fach</label>
        <input style={inputStyle} value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="z.B. Mathematik" required />
      </div>

      <div>
        <label style={labelStyle}>Dauer (Minuten)</label>
        <input style={inputStyle} type="number" min={1} max={300} value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))} required />
        <p className="text-xs mt-1" style={{ color: 'var(--c-text-secondary)' }}>
          ≤45 → Raum A · 46–59 → Raum B · ≥60 → Raum C
        </p>
      </div>

      <div>
        <label style={labelStyle}>Hilfsmittel</label>
        <input style={inputStyle} value={form.aids} onChange={e => set('aids', e.target.value)} placeholder="z.B. Taschenrechner" />
      </div>

      <div>
        <label style={labelStyle}>Verantw. Lehrkraft</label>
        <input style={inputStyle} value={form.teacher} onChange={e => set('teacher', e.target.value)} placeholder="z.B. Fr. Schmidt" required />
      </div>

      {error && (
        <div className="text-xs rounded p-2" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--c-error)' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-auto py-2 px-4 rounded-lg font-semibold text-sm text-white transition-opacity disabled:opacity-50"
        style={{ background: 'var(--c-accent)' }}
      >
        {loading ? 'Wird eingetragen…' : '+ Schüler eintragen'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StudentForm.tsx frontend/src/components/ExportButtons.tsx
git commit -m "feat: student entry form and export buttons"
```

---

## Task 11: Frontend — Dashboard, rechte Seite (Seating Grid) + Zusammenbau

**Files:**
- Create: `frontend/src/components/SeatingGrid.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: `SeatingGrid.tsx` implementieren**

```tsx
// frontend/src/components/SeatingGrid.tsx
import { useState } from 'react';
import type { SeatingPlan, RoomPlan, SeatAssignment } from '../types';

interface Props {
  plan: SeatingPlan;
  onDeleteEntry: (entryId: string) => void;
}

function DeskCard({ desk, assignments }: { desk: number; assignments: (SeatAssignment | null)[] }) {
  const hasOccupied = assignments.some(Boolean);
  return (
    <div
      className="rounded-lg p-2 text-xs"
      style={{
        background: 'var(--c-surface)',
        border: `1px ${hasOccupied ? 'solid' : 'dashed'} ${hasOccupied ? 'var(--c-accent)' : 'var(--c-border)'}`,
      }}
    >
      <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--c-text-secondary)', fontSize: '0.65rem' }}>
        Tisch {desk}
      </p>
      {assignments.map((a, i) => (
        <div
          key={i}
          className="rounded px-1.5 py-1 mb-0.5"
          style={{
            background: a ? 'var(--c-bg)' : undefined,
            border: a ? undefined : '1px dashed var(--c-border)',
            color: a ? 'var(--c-text)' : 'var(--c-muted)',
            minHeight: '2rem',
          }}
        >
          {a ? (
            <>
              <p className="font-semibold truncate" style={{ fontSize: '0.7rem' }}>{a.student.last_name}, {a.student.first_name}</p>
              <p className="truncate" style={{ fontSize: '0.65rem', color: 'var(--c-text-secondary)' }}>
                {a.student.class_name} · {a.entry.subject} · {a.entry.duration_minutes} min
              </p>
            </>
          ) : (
            <p className="text-center" style={{ fontSize: '0.65rem' }}>frei</p>
          )}
        </div>
      ))}
    </div>
  );
}

function RoomGrid({ room_plan }: { room_plan: RoomPlan }) {
  const assignmentMap = new Map<string, SeatAssignment>();
  for (const a of room_plan.assignments) {
    assignmentMap.set(`${a.desk}-${a.seat}`, a);
  }

  const desks = Array.from({ length: 16 }, (_, i) => {
    const desk = i + 1;
    return {
      desk,
      seats: [
        assignmentMap.get(`${desk}-1`) ?? null,
        assignmentMap.get(`${desk}-2`) ?? null,
      ],
    };
  });

  return (
    <div className="grid grid-cols-4 gap-2">
      {desks.map(({ desk, seats }) => (
        <DeskCard key={desk} desk={desk} assignments={seats} />
      ))}
    </div>
  );
}

export default function SeatingGrid({ plan, onDeleteEntry }: Props) {
  const [activeRoom, setActiveRoom] = useState<'room_a' | 'room_b' | 'room_c'>('room_a');

  const rooms: { key: 'room_a' | 'room_b' | 'room_c'; label: string }[] = [
    { key: 'room_a', label: 'Raum A' },
    { key: 'room_b', label: 'Raum B' },
    { key: 'room_c', label: 'Raum C' },
  ];

  const active = plan[activeRoom];

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex gap-2">
        {rooms.map(({ key, label }) => {
          const count = plan[key].assignments.length;
          const isActive = activeRoom === key;
          return (
            <button
              key={key}
              onClick={() => setActiveRoom(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? 'var(--c-accent)' : 'var(--c-surface)',
                color: isActive ? 'white' : 'var(--c-text-secondary)',
                border: isActive ? 'none' : '1px solid var(--c-border)',
              }}
            >
              {label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--c-bg)' }}
              >
                {count}/32
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
        {active.label} · {active.assignments.length} Schüler
      </p>

      <div className="overflow-y-auto flex-1">
        <RoomGrid room_plan={active} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `DashboardPage.tsx` zusammenbauen**

```tsx
// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SeatingPlan } from '../types';
import StudentForm from '../components/StudentForm';
import SeatingGrid from '../components/SeatingGrid';
import ExportButtons from '../components/ExportButtons';

const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', label: '≥ 60 min', capacity: 32, assignments: [] },
};

export default function DashboardPage() {
  const [plan, setPlan] = useState<SeatingPlan>(EMPTY_PLAN);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      setPlan(await api.getSeating());
    } catch {
      // session might be empty on first load
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleReset() {
    if (!confirm('Alle Einträge löschen? Die Stammdaten bleiben erhalten.')) return;
    await api.reset();
    await refresh();
  }

  async function handleDeleteEntry(entryId: string) {
    await api.deleteEntry(entryId);
    await refresh();
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left panel */}
      <div
        className="w-80 shrink-0 flex flex-col p-4 gap-4 border-r overflow-y-auto"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
      >
        <StudentForm onEntryAdded={refresh} />

        <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--c-border)' }}>
          <ExportButtons />
          <button
            onClick={handleReset}
            className="w-full text-sm py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}
          >
            Neue Sitzung
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full text-sm py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}
          >
            ← Neue CSV hochladen
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 p-4 overflow-hidden">
        <SeatingGrid plan={plan} onDeleteEntry={handleDeleteEntry} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: End-to-End-Test im Browser**

Backend und Frontend müssen laufen:
```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

Ablauf:
1. http://localhost:5173 öffnen
2. CSV hochladen (Nachname;Vorname;Klasse)
3. Im Dashboard Klasse wählen, Schüler wählen, Fach + Dauer + Lehrkraft eintragen
4. „Schüler eintragen" klicken → Sitzgitter rechts aktualisiert sich
5. Eintrag mit 60 min → Raum C-Tab zeigt den Schüler
6. Duplikat eingeben → Fehlermeldung erscheint
7. Excel-/Word-Button → Datei wird heruntergeladen

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SeatingGrid.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: live seating grid and complete dashboard"
```

---

## Task 12: Docker & Deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `docker-compose.yml`

- [ ] **Step 1: `backend/Dockerfile` erstellen**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
RUN useradd -m appuser && chown -R appuser /app
USER appuser
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: `frontend/nginx.conf` erstellen**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: `frontend/Dockerfile` erstellen**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 4: `docker-compose.yml` erstellen**

```yaml
services:
  backend:
    build: ./backend
    volumes:
      - nachschreiber_data:/data
    environment:
      - DATA_DIR=/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3002:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  nachschreiber_data:
```

- [ ] **Step 5: Docker-Build testen**

```bash
docker compose up -d --build
```

Expected: beide Container starten ohne Fehler.

```bash
docker compose ps
```

Expected: beide Services `running`.

- [ ] **Step 6: App im Browser testen**

Öffne http://localhost:3002 — gleicher Flow wie in Task 11 Step 3, diesmal aber über Docker (nginx → backend).

- [ ] **Step 7: Auf dem Raspberry Pi deployen**

```bash
# Auf dem Raspberry Pi (192.168.2.54):
git clone https://github.com/<dein-user>/Nachschreiber.git
cd Nachschreiber
docker compose up -d --build
```

Öffne http://192.168.2.54:3002 von außen.

- [ ] **Step 8: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf docker-compose.yml
git commit -m "feat: Docker Compose deployment on port 3002"
```

---

## Task 13: Schulportal (separates Repository)

> **Hinweis:** Das Schulportal ist ein eigenständiges GitHub-Repo (`Schulportal`). Es enthält nur einen minimalen nginx-Container mit einer statischen Landing Page.

**Files (neues Repo):**
- `index.html` — Landing Page
- `nginx.conf` — nginx-Konfiguration
- `Dockerfile` — nginx-Image
- `docker-compose.yml`

- [ ] **Step 1: Neues Verzeichnis und Git-Repo anlegen**

```bash
mkdir ~/Documents/Github/Schulportal && cd ~/Documents/Github/Schulportal
git init
```

- [ ] **Step 2: `index.html` erstellen**

Gleiche Design-Sprache wie die Apps (DM Sans, Bricolage Grotesque, Amber-Akzent, Dark Mode):

```html
<!doctype html>
<html lang="de" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Schulportal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root { --accent: #d97706; --bg: #faf9f6; --surface: #fff; --text: #1c1917; --sub: #78716c; --border: #e5e0d8; }
    .dark { --accent: #f59e0b; --bg: #0f0e0d; --surface: #1c1917; --text: #fafaf9; --sub: #a8a29e; --border: #292524; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; }
    h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 2.5rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--sub); margin-bottom: 3rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; width: 100%; max-width: 800px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; text-decoration: none; color: var(--text); transition: border-color 0.2s, transform 0.2s; }
    .card:hover { border-color: var(--accent); transform: translateY(-2px); }
    .card-icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .card-title { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    .card-desc { color: var(--sub); font-size: 0.9rem; line-height: 1.5; }
    .toggle { position: fixed; top: 1rem; right: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 1rem; color: var(--text); }
  </style>
</head>
<body>
  <button class="toggle" onclick="toggleDark()">☀️</button>
  <h1>Schulportal</h1>
  <p class="subtitle">Interne Werkzeuge für Lehrkräfte</p>
  <div class="grid">
    <a class="card" href="http://192.168.2.54:3001">
      <div class="card-icon">📚</div>
      <div class="card-title">Kurswahl</div>
      <div class="card-desc">Automatische Kurszuweisung für Schüler per Optimierungsalgorithmus.</div>
    </a>
    <a class="card" href="http://192.168.2.54:3002">
      <div class="card-icon">✏️</div>
      <div class="card-title">Nachschreiber</div>
      <div class="card-desc">Sitzplanerstellung und Raumverwaltung für Nachschreibtermine.</div>
    </a>
  </div>
  <script>
    (function () {
      const dark = localStorage.getItem('theme') !== 'light';
      document.documentElement.classList.toggle('dark', dark);
    })();
    function toggleDark() {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
  </script>
</body>
</html>
```

- [ ] **Step 3: `nginx.conf` erstellen**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
```

- [ ] **Step 4: `Dockerfile` erstellen**

```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 5: `docker-compose.yml` erstellen**

```yaml
services:
  portal:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
```

- [ ] **Step 6: Lokal testen**

```bash
docker compose up -d --build
```

Öffne http://localhost:80 — erwartet: Landing Page mit zwei Karten (Kurswahl, Nachschreiber), Dark Mode, Hover-Effekt.

- [ ] **Step 7: Commit und GitHub-Push**

```bash
git add .
git commit -m "feat: Schulportal landing page"
# Auf GitHub neues öffentliches Repo 'Schulportal' anlegen, dann:
git remote add origin https://github.com/<dein-user>/Schulportal.git
git push -u origin main
```

- [ ] **Step 8: Auf dem Raspberry Pi deployen**

```bash
# Bestehenden Port 80 prüfen — falls Kurswahl oder anderer Dienst auf 80 läuft, zuerst umlegen
git clone https://github.com/<dein-user>/Schulportal.git
cd Schulportal
docker compose up -d --build
```

---

## Abschluss

Nach Abschluss aller Tasks:

- [ ] Alle Backend-Tests nochmal durchlaufen: `cd backend && pytest ../tests/ -v`
- [ ] `docker compose up -d --build` im Nachschreiber-Verzeichnis
- [ ] Nachschreiber auf GitHub pushen: `git remote add origin https://github.com/<dein-user>/Nachschreiber.git && git push -u origin main`
- [ ] Auf dem Pi: beide Container (Nachschreiber + Schulportal) laufen und von außen erreichbar
