# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nachschreiber** is a school exam scheduling and seating management tool for makeup exams ("Nachschreibetermine"). It helps organize students who need to retake exams into rooms and seats based on their exam duration.

## Status

No implementation exists yet. Only requirements documents are present:
- `Anforderung.txt` — full requirements in German
- `Sitzplan Nachschreiber.pdf` — sample output showing desired seating plan format

## Domain Knowledge

### Student Categories (by exam duration)
- **Category A:** up to 45 minutes → Room A
- **Category B:** 45–60 minutes → Room B
- **Category C:** 60+ minutes → Room C

### Room Layout
- Each room has **16 desks** arranged in a **4×4 grid**
- Each desk has **2 seats** (left/right or front/back)
- Maximum capacity: **32 students per room**

### Data Per Student Entry
- Name, First Name, Class (imported from master data)
- Exam subject
- Exam duration (determines room assignment)
- Allowed materials/aids
- Responsible teacher

### Business Rules
- A student may appear multiple times (retaking several exams) — **duplicates must be prevented** per exam slot, not globally
- Room assignment is automatic based on duration category
- Seat assignment is automatic within the 4×4 desk grid

### Output
- Seating plan per room with columns: Student Name, Class, Subject, Duration, Materials
- Export to Excel or Word format for printing and posting on classroom doors

## Implementation Decisions (to be made)

- Technology stack not yet chosen — Python (with openpyxl/python-docx) or Node.js are natural fits given Excel/Word export requirements
- Storage: likely file-based (CSV/JSON) or SQLite given the single-school, single-session nature of the data
- UI: desktop app, web app, or CLI — not specified in requirements
