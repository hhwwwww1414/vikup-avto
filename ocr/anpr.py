"""
ANPR pipeline for VIKUP.

ORIGINAL PHOTO -> PLATE DETECTION (YOLOv9 ONNX) -> CROP -> preprocessing
variants -> PLATE OCR (fast-plate-ocr ONNX) -> best raw plate + confidence.

Russian-specific normalization / validation happens on the Node side; this
service only returns the best raw OCR string and a confidence in [0, 1].
"""
from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass

import cv2
import numpy as np

from open_image_models import LicensePlateDetector
from fast_plate_ocr import LicensePlateRecognizer

DETECTOR_MODEL = os.environ.get(
    "PLATE_DETECTOR_MODEL", "yolo-v9-t-384-license-plate-end2end"
)
OCR_MODEL = os.environ.get("OCR_MODEL", "cct-s-v2-global-model")
# How many detected plates to consider (highest confidence first).
MAX_PLATES = int(os.environ.get("ANPR_MAX_PLATES", "2"))

_lock = threading.Lock()
_detector: LicensePlateDetector | None = None
_ocr: LicensePlateRecognizer | None = None


def load_models() -> None:
    global _detector, _ocr
    if _detector is None:
        _detector = LicensePlateDetector(detection_model=DETECTOR_MODEL)
    if _ocr is None:
        _ocr = LicensePlateRecognizer(OCR_MODEL)


@dataclass
class AnprResult:
    plate: str | None
    confidence: float
    found: bool
    ms: int


def _decode_image(data: bytes) -> np.ndarray | None:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def _crop(img: np.ndarray, x1: int, y1: int, x2: int, y2: int, pad: float = 0.12) -> np.ndarray:
    h, w = img.shape[:2]
    bw, bh = x2 - x1, y2 - y1
    px, py = int(bw * pad), int(bh * pad)
    nx1, ny1 = max(0, x1 - px), max(0, y1 - py)
    nx2, ny2 = min(w, x2 + px), min(h, y2 + py)
    return img[ny1:ny2, nx1:nx2].copy()


def _upscale(crop: np.ndarray, target_h: int = 96) -> np.ndarray:
    h = crop.shape[0]
    if h >= target_h:
        return crop
    scale = target_h / max(1, h)
    return cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def _contrast(crop: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    eq = clahe.apply(gray)
    return cv2.cvtColor(eq, cv2.COLOR_GRAY2BGR)


def _sharpen(crop: np.ndarray) -> np.ndarray:
    blur = cv2.GaussianBlur(crop, (0, 0), 3)
    return cv2.addWeighted(crop, 1.5, blur, -0.5, 0)


def _variants(crop: np.ndarray) -> list[np.ndarray]:
    """A small, bounded set of preprocessing variants (CPU friendly)."""
    up = _upscale(crop)
    out = [up, _contrast(up), _sharpen(up)]
    return out


def _score(char_probs) -> float:
    try:
        probs = [float(p) for p in char_probs if p is not None]
        if not probs:
            return 0.0
        # Mean confidence across characters; robust enough for thresholding.
        return float(sum(probs) / len(probs))
    except Exception:
        return 0.0


def recognize(data: bytes) -> AnprResult:
    start = time.time()
    load_models()
    assert _detector is not None and _ocr is not None

    img = _decode_image(data)
    if img is None:
        return AnprResult(None, 0.0, False, int((time.time() - start) * 1000))

    with _lock:
        detections = _detector.predict(img)

    if not detections:
        return AnprResult(None, 0.0, False, int((time.time() - start) * 1000))

    detections = sorted(detections, key=lambda d: d.confidence, reverse=True)[:MAX_PLATES]

    best_plate: str | None = None
    best_conf = 0.0

    for det in detections:
        bb = det.bounding_box
        crop = _crop(img, int(bb.x1), int(bb.y1), int(bb.x2), int(bb.y2))
        if crop.size == 0:
            continue
        for variant in _variants(crop):
            try:
                with _lock:
                    preds = _ocr.run(variant, return_confidence=True)
            except Exception:
                continue
            if not preds:
                continue
            pred = preds[0]
            text = str(getattr(pred, "plate", "") or "").strip()
            conf = _score(getattr(pred, "char_probs", []))
            # Weight OCR confidence by detector confidence to prefer clear plates.
            weighted = conf * (0.6 + 0.4 * float(det.confidence))
            if text and weighted > best_conf:
                best_conf = weighted
                best_plate = text

    ms = int((time.time() - start) * 1000)
    if best_plate is None:
        return AnprResult(None, 0.0, True, ms)  # found a region but no OCR
    return AnprResult(best_plate, round(best_conf, 4), True, ms)
