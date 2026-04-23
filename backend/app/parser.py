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
