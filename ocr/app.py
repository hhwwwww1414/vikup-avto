"""FastAPI wrapper around the ANPR pipeline. Local-only service (never exposed
publicly). Node calls POST /recognize with the original photo bytes."""
from __future__ import annotations

import logging

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

from anpr import recognize, load_models

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("anpr")

app = FastAPI(title="VIKUP ANPR", version="1.0.0")

MAX_BYTES = 20 * 1024 * 1024


@app.on_event("startup")
def _startup() -> None:
    log.info("loading ANPR models...")
    load_models()
    log.info("ANPR models ready")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/recognize")
async def recognize_endpoint(file: UploadFile = File(...)) -> JSONResponse:
    data = await file.read()
    if not data:
        return JSONResponse({"plate": None, "confidence": 0.0, "found": False, "ms": 0})
    if len(data) > MAX_BYTES:
        return JSONResponse(
            {"plate": None, "confidence": 0.0, "found": False, "ms": 0},
            status_code=413,
        )

    result = recognize(data)
    log.info(
        "recognize found=%s plate=%s conf=%.3f ms=%d",
        result.found,
        result.plate,
        result.confidence,
        result.ms,
    )
    return JSONResponse(
        {
            "plate": result.plate,
            "confidence": result.confidence,
            "found": result.found,
            "ms": result.ms,
        }
    )
