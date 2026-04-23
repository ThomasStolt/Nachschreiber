# tests/test_exporter.py
import io
import openpyxl
from app.exporter import build_excel, build_word
from app.models import SessionData, Student, Entry
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
        desk=1,
        seat=1,
    )
    return SessionData(students=[student], entries=[entry])


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
    text = str(ws.cell(4, 1).value or "")
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
    text = str(ws.cell(4, 2).value or "").strip()
    assert text == "T1.S2"


def test_excel_grid_second_desk_first_seat_is_empty_with_label():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    # Desk 2, Seat 1 → row 4, col 3
    text = str(ws.cell(4, 3).value or "").strip()
    assert text == "T2.S1"


def test_excel_grid_last_row_corresponds_to_desks_13_to_16():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    ws = wb["Raum A"]
    # Desk 13 Seat 1 → row 7, col 1
    text = str(ws.cell(7, 1).value or "").strip()
    assert text == "T13.S1"
    # Desk 16 Seat 2 → row 7, col 8
    text_last = str(ws.cell(7, 8).value or "").strip()
    assert text_last == "T16.S2"


def test_excel_grid_landscape():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_excel(plan)
    wb = openpyxl.load_workbook(io.BytesIO(buf))
    for name in ("Raum A", "Raum B", "Raum C"):
        assert wb[name].page_setup.orientation == "landscape"


def test_word_returns_bytes():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_word(plan)
    assert isinstance(buf, bytes)
    assert len(buf) > 100  # non-empty DOCX
