# backend/app/exporter.py
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from docx import Document
from .models import SeatingPlan, RoomPlan

_HEADERS = ["Tisch", "Platz", "Nachname", "Vorname", "Klasse", "Fach", "Dauer (min)", "Hilfsmittel", "Lehrkraft"]
_ROOMS = [("room_a", "Raum A"), ("room_b", "Raum B"), ("room_c", "Raum C")]


def _fill_sheet(ws, room_plan: RoomPlan) -> None:
    ws.append(_HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="D97706")
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
