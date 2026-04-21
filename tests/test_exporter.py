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
    # Row 1 = header, Row 2 = first student (desk 1, seat 1)
    assert ws.cell(2, 3).value == "Müller"   # Nachname is column 3
    assert ws.cell(2, 4).value == "Anna"     # Vorname is column 4


def test_word_returns_bytes():
    session = _make_session()
    plan = compute_seating(session)
    buf = build_word(plan)
    assert isinstance(buf, bytes)
    assert len(buf) > 100  # non-empty DOCX
