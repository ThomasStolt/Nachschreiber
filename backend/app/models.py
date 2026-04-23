# backend/app/models.py
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Student(BaseModel):
    id: str
    last_name: str
    first_name: str
    class_name: str


class Entry(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    id: str
    student_id: str
    subject: str
    duration_minutes: int = Field(ge=1, le=300)
    aids: str = ""
    teacher: str
    room: Literal["A", "B", "C"]
    desk: int = Field(ge=1, le=16)
    seat: int = Field(ge=1, le=2)


class EntryCreate(BaseModel):
    student_id: str
    subject: str
    duration_minutes: int = Field(ge=1, le=300)
    aids: str = ""
    teacher: str


class SeatUpdate(BaseModel):
    desk: int = Field(ge=1, le=16)
    seat: int = Field(ge=1, le=2)
    room: Literal["A", "B", "C"]


class SeatAssignment(BaseModel):
    desk: int = Field(ge=1, le=16)
    seat: int = Field(ge=1, le=2)
    entry: Entry
    student: Student


class RoomPlan(BaseModel):
    room: Literal["A", "B", "C"]
    label: str
    capacity: int = 32
    assignments: list[SeatAssignment] = []


class SeatingPlan(BaseModel):
    room_a: RoomPlan
    room_b: RoomPlan
    room_c: RoomPlan


class SessionData(BaseModel):
    students: list[Student] = []
    entries: list[Entry] = []
