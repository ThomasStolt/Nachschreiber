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
