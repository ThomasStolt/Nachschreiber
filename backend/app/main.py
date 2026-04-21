# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, entries, students, seating_router, misc

app = FastAPI(title="Nachschreiber")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(entries.router)
app.include_router(students.router)
app.include_router(seating_router.router)
app.include_router(misc.router)
