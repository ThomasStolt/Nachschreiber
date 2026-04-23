# Sprint 4 — Import Lehrer + Fächer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV-based imports for teachers and subjects. Surface them as autocomplete suggestions in the entry form while keeping free-text entry possible.

**Architecture:** Extend `SessionData` with two optional string lists. Two parsers (`parse_teachers`, `parse_subjects`) next to the existing `parse_students`. Two new upload endpoints that only touch their own list (no entry/student reset). Two GET endpoints to read them. Frontend: extend UploadPage with two more upload boxes (optional), extend StudentForm to use a `<datalist>` for subject and teacher inputs.

**Tech Stack:** FastAPI, Pydantic v2, React 18 / TypeScript, pytest.

**Spec:** `docs/superpowers/specs/2026-04-23-sprint4-import-lehrer-faecher-design.md`

---

## File Structure

- **Modify:** `backend/app/models.py` — add `teachers`, `subjects` to `SessionData`.
- **Modify:** `backend/app/parser.py` — add `parse_teachers`, `parse_subjects`.
- **Modify:** `backend/app/routers/upload.py` — add two endpoints.
- **Modify:** `backend/app/routers/misc.py` — add `GET /api/teachers`, `GET /api/subjects`.
- **Modify:** `tests/test_parser.py` — add tests for both parsers.
- **Modify:** `tests/test_api.py` — add tests for the four new endpoints and the non-reset behavior.
- **Modify:** `frontend/src/api.ts` — add `uploadTeachers`, `uploadSubjects`, `getTeachers`, `getSubjects`.
- **Modify:** `frontend/src/pages/UploadPage.tsx` — add two optional upload sections.
- **Modify:** `frontend/src/components/StudentForm.tsx` — load lists, add datalists.
- **Create:** `beispiel_lehrer.csv` (project root)
- **Create:** `beispiel_faecher.csv` (project root)

---

## Task 1: Extend SessionData model

**Files:**
- Modify: `backend/app/models.py:62-64`

- [ ] **Step 1: Add teachers and subjects lists to `SessionData`**

Replace the current `SessionData` block at the end of `backend/app/models.py` with:

```python
class SessionData(BaseModel):
    students: list[Student] = []
    entries: list[Entry] = []
    teachers: list[str] = []
    subjects: list[str] = []
```

- [ ] **Step 2: Run tests to confirm nothing broke**

Run: `cd backend && pytest ../tests/ -v`
Expected: all existing tests still pass. Pydantic v2 fills missing fields with defaults on load, so old session files remain readable.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models.py
git commit -m "feat(models): add teachers/subjects lists to SessionData"
```

---

## Task 2: Write failing tests for `parse_teachers` / `parse_subjects`

**Files:**
- Modify: `tests/test_parser.py`

- [ ] **Step 1: Append parser tests to `tests/test_parser.py`**

Add to the end of the file:

```python
from app.parser import parse_teachers, parse_subjects


# --- parse_teachers ---

def test_parse_teachers_valid():
    csv = b"Lehrkraft\nFr. Schmidt\nHr. Mueller\n"
    result = parse_teachers(csv)
    assert result == ["Fr. Schmidt", "Hr. Mueller"]


def test_parse_teachers_bom():
    csv = b"\xef\xbb\xbfLehrkraft\nFr. Schmidt\n"
    assert parse_teachers(csv) == ["Fr. Schmidt"]


def test_parse_teachers_trims_whitespace():
    csv = b"Lehrkraft\n  Fr. Schmidt  \n"
    assert parse_teachers(csv) == ["Fr. Schmidt"]


def test_parse_teachers_dedupes_preserving_order():
    csv = b"Lehrkraft\nFr. Schmidt\nHr. Mueller\nFr. Schmidt\n"
    assert parse_teachers(csv) == ["Fr. Schmidt", "Hr. Mueller"]


def test_parse_teachers_skips_blank_lines():
    csv = b"Lehrkraft\nFr. Schmidt\n\n   \nHr. Mueller\n"
    assert parse_teachers(csv) == ["Fr. Schmidt", "Hr. Mueller"]


def test_parse_teachers_empty_raises():
    with pytest.raises(ValueError, match="keine Lehrkräfte"):
        parse_teachers(b"Lehrkraft\n")


def test_parse_teachers_wrong_header_raises():
    with pytest.raises(ValueError, match="Erwartet: Lehrkraft"):
        parse_teachers(b"Name\nFr. Schmidt\n")


def test_parse_teachers_header_case_insensitive():
    csv = b"lehrkraft\nFr. Schmidt\n"
    assert parse_teachers(csv) == ["Fr. Schmidt"]


# --- parse_subjects ---

def test_parse_subjects_valid():
    csv = b"Fach\nMathematik\nDeutsch\n"
    assert parse_subjects(csv) == ["Mathematik", "Deutsch"]


def test_parse_subjects_bom():
    csv = b"\xef\xbb\xbfFach\nMathematik\n"
    assert parse_subjects(csv) == ["Mathematik"]


def test_parse_subjects_trims_and_dedupes():
    csv = b"Fach\n  Mathematik  \nDeutsch\nMathematik\n"
    assert parse_subjects(csv) == ["Mathematik", "Deutsch"]


def test_parse_subjects_empty_raises():
    with pytest.raises(ValueError, match="keine Fächer"):
        parse_subjects(b"Fach\n")


def test_parse_subjects_wrong_header_raises():
    with pytest.raises(ValueError, match="Erwartet: Fach"):
        parse_subjects(b"Subject\nMath\n")
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run: `cd backend && pytest ../tests/test_parser.py -v`
Expected: all new tests FAIL with `ImportError` (functions don't exist yet).

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/test_parser.py
git commit -m "test: failing tests for parse_teachers/parse_subjects"
```

---

## Task 3: Implement `parse_teachers` / `parse_subjects`

**Files:**
- Modify: `backend/app/parser.py`

- [ ] **Step 1: Add a shared helper and the two public functions**

Append to `backend/app/parser.py`:

```python
def _parse_single_column(content: bytes, expected_header: str, label: str) -> list[str]:
    text = content.decode("utf-8-sig", errors="replace")
    lines = [ln.strip() for ln in text.splitlines()]
    # Drop leading blank lines
    while lines and not lines[0]:
        lines.pop(0)
    if not lines:
        raise ValueError(f"Ungültiges CSV. Erwartet: {expected_header}")
    header = lines[0].strip()
    # Allow exactly one column; also tolerate trailing delimiters ("Lehrkraft;")
    header_clean = header.split(";")[0].strip().lower()
    if header_clean != expected_header.lower():
        raise ValueError(f"Ungültiger Header {header!r}. Erwartet: {expected_header}")
    values: list[str] = []
    seen: set[str] = set()
    for ln in lines[1:]:
        v = ln.split(";")[0].strip()
        if not v:
            continue
        if v in seen:
            continue
        seen.add(v)
        values.append(v)
    if not values:
        raise ValueError(f"CSV enthält keine {label}")
    return values


def parse_teachers(content: bytes) -> list[str]:
    return _parse_single_column(content, expected_header="Lehrkraft", label="Lehrkräfte")


def parse_subjects(content: bytes) -> list[str]:
    return _parse_single_column(content, expected_header="Fach", label="Fächer")
```

- [ ] **Step 2: Run parser tests to verify they pass**

Run: `cd backend && pytest ../tests/test_parser.py -v`
Expected: all 13 parser tests pass.

- [ ] **Step 3: Run full test suite**

Run: `cd backend && pytest ../tests/ -v`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/app/parser.py
git commit -m "feat(parser): parse_teachers and parse_subjects"
```

---

## Task 4: Write failing tests for the new upload and GET endpoints

**Files:**
- Modify: `tests/test_api.py`

- [ ] **Step 1: Append endpoint tests**

Add to the end of `tests/test_api.py`:

```python
TEACHERS_CSV = b"Lehrkraft\nFr. Schmidt\nHr. Mueller\n"
SUBJECTS_CSV = b"Fach\nMathematik\nDeutsch\n"


def test_upload_teachers(client):
    r = client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    assert r.status_code == 200
    assert r.json()["teachers"] == 2


def test_upload_teachers_invalid_header(client):
    r = client.post("/api/upload/teachers", files={"file": ("l.csv", b"Name\nFoo\n", "text/csv")})
    assert r.status_code == 422
    assert "Erwartet: Lehrkraft" in r.json()["detail"]


def test_upload_subjects(client):
    r = client.post("/api/upload/subjects", files={"file": ("f.csv", SUBJECTS_CSV, "text/csv")})
    assert r.status_code == 200
    assert r.json()["subjects"] == 2


def test_upload_subjects_invalid_header(client):
    r = client.post("/api/upload/subjects", files={"file": ("f.csv", b"Subject\nMath\n", "text/csv")})
    assert r.status_code == 422


def test_get_teachers_empty(client):
    assert client.get("/api/teachers").json() == []


def test_get_subjects_empty(client):
    assert client.get("/api/subjects").json() == []


def test_get_teachers_after_upload(client):
    client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    assert client.get("/api/teachers").json() == ["Fr. Schmidt", "Hr. Mueller"]


def test_get_subjects_after_upload(client):
    client.post("/api/upload/subjects", files={"file": ("f.csv", SUBJECTS_CSV, "text/csv")})
    assert client.get("/api/subjects").json() == ["Mathematik", "Deutsch"]


def test_upload_teachers_does_not_reset_students_or_entries(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    assert len(client.get("/api/students").json()) == 2
    assert len(client.get("/api/entries").json()) == 1


def test_upload_subjects_does_not_reset_students_or_entries(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    client.post("/api/upload/subjects", files={"file": ("f.csv", SUBJECTS_CSV, "text/csv")})
    assert len(client.get("/api/students").json()) == 2
    assert len(client.get("/api/entries").json()) == 1


def test_upload_teachers_overwrites_previous(client):
    client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    newer = b"Lehrkraft\nFr. Weber\n"
    client.post("/api/upload/teachers", files={"file": ("l.csv", newer, "text/csv")})
    assert client.get("/api/teachers").json() == ["Fr. Weber"]
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd backend && pytest ../tests/test_api.py -v -k "teachers or subjects"`
Expected: all new tests fail with 404 (endpoints don't exist yet) or 405.

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/test_api.py
git commit -m "test: failing tests for teacher/subject upload + GET endpoints"
```

---

## Task 5: Implement the new upload endpoints

**Files:**
- Modify: `backend/app/routers/upload.py`

- [ ] **Step 1: Replace the file with both old and new endpoints**

Full new content for `backend/app/routers/upload.py`:

```python
# backend/app/routers/upload.py
from fastapi import APIRouter, HTTPException, UploadFile, File
from ..parser import parse_students, parse_teachers, parse_subjects
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
```

- [ ] **Step 2: Run the upload tests**

Run: `cd backend && pytest ../tests/test_api.py -v -k "teachers or subjects"`
Expected: upload tests pass; GET tests still fail (GET endpoints not implemented yet).

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/upload.py
git commit -m "feat(api): POST /api/upload/teachers and /api/upload/subjects"
```

---

## Task 6: Implement GET /api/teachers and /api/subjects

**Files:**
- Modify: `backend/app/routers/misc.py`

- [ ] **Step 1: Add the GET endpoints**

Full new content for `backend/app/routers/misc.py`:

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


@router.get("/teachers")
def get_teachers() -> list[str]:
    return load().teachers


@router.get("/subjects")
def get_subjects() -> list[str]:
    return load().subjects
```

- [ ] **Step 2: Run the full test suite**

Run: `cd backend && pytest ../tests/ -v`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/misc.py
git commit -m "feat(api): GET /api/teachers and /api/subjects"
```

---

## Task 7: Extend frontend `api.ts`

**Files:**
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Add the four new API methods**

Replace the entire `export const api = {...}` block with:

```typescript
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
  uploadTeachers: async (file: File): Promise<{ teachers: number }> => {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch('/api/upload/teachers', { method: 'POST', body: form });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
  },
  uploadSubjects: async (file: File): Promise<{ subjects: number }> => {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch('/api/upload/subjects', { method: 'POST', body: form });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
  },
  getClasses: () => request<string[]>('/api/classes'),
  getStudents: (className?: string) =>
    request<Student[]>(className ? `/api/students?class_name=${encodeURIComponent(className)}` : '/api/students'),
  getTeachers: () => request<string[]>('/api/teachers'),
  getSubjects: () => request<string[]>('/api/subjects'),
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

- [ ] **Step 2: Typecheck the frontend**

Run: `cd frontend && npm run build`
Expected: build succeeds without type errors. If it fails, fix reported type issues inline before continuing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(api): add frontend bindings for teachers/subjects"
```

---

## Task 8: Extend UploadPage with optional teacher/subject imports

**Files:**
- Modify: `frontend/src/pages/UploadPage.tsx`

- [ ] **Step 1: Rewrite UploadPage**

Replace the entire file with:

```tsx
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

type OptionalStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; msg: string } | { kind: 'err'; msg: string };

function OptionalUpload({
  title,
  hint,
  accept,
  onUpload,
}: {
  title: string;
  hint: string;
  accept: string;
  onUpload: (file: File) => Promise<string>;
}) {
  const [status, setStatus] = useState<OptionalStatus>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(file: File) {
    setStatus({ kind: 'loading' });
    try {
      const msg = await onUpload(file);
      setStatus({ kind: 'ok', msg });
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
    }
  }

  return (
    <div className="rounded-lg p-4" style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--c-accent)', color: 'white' }}
        >
          CSV wählen
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ''; }}
        />
      </div>
      {status.kind === 'loading' && (
        <p className="mt-2 text-xs" style={{ color: 'var(--c-text-secondary)' }}>Wird hochgeladen…</p>
      )}
      {status.kind === 'ok' && (
        <p className="mt-2 text-xs" style={{ color: 'var(--c-accent)' }}>✓ {status.msg}</p>
      )}
      {status.kind === 'err' && (
        <p className="mt-2 text-xs" style={{ color: 'var(--c-error)' }}>{status.msg}</p>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentsOk, setStudentsOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const r = await api.uploadCsv(file);
      setStudentsOk(true);
      // Do not auto-navigate — user may also upload teachers/subjects now.
      return r;
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
        {studentsOk && (
          <p className="text-center text-sm" style={{ color: 'var(--c-accent)' }}>✓ Schülerliste importiert</p>
        )}
        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--c-error)' }}>
            {error}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            Optionale Listen
          </p>
          <OptionalUpload
            title="Lehrkräfte-Liste"
            hint="CSV mit Spalte »Lehrkraft« — für Autocomplete im Formular"
            accept=".csv"
            onUpload={async (f) => {
              const r = await api.uploadTeachers(f);
              return `${r.teachers} Lehrkräfte importiert`;
            }}
          />
          <OptionalUpload
            title="Fächer-Liste"
            hint="CSV mit Spalte »Fach« — für Autocomplete im Formular"
            accept=".csv"
            onUpload={async (f) => {
              const r = await api.uploadSubjects(f);
              return `${r.subjects} Fächer importiert`;
            }}
          />
        </div>

        {studentsOk && (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-lg py-2 px-4 font-semibold text-sm"
            style={{ background: 'var(--c-accent)', color: 'white' }}
          >
            Weiter zum Dashboard →
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build the frontend**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/UploadPage.tsx
git commit -m "feat(ui): optional teacher/subject CSV uploads on UploadPage"
```

---

## Task 9: Add datalist autocomplete to StudentForm

**Files:**
- Modify: `frontend/src/components/StudentForm.tsx`

- [ ] **Step 1: Load lists and bind datalists to the subject/teacher inputs**

Edit `frontend/src/components/StudentForm.tsx`:

Immediately after the `const [loading, setLoading] = useState(false);` line (line 19), add two state hooks:

```tsx
  const [teachers, setTeachers] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
```

Replace the existing `useEffect(() => { api.getClasses().then(setClasses); }, []);` block with:

```tsx
  useEffect(() => {
    api.getClasses().then(setClasses);
    api.getTeachers().then(setTeachers);
    api.getSubjects().then(setSubjects);
  }, []);
```

Change the subject input block (the one with `placeholder="z.B. Mathematik"`) to:

```tsx
      <div>
        <label style={labelStyle}>Fach</label>
        <input
          style={inputStyle}
          list="subject-options"
          value={form.subject}
          onChange={e => set('subject', e.target.value)}
          placeholder="z.B. Mathematik"
          required
        />
        <datalist id="subject-options">
          {subjects.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>
```

Change the teacher input block (the one with `placeholder="z.B. Fr. Schmidt"`) to:

```tsx
      <div>
        <label style={labelStyle}>Verantw. Lehrkraft</label>
        <input
          style={inputStyle}
          list="teacher-options"
          value={form.teacher}
          onChange={e => set('teacher', e.target.value)}
          placeholder="z.B. Fr. Schmidt"
          required
        />
        <datalist id="teacher-options">
          {teachers.map(t => <option key={t} value={t} />)}
        </datalist>
      </div>
```

- [ ] **Step 2: Typecheck + build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StudentForm.tsx
git commit -m "feat(ui): datalist autocomplete for Fach + Lehrkraft"
```

---

## Task 10: Add example CSVs

**Files:**
- Create: `beispiel_lehrer.csv`
- Create: `beispiel_faecher.csv`

- [ ] **Step 1: Create `beispiel_lehrer.csv`**

Contents:

```
Lehrkraft
Fr. Schmidt
Hr. Müller
Fr. Dr. Weber
Hr. Becker
Fr. Wagner
Hr. Fischer
Fr. Meyer
Hr. Hoffmann
```

- [ ] **Step 2: Create `beispiel_faecher.csv`**

Contents:

```
Fach
Mathematik
Deutsch
Englisch
Französisch
Biologie
Chemie
Physik
Geschichte
Erdkunde
Politik
Religion
Sport
Kunst
Musik
Informatik
```

- [ ] **Step 3: Commit**

```bash
git add beispiel_lehrer.csv beispiel_faecher.csv
git commit -m "docs: sample teacher + subject CSVs"
```

---

## Task 11: Final integration check

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && pytest ../tests/ -v`
Expected: all tests pass.

- [ ] **Step 2: Build the frontend**

Run: `cd frontend && npm run build`
Expected: build succeeds.

Nothing to commit (verification only). If anything fails, fix inline before handing off to deploy.

---

## Self-Review Notes

- Spec coverage: CSV format ✅ (Task 3), SessionData fields ✅ (Task 1), POST endpoints ✅ (Task 5), GET endpoints ✅ (Task 6), UploadPage extension ✅ (Task 8), datalist UX ✅ (Task 9), sample CSVs ✅ (Task 10), tests ✅ (Tasks 2, 4), non-reset behavior ✅ (Task 4).
- Placeholder scan: no TBDs; all code blocks complete.
- Type consistency: `list[str]` for teachers/subjects throughout backend; frontend `string[]`; `uploadTeachers` returns `{ teachers: number }`, `uploadSubjects` returns `{ subjects: number }`.
- TDD: failing tests before implementation for parsers (Task 2 → 3) and endpoints (Task 4 → 5 → 6).
