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
