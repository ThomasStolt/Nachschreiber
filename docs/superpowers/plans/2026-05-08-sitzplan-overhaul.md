# Sitzplan-Überarbeitung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sitzplan-Feature überarbeiten: Tisch-Nummerierung umkehren (Tisch 1 unten rechts), Clipboard/Schere entfernen, Schüler-Löschen nur aus Sitzplan, Inline-Raumnamen-Edit per Stift, neue Defaults `Raum 1/2/3`, aktiver Reiter rahmt das Panel ein.

**Architecture:** Storage-Modell (`Entry.desk: 1..16`) und Auto-Belegung bleiben unverändert. Renumber ist rein eine Render-Mapping-Änderung in `SeatingGrid.tsx` (frontend) und `_render_room_grid` (Excel). Clipboard war nur Frontend-State — komplett entfernbar. Delete-Button schaltet von `api.deleteStudent` auf `api.deleteEntry` um. Inline-Rename nutzt den existierenden `PUT /api/room-labels` Endpunkt.

**Tech Stack:** Python 3.12+ / FastAPI / pytest (Backend); React 18 / TypeScript / Vite / @dnd-kit (Frontend); openpyxl / python-docx (Export).

**Spec:** `docs/superpowers/specs/2026-05-08-sitzplan-overhaul-design.md`

---

## File Structure

**Backend (Python):**
- Modify: `backend/app/models.py` — `RoomLabels` Defaults `Raum 1/2/3`
- Modify: `backend/app/exporter.py` — `_render_room_grid` Mapping desk → grid-position
- Modify: `tests/test_api.py` — Defaults-Assertions
- Modify: `tests/test_exporter.py` — Sheet-Namen + Cell-Position Assertions

**Frontend (TypeScript / React):**
- Modify: `frontend/src/pages/UploadPage.tsx` — `DEFAULT_ROOM_LABELS`
- Modify: `frontend/src/pages/DashboardPage.tsx` — `EMPTY_PLAN`, Clipboard-Cleanup, `handleRenameRoom`, Delete-Verhalten
- Modify: `frontend/src/components/SeatingGrid.tsx` — Großteil der Änderungen (Clipboard raus, Render-Mapping, Tab-Frame, Inline-Rename)

Keine neuen Dateien, keine neuen API-Routen.

---

## Task 1: Backend — neue Default-Raumnamen `Raum 1/2/3`

**Files:**
- Modify: `backend/app/models.py:63-66`
- Modify: `tests/test_api.py:401-417`
- Modify: `tests/test_exporter.py:31, 39, 41, 51, 67, 78, 89, 103`

- [ ] **Step 1: Tests auf neue Defaults aktualisieren (rot werden lassen)**

In `tests/test_api.py`:
- Zeile 404 (`test_get_room_labels_defaults`): von `{"A": "Raum A", "B": "Raum B", "C": "Raum C"}` zu `{"A": "Raum 1", "B": "Raum 2", "C": "Raum 3"}`
- Zeile 417 (`test_put_room_labels_blank_falls_back_to_default`): erwartete Werte von `{"A": "Raum A", "B": "Raum B", "C": "Aula"}` zu `{"A": "Raum 1", "B": "Raum 2", "C": "Aula"}`

In `tests/test_exporter.py`:
- Zeile 31: `{"Raum A", "Raum B", "Raum C"}` → `{"Raum 1", "Raum 2", "Raum 3"}`
- Zeile 39: `wb["Raum A"]` → `wb["Raum 1"]`
- Zeile 41: `"Raum A" in (ws.cell(1, 1).value or "")` → `"Raum 1" in (ws.cell(1, 1).value or "")`
- Zeile 51, 67, 78, 89: `wb["Raum A"]` → `wb["Raum 1"]`
- Zeile 103: `("Raum A", "Raum B", "Raum C")` → `("Raum 1", "Raum 2", "Raum 3")`

- [ ] **Step 2: Tests laufen lassen — sollten fehlschlagen**

```bash
cd backend && pytest ../tests/test_api.py ../tests/test_exporter.py -v
```

Erwartet: FAIL für `test_get_room_labels_defaults`, `test_put_room_labels_blank_falls_back_to_default`, alle Excel-Tests die Sheet-Namen erwarten.

- [ ] **Step 3: Defaults in `models.py` ändern**

In `backend/app/models.py`, ersetze:

```python
class RoomLabels(BaseModel):
    A: str = "Raum A"
    B: str = "Raum B"
    C: str = "Raum C"
```

durch:

```python
class RoomLabels(BaseModel):
    A: str = "Raum 1"
    B: str = "Raum 2"
    C: str = "Raum 3"
```

- [ ] **Step 4: Bestehende Session-Datei kontrollieren (nur falls vorhanden)**

```bash
ls -la data/ 2>/dev/null
```

Falls `data/session.json` existiert: prüfen ob `room_labels` darin gespeichert sind. Falls ja, bleiben sie unverändert (überschreiben Defaults). Falls Du auf grüner Wiese testen willst: `rm data/session.json` (nur lokal, nicht in Tests). Tests nutzen ihre eigene `conftest.py`-Fixture.

- [ ] **Step 5: Tests laufen lassen — sollten grün werden**

```bash
cd backend && pytest ../tests/test_api.py ../tests/test_exporter.py -v
```

Erwartet: alle PASS.

- [ ] **Step 6: Volle Test-Suite laufen lassen**

```bash
cd backend && pytest ../tests/ -v
```

Erwartet: alle PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models.py tests/test_api.py tests/test_exporter.py
git commit -m "feat: default room names 'Raum 1/2/3' instead of 'Raum A/B/C'"
```

---

## Task 2: Backend — Excel-Renderer auf neue Tisch-Nummerierung

**Files:**
- Modify: `backend/app/exporter.py:111-141` (`_render_room_grid`)
- Modify: `tests/test_exporter.py:45-95`

**Mapping** (gilt für Excel und später Frontend):

```
Tisch 16  Tisch 15  Tisch 14  Tisch 13     ← Excel-Row 4 (oben, Lehrpult-Seite)
Tisch 12  Tisch 11  Tisch 10  Tisch 9      ← Excel-Row 5
Tisch  8  Tisch  7  Tisch  6  Tisch  5     ← Excel-Row 6
Tisch  4  Tisch  3  Tisch  2  Tisch  1     ← Excel-Row 7 (unten)
```

Formel: `desk_number = (3 - row_idx) * 4 + (3 - desk_col) + 1`

Konkrete Cell-Mapping (für Tests):
- desk 1, seat 1 → cell (row=7, col=7) — bottom-right desk, linker Platz innerhalb des Tisches
- desk 1, seat 2 → cell (7, 8)
- desk 2, seat 1 → cell (7, 5)
- desk 4, seat 1 → cell (7, 1) — bottom-left desk
- desk 13, seat 1 → cell (4, 7) — top-right desk
- desk 16, seat 1 → cell (4, 1) — top-left desk
- desk 16, seat 2 → cell (4, 2)

- [ ] **Step 1: Tests auf neue Cell-Positionen aktualisieren**

In `tests/test_exporter.py` ersetze die Tests `test_excel_grid_seat_1_1_holds_first_entry`, `test_excel_grid_empty_seat_shows_only_label`, `test_excel_grid_second_desk_first_seat_is_empty_with_label`, `test_excel_grid_last_row_corresponds_to_desks_13_to_16`:

```python
def test_excel_grid_seat_1_1_holds_first_entry():
    # Student at desk=1 seat=1 — desk 1 ist nun unten rechts (row 7, col 7)
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum 1"]
    text = str(ws.cell(7, 7).value or "")
    assert "Müller, Anna" in text
    assert "10a" in text
    assert "Mathematik" in text
    assert "45 min" in text
    assert "Fr. Schmidt" in text
    assert "Taschenrechner" in text


def test_excel_grid_empty_seat_shows_only_label():
    # Desk 1, Seat 2 → row 7, col 8
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum 1"]
    text = str(ws.cell(7, 8).value or "").strip()
    assert text == "T1.S2"


def test_excel_grid_second_desk_first_seat_is_empty_with_label():
    # Desk 2 ist unten zweite-von-rechts → row 7, col 5
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum 1"]
    text = str(ws.cell(7, 5).value or "").strip()
    assert text == "T2.S1"


def test_excel_grid_top_row_corresponds_to_desks_13_to_16():
    # Top row (row 4) hält von links nach rechts: T16 T15 T14 T13
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum 1"]
    # Top-left desk = T16, Seat 1 → row 4, col 1
    assert str(ws.cell(4, 1).value or "").strip() == "T16.S1"
    # Top-left desk = T16, Seat 2 → row 4, col 2
    assert str(ws.cell(4, 2).value or "").strip() == "T16.S2"
    # Top-right desk = T13, Seat 1 → row 4, col 7
    assert str(ws.cell(4, 7).value or "").strip() == "T13.S1"
    # Top-right desk = T13, Seat 2 → row 4, col 8
    assert str(ws.cell(4, 8).value or "").strip() == "T13.S2"


def test_excel_grid_bottom_left_desk_is_t4():
    # Bottom-left desk (row_idx=3, desk_col=0) = T4
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum 1"]
    assert str(ws.cell(7, 1).value or "").strip() == "T4.S1"
    assert str(ws.cell(7, 2).value or "").strip() == "T4.S2"
```

- [ ] **Step 2: Tests laufen lassen — sollten fehlschlagen**

```bash
cd backend && pytest ../tests/test_exporter.py -v
```

Erwartet: FAIL — neue Cell-Positionen stimmen noch nicht mit dem aktuellen Mapping überein.

- [ ] **Step 3: Mapping in `_render_room_grid` umstellen**

In `backend/app/exporter.py`, ersetze die Schleife in `_render_room_grid` (ungefähr Zeilen 119-130):

```python
    for row_idx in range(_GRID_ROWS):
        excel_row = _FIRST_SEAT_ROW + row_idx
        ws.row_dimensions[excel_row].height = _SEAT_ROW_HEIGHT
        for desk_col in range(4):  # 4 desks per row
            desk_number = row_idx * 4 + desk_col + 1  # 1..16
            for seat_in_desk in range(2):
                seat_number = seat_in_desk + 1  # 1 or 2
                excel_col = desk_col * 2 + seat_in_desk + 1
                cell = ws.cell(excel_row, excel_col)
                assignment = assignment_map.get((desk_number, seat_number))
                cell.value = _seat_cell_value(assignment, desk_number, seat_number)
                _style_seat_cell(cell, filled=assignment is not None, desk_col_index=desk_col)
```

durch:

```python
    for row_idx in range(_GRID_ROWS):
        excel_row = _FIRST_SEAT_ROW + row_idx
        ws.row_dimensions[excel_row].height = _SEAT_ROW_HEIGHT
        for desk_col in range(4):  # 4 desks per row
            # Tisch 1 unten rechts, Tisch 16 oben links — Mapping spiegelt beide Achsen
            desk_number = (3 - row_idx) * 4 + (3 - desk_col) + 1  # 1..16
            for seat_in_desk in range(2):
                seat_number = seat_in_desk + 1  # 1 or 2
                excel_col = desk_col * 2 + seat_in_desk + 1
                cell = ws.cell(excel_row, excel_col)
                assignment = assignment_map.get((desk_number, seat_number))
                cell.value = _seat_cell_value(assignment, desk_number, seat_number)
                _style_seat_cell(cell, filled=assignment is not None, desk_col_index=desk_col)
```

- [ ] **Step 4: Tests laufen lassen — sollten grün werden**

```bash
cd backend && pytest ../tests/test_exporter.py -v
```

Erwartet: alle PASS.

- [ ] **Step 5: Volle Test-Suite**

```bash
cd backend && pytest ../tests/ -v
```

Erwartet: alle PASS.

- [ ] **Step 6: Excel manuell prüfen**

```bash
cd backend && source .venv/bin/activate && python -c "
from app.session import load
from app.seating import compute_seating
from app.exporter import build_excel
buf = build_excel(compute_seating(load()))
open('/tmp/sitzplan-check.xlsx', 'wb').write(buf)
print('written /tmp/sitzplan-check.xlsx')
"
open /tmp/sitzplan-check.xlsx
```

Visual check: oben links steht "T16.S1", unten rechts "T1.S2".

- [ ] **Step 7: Commit**

```bash
git add backend/app/exporter.py tests/test_exporter.py
git commit -m "feat: renumber tables — Tisch 1 bottom-right, Tisch 16 top-left (Excel)"
```

---

## Task 3: Frontend — `EMPTY_PLAN` und `DEFAULT_ROOM_LABELS` anpassen

**Files:**
- Modify: `frontend/src/pages/UploadPage.tsx:12`
- Modify: `frontend/src/pages/DashboardPage.tsx:10-14`

- [ ] **Step 1: Defaults in `UploadPage.tsx` ändern**

In `frontend/src/pages/UploadPage.tsx`, Zeile 12:

```ts
const DEFAULT_ROOM_LABELS: RoomLabels = { A: 'Raum A', B: 'Raum B', C: 'Raum C' };
```

zu:

```ts
const DEFAULT_ROOM_LABELS: RoomLabels = { A: 'Raum 1', B: 'Raum 2', C: 'Raum 3' };
```

- [ ] **Step 2: `EMPTY_PLAN` in `DashboardPage.tsx` ändern**

In `frontend/src/pages/DashboardPage.tsx`, Zeilen 10-14:

```ts
const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', name: 'Raum A', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', name: 'Raum B', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', name: 'Raum C', label: '≥ 60 min', capacity: 32, assignments: [] },
};
```

zu:

```ts
const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', name: 'Raum 1', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', name: 'Raum 2', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', name: 'Raum 3', label: '≥ 60 min', capacity: 32, assignments: [] },
};
```

- [ ] **Step 3: Frontend bauen — kein Type-Fehler**

```bash
cd frontend && npm run build
```

Erwartet: erfolgreich.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/UploadPage.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: frontend defaults Raum 1/2/3"
```

---

## Task 4: Frontend — Clipboard / Schere komplett entfernen

**Files:**
- Modify: `frontend/src/components/SeatingGrid.tsx` (Hauptarbeit)
- Modify: `frontend/src/pages/DashboardPage.tsx`

Diese Aufgabe entfernt das gesamte Clipboard-Konzept (Schere ✂️ Button, Strip oben, Drag-aus-Clipboard, alle State-Variablen).

- [ ] **Step 1: `SeatingGrid.tsx` — Props-Interface aufräumen**

In `frontend/src/components/SeatingGrid.tsx` ersetze das `Props`-Interface (Zeilen 7-18):

```ts
interface Props {
  plan: SeatingPlan;
  activeRoom: 'room_a' | 'room_b' | 'room_c';
  onActiveRoomChange: (room: 'room_a' | 'room_b' | 'room_c') => void;
  onDeleteEntry?: (entryId: string) => void;
  onDeleteStudent?: (assignment: SeatAssignment) => void;
  clipboardEntries: SeatAssignment[];
  onScissors: (assignment: SeatAssignment) => void;
  onRemoveFromClipboard: (entryId: string) => void;
  onDrop: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
  onMoveToRoom: (sourceEntryId: string, targetRoom: 'A' | 'B' | 'C') => void;
}
```

durch:

```ts
interface Props {
  plan: SeatingPlan;
  activeRoom: 'room_a' | 'room_b' | 'room_c';
  onActiveRoomChange: (room: 'room_a' | 'room_b' | 'room_c') => void;
  onDeleteEntry: (entryId: string, assignment: SeatAssignment) => void;
  onDrop: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
  onMoveToRoom: (sourceEntryId: string, targetRoom: 'A' | 'B' | 'C') => void;
}
```

- [ ] **Step 2: `SeatSlot` von Clipboard-Logik befreien**

In `SeatingGrid.tsx`, `SeatSlotProps` (Zeilen 21-28) ersetzen:

```ts
interface SeatSlotProps {
  desk: number;
  seat: number;
  assignment: SeatAssignment | null;
  onDeleteEntry: (entryId: string, assignment: SeatAssignment) => void;
}
```

Und die `SeatSlot`-Funktion (ungefähr Zeilen 30-138) komplett ersetzen:

```tsx
function SeatSlot({ desk, seat, assignment, onDeleteEntry }: SeatSlotProps) {
  const dropId = `${desk}-${seat}`;
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
    disabled: !assignment,
  });

  const dragStyle = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const slotStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: '4px',
    padding: '3px 4px',
    minHeight: '2.25rem',
    position: 'relative',
    cursor: assignment ? 'grab' : 'default',
    background: assignment ? 'var(--c-bg)' : undefined,
    border: isOver
      ? '1.5px solid var(--c-accent)'
      : assignment
        ? undefined
        : '1px dashed var(--c-border)',
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isOver ? '0 0 0 1px var(--c-accent)' : undefined,
  };

  return (
    <div ref={setDropRef} style={{ flex: 1 }}>
      <div
        ref={assignment ? setDragRef : null}
        style={{ ...slotStyle, ...dragStyle }}
        {...(assignment ? { ...attributes, ...listeners } : {})}
      >
        {assignment ? (
          <>
            <p className="font-semibold truncate" style={{ fontSize: '0.7rem', paddingRight: '22px' }}>
              {assignment.student.last_name}, {assignment.student.first_name}
            </p>
            <p className="truncate" style={{ fontSize: '0.65rem', color: 'var(--c-text-secondary)' }}>
              {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
            </p>
            <button
              type="button"
              className="no-print"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDeleteEntry(assignment.entry.id, assignment); }}
              aria-label="Aus Sitzplan entfernen"
              title="Aus Sitzplan entfernen"
              style={{
                position: 'absolute', top: '0', right: '0',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.8rem', padding: '1px 4px', lineHeight: 1,
              }}
            >
              🗑️
            </button>
          </>
        ) : (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-muted)', textAlign: 'center', paddingTop: '0.4rem' }}>
            frei
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `DeskCard` und `RoomGrid` von Clipboard-Props befreien**

`DeskCardProps` und `DeskCard` (Zeilen 141-177) ersetzen:

```tsx
interface DeskCardProps {
  desk: number;
  slots: [SeatAssignment | null, SeatAssignment | null];
  onDeleteEntry: (entryId: string, assignment: SeatAssignment) => void;
}

function DeskCard({ desk, slots, onDeleteEntry }: DeskCardProps) {
  const hasOccupied = slots.some(a => a !== null);
  return (
    <div
      className="rounded-lg p-2 text-xs"
      style={{
        background: 'var(--c-surface)',
        border: `1px ${hasOccupied ? 'solid' : 'dashed'} ${hasOccupied ? 'var(--c-accent)' : 'var(--c-border)'}`,
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
            onDeleteEntry={onDeleteEntry}
          />
        ))}
      </div>
    </div>
  );
}
```

`RoomGrid` (Zeilen 180-224) ersetzen:

```tsx
export function RoomGrid({
  room_plan,
  onDeleteEntry,
}: {
  room_plan: RoomPlan;
  onDeleteEntry?: (entryId: string, assignment: SeatAssignment) => void;
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

  const noopDelete = onDeleteEntry ?? (() => {});

  return (
    <div className="grid grid-cols-4 gap-2">
      {desks.map(({ desk, slots }) => (
        <DeskCard
          key={desk}
          desk={desk}
          slots={slots}
          onDeleteEntry={noopDelete}
        />
      ))}
    </div>
  );
}
```

(Hinweis: in Task 6 wird das `desks`-Array umsortiert für die neue Nummerierung; jetzt erstmal die Reihenfolge wie bisher belassen.)

- [ ] **Step 4: `ClipboardCard` und `ClipboardStrip` löschen**

In `SeatingGrid.tsx` die kompletten Funktionen `ClipboardCard` (Zeilen ~227-283) und `ClipboardStrip` (Zeilen ~285-316) entfernen.

- [ ] **Step 5: `SeatingGrid` (Default-Export) aufräumen**

Die Komponente (ungefähr Zeilen 361-442) ersetzen:

```tsx
export default function SeatingGrid({
  plan, activeRoom, onActiveRoomChange,
  onDeleteEntry, onDrop, onMoveToRoom,
}: Props) {
  const active = plan[activeRoom];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    if (!activeId.startsWith('entry-')) return;
    const entryId = activeId.substring('entry-'.length);

    if (overId.startsWith('room-')) {
      const letter = overId.substring('room-'.length) as 'A' | 'B' | 'C';
      onMoveToRoom(entryId, letter);
      return;
    }

    const parts = overId.split('-');
    const desk = Number(parts[0]);
    const seat = Number(parts[1]);
    if (isNaN(desk) || isNaN(seat)) return;
    onDrop(entryId, desk, seat);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full">
        <div className="flex gap-2 p-4 pb-2 no-print">
          {ROOM_KEYS.map((key) => {
            const count = plan[key].assignments.length;
            return (
              <RoomTab
                key={key}
                roomKey={key}
                roomLetter={ROOM_LETTER_BY_KEY[key]}
                name={plan[key].name}
                count={count}
                isActive={activeRoom === key}
                onClick={() => onActiveRoomChange(key)}
              />
            );
          })}
        </div>

        <p className="px-4 text-xs pb-2 no-print" style={{ color: 'var(--c-text-secondary)' }}>
          {active.label} · {active.assignments.length} Schüler
        </p>

        <div className="overflow-y-auto flex-1 px-4 pb-4">
          <RoomGrid
            room_plan={active}
            onDeleteEntry={onDeleteEntry}
          />
        </div>
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 6: `DashboardPage.tsx` — Clipboard-State und -Handler entfernen**

In `frontend/src/pages/DashboardPage.tsx`:

State entfernen (Zeile 41):
```ts
const [clipboardEntries, setClipboardEntries] = useState<SeatAssignment[]>([]);
```

In `handleReset` (ungefähr Zeile 50-55), die Zeile `setClipboardEntries([]);` entfernen.

Funktionen `handleScissors` (Zeilen 85-89) und `handleRemoveFromClipboard` (Zeilen 91-93) komplett löschen.

`handleDeleteEntry` (Zeilen 57-61) auf folgendes ändern (Confirm + ohne Clipboard-Cleanup):

```ts
async function handleDeleteEntry(entryId: string, assignment: SeatAssignment) {
  const name = `${assignment.student.last_name}, ${assignment.student.first_name}`;
  if (!confirm(`${name} aus dem Sitzplan entfernen?\n\nDie Stammdaten bleiben erhalten.`)) return;
  await api.deleteEntry(entryId);
  await refresh();
}
```

`handleDeleteStudent` (Zeilen 63-83) komplett löschen.

`handleDrop` (Zeilen 96-108): die Zeile `setClipboardEntries(prev => prev.filter(e => e.entry.id !== sourceEntryId));` entfernen.

`handleMoveToRoom` (Zeilen 111-135):
- Die `fromClipboard`-Variable und ihre Verwendung in der Skip-Logik entfernen. Der Skip-Check vereinfacht sich zu: `if (source && source.entry.room === targetRoom) return;`
- Die Zeile `setClipboardEntries(prev => prev.filter(e => e.entry.id !== sourceEntryId));` entfernen.

Im JSX (ungefähr Zeilen 165-176): die nicht mehr existierenden Props an `SeatingGrid` entfernen:

```tsx
<SeatingGrid
  plan={plan}
  activeRoom={activeRoom}
  onActiveRoomChange={setActiveRoom}
  onDeleteEntry={handleDeleteEntry}
  onDrop={handleDrop}
  onMoveToRoom={handleMoveToRoom}
/>
```

- [ ] **Step 7: Frontend bauen — keine Type-Fehler**

```bash
cd frontend && npm run build
```

Erwartet: erfolgreich. Falls Fehler kommen wegen ungenutzter Imports (`useState` SeatAssignment etc.), die anpassen — `SeatAssignment` wird in `handleDeleteEntry` weiterhin gebraucht.

- [ ] **Step 8: Manuell testen**

```bash
cd frontend && npm run dev
```

Browser → `http://localhost:5173`:
- Schere-Button ist weg ✓
- Clipboard-Strip oben erscheint nicht mehr ✓
- 🗑️-Button auf einem Eintrag → Confirm-Dialog erscheint → bestätigen → Eintrag verschwindet, Schüler ist noch in Stammdaten (StudentForm-Combobox enthält ihn weiter)
- Drag & Drop von Eintrag auf anderen Sitz funktioniert
- Drag von Eintrag auf anderen Raum-Tab funktioniert

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/SeatingGrid.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: remove scissors/clipboard, delete only removes from seating plan"
```

---

## Task 5: Frontend — Tisch-Renumbering im Render

**Files:**
- Modify: `frontend/src/components/SeatingGrid.tsx` (`RoomGrid` `desks`-Array)

Mapping wie in Task 2: top-left = 16, bottom-right = 1.

- [ ] **Step 1: `desks`-Array in `RoomGrid` umsortieren**

In `frontend/src/components/SeatingGrid.tsx`, `RoomGrid` Funktion. Die existierende Konstruktion:

```tsx
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
```

ersetzen durch (Reading-Order durch das 4×4 Grid → desk-Nummer-Mapping):

```tsx
// Tisch 1 unten rechts, Tisch 16 oben links.
// Reading-Order durch das Grid (links→rechts, oben→unten) erzeugt die Reihenfolge:
// 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
const desks = Array.from({ length: 16 }, (_, i) => {
  const row = Math.floor(i / 4);
  const col = i % 4;
  const desk = (3 - row) * 4 + (3 - col) + 1;
  return {
    desk,
    slots: [
      assignmentMap.get(`${desk}-1`) ?? null,
      assignmentMap.get(`${desk}-2`) ?? null,
    ] as [SeatAssignment | null, SeatAssignment | null],
  };
});
```

- [ ] **Step 2: Frontend bauen**

```bash
cd frontend && npm run build
```

Erwartet: erfolgreich.

- [ ] **Step 3: Manuell testen**

```bash
cd frontend && npm run dev
```

- Browser → Sitzplan ansehen: oben links steht "Tisch 16", oben rechts "Tisch 13", unten links "Tisch 4", unten rechts "Tisch 1".
- Einen neuen Schüler eintragen (StudentForm) → er landet automatisch auf Tisch 1 (unten rechts), nicht mehr oben links.
- Drag & Drop: Schüler von Tisch 1 nach Tisch 5 ziehen → er erscheint im richtigen visuellen Slot (Tisch 5 = drittletzte Reihe rechts).
- Excel-Export öffnen — Layout passt zur Anzeige im Browser.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SeatingGrid.tsx
git commit -m "feat: renumber tables — Tisch 1 bottom-right, Tisch 16 top-left (frontend)"
```

---

## Task 6: Frontend — Inline Raumnamen-Edit per Stift-Icon

**Files:**
- Modify: `frontend/src/components/SeatingGrid.tsx` (`RoomTab`)
- Modify: `frontend/src/pages/DashboardPage.tsx` (neuer Handler `handleRenameRoom`)

- [ ] **Step 1: Handler in `DashboardPage.tsx` ergänzen**

In `frontend/src/pages/DashboardPage.tsx`, neue Funktion (nach den anderen Handlern, etwa nach `handleMoveToRoom`):

```ts
async function handleRenameRoom(letter: 'A' | 'B' | 'C', newName: string) {
  const trimmed = newName.trim();
  // empty → backend collapses to default; we still pass it through
  const labels = {
    A: plan.room_a.name,
    B: plan.room_b.name,
    C: plan.room_c.name,
    [letter]: trimmed,
  };
  try {
    await api.putRoomLabels(labels);
    await refresh();
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Umbenennen fehlgeschlagen');
  }
}
```

`SeatingGrid`-Aufruf erweitern (im JSX):

```tsx
<SeatingGrid
  plan={plan}
  activeRoom={activeRoom}
  onActiveRoomChange={setActiveRoom}
  onDeleteEntry={handleDeleteEntry}
  onDrop={handleDrop}
  onMoveToRoom={handleMoveToRoom}
  onRenameRoom={handleRenameRoom}
/>
```

- [ ] **Step 2: `Props` und `RoomTab` in `SeatingGrid.tsx` erweitern**

In `frontend/src/components/SeatingGrid.tsx`, `Props` erweitern um:

```ts
onRenameRoom: (letter: 'A' | 'B' | 'C', newName: string) => void;
```

`RoomTab`-Funktion komplett ersetzen (inkl. neuem `useState` für Edit-Modus):

```tsx
function RoomTab({
  roomKey, roomLetter, name, count, isActive, onClick, onRename,
}: {
  roomKey: 'room_a' | 'room_b' | 'room_c';
  roomLetter: 'A' | 'B' | 'C';
  name: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  onRename: (letter: 'A' | 'B' | 'C', newName: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `room-${roomLetter}` });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  // Sync draft when external name changes (e.g. after refresh)
  useEffect(() => { setDraft(name); }, [name]);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== name) {
      onRename(roomLetter, draft.trim());
    } else {
      setDraft(name); // empty or unchanged → revert visual
    }
  }

  function cancel() {
    setEditing(false);
    setDraft(name);
  }

  return (
    <button
      ref={setNodeRef}
      onClick={editing ? undefined : onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: isActive ? 'var(--c-accent)' : 'var(--c-surface)',
        color: isActive ? 'white' : 'var(--c-text-secondary)',
        border: isOver
          ? '2px dashed var(--c-accent)'
          : isActive ? 'none' : '1px solid var(--c-border)',
        boxShadow: isOver ? '0 0 0 2px rgba(245,158,11,0.3)' : undefined,
        outline: isActive && isOver ? '2px dashed white' : undefined,
        outlineOffset: isActive && isOver ? '-5px' : undefined,
        cursor: editing ? 'text' : 'pointer',
      }}
      data-room-key={roomKey}
    >
      {editing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(255,255,255,0.85)',
            color: 'var(--c-text)',
            border: 'none',
            borderRadius: '4px',
            padding: '0px 4px',
            fontSize: '0.875rem',
            fontWeight: 500,
            width: `${Math.max(draft.length, 6) + 1}ch`,
            outline: 'none',
          }}
        />
      ) : (
        <>
          <span>{name}</span>
          {isActive && (
            <button
              type="button"
              className="no-print"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setDraft(name); setEditing(true); }}
              aria-label="Raum umbenennen"
              title="Raum umbenennen"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '0 2px',
                lineHeight: 1,
                color: 'inherit',
                opacity: 0.85,
              }}
            >
              ✏️
            </button>
          )}
        </>
      )}
      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--c-bg)' }}>
        {count}/32
      </span>
    </button>
  );
}
```

Imports in `SeatingGrid.tsx` ergänzen — falls noch nicht vorhanden, am Anfang der Datei `useState`, `useEffect` aus React importieren:

```ts
import { useState, useEffect } from 'react';
```

- [ ] **Step 3: `SeatingGrid`-Komponente die neue Prop weiterreichen**

Im `SeatingGrid` Default-Export, im `ROOM_KEYS.map`-Block den `RoomTab`-Aufruf erweitern:

```tsx
<RoomTab
  key={key}
  roomKey={key}
  roomLetter={ROOM_LETTER_BY_KEY[key]}
  name={plan[key].name}
  count={count}
  isActive={activeRoom === key}
  onClick={() => onActiveRoomChange(key)}
  onRename={onRenameRoom}
/>
```

Und `onRenameRoom` aus den destrukturierten Props lesen:

```ts
export default function SeatingGrid({
  plan, activeRoom, onActiveRoomChange,
  onDeleteEntry, onDrop, onMoveToRoom, onRenameRoom,
}: Props) {
```

- [ ] **Step 4: Frontend bauen**

```bash
cd frontend && npm run build
```

Erwartet: erfolgreich.

- [ ] **Step 5: Manuell testen**

```bash
cd frontend && npm run dev
```

- Auf aktivem Reiter erscheint ✏️-Icon rechts vom Namen.
- Inaktive Reiter zeigen kein ✏️-Icon.
- Klick auf ✏️ → Eingabefeld erscheint inline, Cursor steht im Feld.
- Tippen, Enter → Name wird gespeichert (Reload-Kontrolle: F5 → Name bleibt).
- Klick auf ✏️ → Tippen → Escape → Name kehrt zum alten Wert zurück.
- Klick auf ✏️ → Feld leeren → Enter: Backend setzt Default zurück (z.B. "Raum 1").
- Während Edit: Klick auf einen anderen Tab → Blur speichert ggf. den aktuellen Wert.
- Drag & Drop auf den Tab funktioniert weiterhin (Schüler wird bei Drop verschoben).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SeatingGrid.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: inline rename rooms via pencil icon on active tab"
```

---

## Task 7: Frontend — Tab+Rahmen-Look (aktiver Reiter rahmt Raum)

**Files:**
- Modify: `frontend/src/components/SeatingGrid.tsx`

Visuelles Pattern: Tab-Strip + Caption + Grid in einem zusammenhängenden Container, dessen Border vom aktiven Tab "betreten" wird.

- [ ] **Step 1: Wrapper-Container und Tab-Strip-Border in `SeatingGrid` ergänzen**

In `frontend/src/components/SeatingGrid.tsx`, die `return`-Struktur des Default-Exports neu strukturieren:

```tsx
return (
  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    <div className="flex flex-col h-full p-4">
      <div
        className="flex gap-1 no-print"
        style={{
          paddingLeft: '0.5rem',
          marginBottom: '-1px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {ROOM_KEYS.map((key) => {
          const count = plan[key].assignments.length;
          return (
            <RoomTab
              key={key}
              roomKey={key}
              roomLetter={ROOM_LETTER_BY_KEY[key]}
              name={plan[key].name}
              count={count}
              isActive={activeRoom === key}
              onClick={() => onActiveRoomChange(key)}
              onRename={onRenameRoom}
            />
          );
        })}
      </div>

      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          background: 'var(--c-bg)',
          border: '1px solid var(--c-border)',
          borderRadius: '0 0 8px 8px',
          padding: '0.75rem',
        }}
      >
        <p className="text-xs pb-2 no-print" style={{ color: 'var(--c-text-secondary)' }}>
          {active.label} · {active.assignments.length} Schüler
        </p>

        <div className="overflow-y-auto flex-1">
          <RoomGrid
            room_plan={active}
            onDeleteEntry={onDeleteEntry}
          />
        </div>
      </div>
    </div>
  </DndContext>
);
```

- [ ] **Step 2: `RoomTab`-Styling für nahtlose Verschmelzung anpassen**

Im `RoomTab`-`style`-Objekt, die `border` und `background` Props ersetzen — der aktive Tab muss dieselbe Hintergrundfarbe wie der Wrapper haben (`var(--c-bg)`) und seine untere Border-Linie wegnehmen:

```tsx
style={{
  background: isActive ? 'var(--c-bg)' : 'var(--c-surface)',
  color: isActive ? 'var(--c-text)' : 'var(--c-text-secondary)',
  border: isOver
    ? '2px dashed var(--c-accent)'
    : `1px solid var(--c-border)`,
  borderBottom: isActive ? '1px solid var(--c-bg)' : '1px solid var(--c-border)',
  borderTopLeftRadius: '8px',
  borderTopRightRadius: '8px',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  boxShadow: isOver ? '0 0 0 2px rgba(245,158,11,0.3)' : undefined,
  outline: undefined,
  outlineOffset: undefined,
  cursor: editing ? 'text' : 'pointer',
  marginBottom: 0,
  position: 'relative',
  fontWeight: isActive ? 600 : 500,
}}
```

Den `count`-Badge anpassen, damit er auf hellem aktivem Tab lesbar bleibt:

```tsx
<span className="text-xs px-1.5 py-0.5 rounded-full" style={{
  background: isActive ? 'var(--c-surface)' : 'var(--c-bg)',
  color: 'var(--c-text-secondary)',
}}>
  {count}/32
</span>
```

Und das ✏️-Icon dunkel statt weiß einfärben (da der aktive Tab jetzt hellen Hintergrund hat) — der Style des Stift-Buttons bleibt `color: 'inherit'`, dadurch erbt es automatisch die Tab-Textfarbe (`var(--c-text)` für aktiv).

Beim Edit-Modus auch den Input-Style anpassen (war auf "weißer Hintergrund" gestylt, jetzt unnötig auffällig auf hellem Tab):

```tsx
style={{
  background: 'var(--c-surface)',
  color: 'var(--c-text)',
  border: '1px solid var(--c-border)',
  borderRadius: '4px',
  padding: '0px 4px',
  fontSize: '0.875rem',
  fontWeight: 500,
  width: `${Math.max(draft.length, 6) + 1}ch`,
  outline: 'none',
}}
```

- [ ] **Step 3: Frontend bauen**

```bash
cd frontend && npm run build
```

Erwartet: erfolgreich.

- [ ] **Step 4: Manuell testen**

```bash
cd frontend && npm run dev
```

- Aktiver Reiter wirkt visuell mit dem Raum-Panel "verschmolzen": gleiche Hintergrundfarbe, kein Trennstrich zwischen Tab und Panel-Inhalt.
- Inaktive Reiter sitzen oberhalb der Trennlinie, leicht abgesetzt.
- ✏️-Icon ist auch im neuen Look auf aktivem Reiter sichtbar und klickbar.
- `count`/32-Badge ist auf beiden Hintergründen lesbar.
- Drag & Drop auf Tabs funktioniert visuell weiterhin (gestrichelte Border erscheint beim Hover).
- Theme-Switch (falls vorhanden, Light/Dark) — Look bleibt konsistent über die CSS-Variablen.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SeatingGrid.tsx
git commit -m "style: active tab frames the room panel for clearer context"
```

---

## Task 8: End-to-End Verification

**Files:** keine Änderungen — reine Verifikation.

- [ ] **Step 1: Komplette Backend-Tests laufen lassen**

```bash
cd backend && pytest ../tests/ -v
```

Erwartet: alle PASS.

- [ ] **Step 2: Frontend bauen und Lint**

```bash
cd frontend && npm run build
```

Erwartet: erfolgreich, keine TypeScript-Fehler.

- [ ] **Step 3: Manuelle Acceptance-Criteria-Checks**

`cd frontend && npm run dev` und `cd backend && uvicorn app.main:app --reload` — Browser auf `http://localhost:5173`:

Pro Acceptance-Criterion einzeln verifizieren:

- [ ] Sitzplan zeigt `Tisch 1` unten rechts, `Tisch 16` oben links
- [ ] Auto-Belegung legt ersten Schüler auf Tisch 1 (unten rechts) — neuen Schüler eintragen, prüfen wo er landet
- [ ] ✂️-Button und Clipboard-Strip sind nicht mehr sichtbar
- [ ] 🗑️ entfernt nur den Sitzplan-Eintrag, Schüler bleibt in StudentForm-Combobox vorhanden und behält andere Einträge
- [ ] Auf aktivem Reiter ist ✏️ sichtbar; Klick → Edit → Enter speichert; Escape bricht ab
- [ ] Drag & Drop und Tab-Wechsel funktionieren auch nach Click auf ✏️ unverändert
- [ ] Frische Sessions zeigen `Raum 1`, `Raum 2`, `Raum 3` (ggf. `data/session.json` löschen)
- [ ] Aktiver Reiter und Raum-Panel bilden visuell eine zusammenhängende Karte
- [ ] Excel-Export öffnen: Tisch-Layout passt zur Browser-Anzeige (T16 oben links, T1 unten rechts), Sheet-Namen sind die aktuellen Raumnamen.
- [ ] Word-Export öffnen: Tabelle ist konsistent (Tisch-Spalte 1..16 ascending, Inhalte korrekt).

- [ ] **Step 4: CHANGELOG aktualisieren**

```bash
cat CHANGELOG.md | head -30
```

Neuen Eintrag oben anfügen, z.B. unter `## [Unreleased]` oder neue Version. Format folgt der existierenden CHANGELOG-Konvention. Inhalt:

```markdown
### Changed
- Tisch-Nummerierung: Tisch 1 unten rechts, Tisch 16 oben links (so wie es Kollegen kennen)
- Default-Raumnamen: "Raum 1", "Raum 2", "Raum 3" (statt A/B/C)
- 🗑️-Button auf einem Sitzplatz entfernt nur den Eintrag — Stammdaten bleiben erhalten

### Added
- Inline-Edit für Raumnamen per ✏️-Icon auf aktivem Reiter
- Visueller "Tab+Rahmen"-Look: aktiver Reiter rahmt das Raum-Panel ein

### Removed
- ✂️ "Ausschneiden"-Funktion und Clipboard-Strip — wurde nicht gebraucht
```

- [ ] **Step 5: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for sitzplan overhaul"
```

- [ ] **Step 6: Optional — auf Pi deployen**

Wenn Du den lokalen Smoke-Test bestätigt hast, deploy via Docker (Memory: SSH-Key auf Pi vorhanden):

```bash
git push
ssh pi "cd ~/Nachschreiber && git pull && docker compose up -d --build"
```

Im Browser auf der Pi-URL die wichtigsten Acceptance-Criteria nochmal kurz verifizieren.

---

## Self-Review Notes

- **Spec coverage:**
  - § 1 Tisch-Nummerierung → Tasks 2 (backend), 5 (frontend) ✓
  - § 2 Clipboard entfernen → Task 4 ✓
  - § 3 Delete-Verhalten → Task 4 (Confirm + `deleteEntry`) ✓
  - § 4 Inline Rename → Task 6 ✓
  - § 5 Default-Raumnamen → Tasks 1 (backend), 3 (frontend) ✓
  - § 6 Tab+Rahmen → Task 7 ✓
  - Acceptance-Criteria → Task 8 ✓
- **Placeholder scan:** keine TBD/TODO; alle Code-Schritte zeigen vollständige Snippets.
- **Type-Konsistenz:** `onDeleteEntry` Signatur `(entryId: string, assignment: SeatAssignment) => void` ist über `Props`, `SeatSlotProps`, `DeskCardProps`, `RoomGrid`-Prop und `DashboardPage`-Handler einheitlich. `onRenameRoom` Signatur `(letter: 'A' | 'B' | 'C', newName: string) => void` ist konsistent zwischen `Props`, `RoomTab`-Prop und `DashboardPage`-Handler.
