# Sprint 3 — Excel 2D-Tischplan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear-list Excel export with a visual 4×4 room grid (32 seat cells per room) that mirrors the physical seating layout.

**Architecture:** All changes live in the backend `exporter.py`. Word export stays untouched. Public API (`build_excel(plan) -> bytes`) and FastAPI route unchanged. New internal helpers encapsulate title styling, seat cell content, seat cell styling, and room rendering.

**Tech Stack:** openpyxl 3.1+, pytest.

**Spec:** `docs/superpowers/specs/2026-04-23-sprint3-excel-tischplan-design.md`

---

## File Structure

- **Modify:** `backend/app/exporter.py` — replace `build_excel` + `_fill_sheet`, add helpers; keep `build_word` + `_add_room_table` and the `_ROOMS`/`_HEADERS` constants used by Word.
- **Modify:** `tests/test_exporter.py` — keep `build_word` test, replace Excel tests with grid-layout assertions.

---

## Task 1: Rewrite Excel tests for grid layout

**Files:**
- Modify: `tests/test_exporter.py`

- [ ] **Step 1: Replace the two Excel tests with grid-layout assertions**

Replace the existing content starting at `def test_excel_has_three_sheets` through the end of `def test_excel_room_a_has_data`. Keep the imports, `_make_session`, and `test_word_returns_bytes` untouched.

```python
def test_excel_has_three_sheets():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    assert set(wb.sheetnames) == {"Raum A", "Raum B", "Raum C"}


def test_excel_grid_has_title_and_lehrpult_rows():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    # Row 1 = title (merged A1:H1), Row 2 = Lehrpult (merged A2:H2)
    assert "Raum A" in (ws.cell(1, 1).value or "")
    assert (ws.cell(2, 1).value or "").strip() == "Lehrpult"


def test_excel_grid_seat_1_1_holds_first_entry():
    # Student assigned to desk 1 seat 1 in Room A appears in cell (row 4, col 1)
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    text = ws.cell(4, 1).value or ""
    assert "Müller, Anna" in text
    assert "10a" in text
    assert "Mathematik" in text
    assert "45 min" in text
    assert "Fr. Schmidt" in text
    assert "Taschenrechner" in text


def test_excel_grid_empty_seat_shows_only_label():
    # No entry for desk 1 seat 2 → cell shows only "T1.S2"
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    # Desk 1, Seat 2 → row 4, col 2 (seats within a desk are adjacent columns)
    text = (ws.cell(4, 2).value or "").strip()
    assert text == "T1.S2"


def test_excel_grid_second_desk_first_seat_is_empty_with_label():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    # Desk 2, Seat 1 → row 4, col 3
    text = (ws.cell(4, 3).value or "").strip()
    assert text == "T2.S1"


def test_excel_grid_last_row_corresponds_to_desks_13_to_16():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    # Desk 13 Seat 1 → row 7, col 1
    text = (ws.cell(7, 1).value or "").strip()
    assert text == "T13.S1"
    # Desk 16 Seat 2 → row 7, col 8
    text_last = (ws.cell(7, 8).value or "").strip()
    assert text_last == "T16.S2"


def test_excel_grid_landscape():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    for name in ("Raum A", "Raum B", "Raum C"):
        assert wb[name].page_setup.orientation == "landscape"
```

- [ ] **Step 2: Run Excel tests to verify they all fail**

Run: `cd backend && pytest ../tests/test_exporter.py -v`
Expected: `test_word_returns_bytes` PASSES; all Excel grid tests FAIL (old `_fill_sheet` still produces linear-list layout).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/test_exporter.py
git commit -m "test: Sprint 3 — Excel grid-layout tests (failing)"
```

---

## Task 2: Implement grid-based `build_excel`

**Files:**
- Modify: `backend/app/exporter.py`

- [ ] **Step 1: Replace the Excel-building code with a grid implementation**

Open `backend/app/exporter.py`. Keep everything related to Word unchanged. Remove `_fill_sheet` and the existing `build_excel`. Keep `_HEADERS` and `_ROOMS` (still used by Word). Add the new imports at the top (extend the existing openpyxl imports) and the new helpers + `build_excel`.

Final file content:

```python
# backend/app/exporter.py
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from docx import Document
from .models import SeatingPlan, RoomPlan, SeatAssignment

_HEADERS = ["Tisch", "Platz", "Nachname", "Vorname", "Klasse", "Fach", "Dauer (min)", "Hilfsmittel", "Lehrkraft"]
_ROOMS = [("room_a", "Raum A"), ("room_b", "Raum B"), ("room_c", "Raum C")]

# --- Grid layout constants ---
_GRID_COLS = 8   # 4 desks × 2 seats per row
_GRID_ROWS = 4   # 4 desk rows
_TITLE_ROW = 1
_PULT_ROW = 2
_FIRST_SEAT_ROW = 4  # row 3 stays blank as visual spacer
_SEAT_ROW_HEIGHT = 85

_THIN = Side(style="thin", color="999999")
_THICK = Side(style="medium", color="333333")


def _style_title_row(ws, text: str) -> None:
    ws.cell(_TITLE_ROW, 1).value = text
    ws.merge_cells(start_row=_TITLE_ROW, start_column=1, end_row=_TITLE_ROW, end_column=_GRID_COLS)
    c = ws.cell(_TITLE_ROW, 1)
    c.font = Font(bold=True, color="FFFFFF", size=14)
    c.fill = PatternFill("solid", fgColor="D97706")
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[_TITLE_ROW].height = 26


def _style_pult_row(ws) -> None:
    ws.cell(_PULT_ROW, 1).value = "Lehrpult"
    ws.merge_cells(start_row=_PULT_ROW, start_column=1, end_row=_PULT_ROW, end_column=_GRID_COLS)
    c = ws.cell(_PULT_ROW, 1)
    c.font = Font(italic=True, color="666666", size=10)
    c.fill = PatternFill("solid", fgColor="EEEEEE")
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[_PULT_ROW].height = 18


def _seat_cell_content(assignment: SeatAssignment | None, desk: int, seat: int) -> str:
    label = f"T{desk}.S{seat}"
    if assignment is None:
        return label
    st = assignment.student
    en = assignment.entry
    lines = [
        label,
        f"{st.last_name}, {st.first_name}",
        st.class_name,
        f"{en.subject} · {en.duration_minutes} min",
        en.teacher,
    ]
    if en.aids.strip():
        lines.append(en.aids.strip())
    return "\n".join(lines)


def _style_seat_cell(cell, filled: bool, desk_col_index: int) -> None:
    # desk_col_index 0..3 → which desk column within the row
    # Seats 1 and 2 of the same desk sit in columns (2*desk_col_index+1, +2).
    # Between desks we want a THICK right border on seat 2 (when desk_col_index < 3).
    # Between desk rows we want THICK top/bottom borders.
    # Inside a desk, between seat 1 and seat 2, THIN vertical border.
    col_within_desk = (cell.column - 1) % 2  # 0 = seat1, 1 = seat2
    left = _THICK if col_within_desk == 0 else _THIN
    right = _THICK if col_within_desk == 1 else _THIN
    # Outer top/bottom of each desk row is THICK
    top = _THICK
    bottom = _THICK
    cell.border = Border(left=left, right=right, top=top, bottom=bottom)
    cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    cell.font = Font(size=10) if filled else Font(size=9, color="AAAAAA")


def _render_room_grid(ws, room_plan: RoomPlan, title: str) -> None:
    _style_title_row(ws, f"{title} — Nachschreiber")
    _style_pult_row(ws)
    # Row 3 is blank spacer
    ws.row_dimensions[3].height = 8

    assignment_map = {(a.desk, a.seat): a for a in room_plan.assignments}

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
                cell.value = _seat_cell_content(assignment, desk_number, seat_number)
                _style_seat_cell(cell, filled=assignment is not None, desk_col_index=desk_col)

    # Uniform column widths for all 8 seat columns
    for col_i in range(1, _GRID_COLS + 1):
        ws.column_dimensions[get_column_letter(col_i)].width = 20

    # Print setup: landscape, fit to 1 page
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True


def build_excel(plan: SeatingPlan) -> bytes:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for attr, title in _ROOMS:
        ws = wb.create_sheet(title)
        _render_room_grid(ws, getattr(plan, attr), title)
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

- [ ] **Step 2: Run the exporter tests and verify they all pass**

Run: `cd backend && pytest ../tests/test_exporter.py -v`
Expected: all 8 tests PASS (including `test_word_returns_bytes`).

- [ ] **Step 3: Run the full test suite to guard against regressions**

Run: `cd backend && pytest ../tests/ -v`
Expected: all tests pass. If anything breaks elsewhere, stop and investigate before proceeding.

- [ ] **Step 4: Commit the implementation**

```bash
git add backend/app/exporter.py
git commit -m "feat: Excel export as 2D seat grid (4×4 desks, 32 seat cells per room)"
```

---

## Task 3: Manual smoke test of the generated file

- [ ] **Step 1: Generate a file and eyeball it**

Run the app locally (or rely on existing dev instance). From the project root:

```bash
cd backend && source .venv/bin/activate && python -c "
from app.exporter import build_excel
from app.seating import compute_seating
from app.session import load
import os
os.environ.setdefault('DATA_DIR', '/tmp/nachschreiber-smoke')
import pathlib; pathlib.Path('/tmp/nachschreiber-smoke').mkdir(exist_ok=True)
plan = compute_seating(load())
open('/tmp/smoke.xlsx', 'wb').write(build_excel(plan))
print('wrote /tmp/smoke.xlsx')
"
open /tmp/smoke.xlsx
```

Expected: Excel opens with three sheets; each sheet shows the title row, "Lehrpult" row, a blank spacer, then 4 rows × 8 cells. Empty sessions → all 32 cells show only `T<n>.S<n>`.

Nothing to commit. If the file looks wrong, iterate on Task 2 before moving on.

---

## Self-Review Notes

- Spec coverage: title row ✅, Lehrpult row ✅, 4×4 desk grid ✅, seat labels ✅, multiline cell content ✅, landscape print ✅, Word unchanged ✅, API unchanged ✅.
- Placeholder scan: no TBDs, all code blocks complete.
- Column layout verified: desk `d`, seat `s` → excel column = `((d-1) % 4) * 2 + s`, excel row = `_FIRST_SEAT_ROW + (d-1) // 4`. For desk 1/seat 1 → col 1, row 4 ✅; desk 16/seat 2 → col 8, row 7 ✅.
