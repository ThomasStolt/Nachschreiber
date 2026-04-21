# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nachschreiber** is a school exam scheduling and seating management tool for makeup exams ("Nachschreibetermine"). Teachers upload a CSV of student master data, register students for makeup exams with details (subject, duration, aids, teacher), and the app automatically assigns rooms and seats. The seating plan is exported as Excel and Word.

## Status

Implementation in progress. Scaffold complete. See implementation plan:
`docs/superpowers/plans/2026-04-22-nachschreiber.md`

## Tech Stack

- **Backend:** Python 3.12+, FastAPI, uvicorn, openpyxl, python-docx
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, react-router-dom
- **Deployment:** Docker Compose, nginx reverse proxy, port 3002

## Commands

```bash
# Backend tests (from project root)
cd backend && pytest ../tests/ -v

# Backend dev server
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Frontend dev server
cd frontend && npm run dev

# Full stack (Docker)
docker compose up -d --build
```

## Architecture

- `backend/app/main.py` — FastAPI app, mounts all routers
- `backend/app/models.py` — Pydantic models (Student, Entry, SessionData, SeatingPlan)
- `backend/app/session.py` — Atomic JSON persistence to `/data/session.json`
- `backend/app/seating.py` — Room assignment (≤45→A, 46–59→B, ≥60→C) + dynamic seat computation
- `backend/app/exporter.py` — Excel (openpyxl) + Word (python-docx) generation
- `backend/app/routers/` — One file per API concern (upload, entries, students, seating, export, misc)
- `frontend/src/pages/` — UploadPage (CSV upload), DashboardPage (split-view live dashboard)
- `frontend/src/components/` — StudentForm, SeatingGrid, ExportButtons
- `frontend/src/api.ts` — Typed fetch wrapper for all API routes
- `tests/` — pytest suite; run from project root (pythonpath = backend in pytest.ini)

## Domain Knowledge

### Student Categories (by exam duration)
- **Category A:** ≤ 45 min → Room A
- **Category B:** 46–59 min → Room B
- **Category C:** ≥ 60 min → Room C

### Room Layout
- 16 desks in a 4×4 grid, 2 seats per desk → max 32 students per room
- Seats assigned sequentially: desk=(i//2)+1, seat=(i%2)+1

### Business Rules
- Duplicate prevention: same student + same subject → HTTP 409
- Same student + different subject → allowed (two separate entries/seats)
- Room overflow (>32) → HTTP 422
- Session reset clears entries but keeps student master data
- CSV format: `Nachname;Vorname;Klasse` (semicolon-delimited, UTF-8 or UTF-8-BOM)
