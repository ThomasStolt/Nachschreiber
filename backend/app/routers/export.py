# backend/app/routers/export.py
from fastapi import APIRouter
from fastapi.responses import Response
from ..session import load
from ..seating import compute_seating
from ..exporter import build_excel, build_word

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/excel")
def export_excel() -> Response:
    plan = compute_seating(load())
    data = build_excel(plan)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=nachschreiber_sitzplan.xlsx"},
    )


@router.get("/word")
def export_word() -> Response:
    plan = compute_seating(load())
    data = build_word(plan)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=nachschreiber_sitzplan.docx"},
    )
