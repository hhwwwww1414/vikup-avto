"""
Offline ANPR benchmark (TZ §48 / §61).

Usage:
    python benchmark.py /path/to/images [expected.csv]

- Runs the full pipeline over every image in the folder.
- expected.csv (optional): lines "filename,EXPECTEDPLATE" (normalized RU form,
  e.g. О101НТ790). When provided, correctness is measured; otherwise the script
  only reports how many plates were recognized.

Prints:
    total, correct, failed, wrong, accuracy, average_processing_time
"""
from __future__ import annotations

import csv
import os
import re
import sys
import time

from anpr import recognize

# --- Minimal RU normalization mirroring the Node-side logic (benchmark only) --
LAT2CYR = {
    "A": "А", "B": "В", "E": "Е", "K": "К", "M": "М", "H": "Н",
    "O": "О", "P": "Р", "C": "С", "T": "Т", "Y": "У", "X": "Х",
}
CYR = set("АВЕКМНОРСТУХ")
D2L = {"0": "О", "8": "В", "1": "Т", "2": "Е", "3": "Е"}
L2D = {"О": "0", "В": "8", "Т": "1"}
PLATE_RE = re.compile(r"^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$")


def canon(s: str) -> str:
    out = []
    for ch in s.upper():
        out.append(LAT2CYR.get(ch, ch))
    return re.sub(r"[^0-9А-Я]", "", "".join(out))


def context_correct(s: str) -> str | None:
    if len(s) not in (8, 9):
        return None
    c = list(s)

    def to_letter(x):
        return x if x in CYR else D2L.get(x, x)

    def to_digit(x):
        return x if x.isdigit() else L2D.get(x, x)

    c[0] = to_letter(c[0])
    c[1] = to_digit(c[1]); c[2] = to_digit(c[2]); c[3] = to_digit(c[3])
    c[4] = to_letter(c[4]); c[5] = to_letter(c[5])
    for i in range(6, len(c)):
        c[i] = to_digit(c[i])
    return "".join(c)


def ru_normalize(raw: str) -> str | None:
    if not raw:
        return None
    cands = {canon(raw)}
    cc = context_correct(canon(raw))
    if cc:
        cands.add(cc)
    for cand in cands:
        if PLATE_RE.match(cand):
            return cand
    return None


def ru_normalize_candidates(raws: list[str]) -> str | None:
    candidates: list[str] = []
    for raw in raws:
        if not raw:
            continue
        c = canon(raw)
        candidates.append(c)
        cc = context_correct(c)
        if cc:
            candidates.append(cc)

    fused: set[str] = set()
    for left in candidates:
        two = re.match(r"^([АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2})(\d{2})$", left)
        if not two:
            continue
        for right in candidates:
            missing = re.match(r"^([АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ])(\d{3})$", right)
            if not missing:
                continue
            if two.group(1)[:5] != missing.group(1):
                continue
            if missing.group(2).endswith(two.group(2)):
                fused.add(f"{two.group(1)}{missing.group(2)}")

    for cand in sorted([*fused, *candidates], key=len, reverse=True):
        if PLATE_RE.match(cand):
            return cand
    return None


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: python benchmark.py <images_dir> [expected.csv]")
        sys.exit(1)

    images_dir = sys.argv[1]
    expected: dict[str, str] = {}
    if len(sys.argv) >= 3 and os.path.exists(sys.argv[2]):
        with open(sys.argv[2], newline="", encoding="utf-8") as f:
            for row in csv.reader(f):
                if len(row) >= 2:
                    expected[row[0].strip()] = row[1].strip().upper()

    files = [
        f for f in sorted(os.listdir(images_dir))
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp"))
    ]
    total = correct = failed = wrong = 0
    times: list[int] = []

    print(f"{'file':<28} {'expected':<12} {'recognized':<12} result   ms")
    print("-" * 72)
    for name in files:
        with open(os.path.join(images_dir, name), "rb") as fh:
            data = fh.read()
        t0 = time.time()
        res = recognize(data)
        ms = int((time.time() - t0) * 1000)
        times.append(ms)
        total += 1

        raws = [res.plate or "", *getattr(res, "candidates", [])]
        norm = ru_normalize_candidates(raws)
        exp = expected.get(name)

        if norm is None:
            failed += 1
            result = "FAIL"
        elif exp is None:
            result = "OK?"  # no ground truth
        elif norm == exp:
            correct += 1
            result = "CORRECT"
        else:
            wrong += 1
            result = "WRONG"

        print(f"{name:<28} {(exp or '-'):<12} {(norm or '-'):<12} {result:<8} {ms}")

    avg = int(sum(times) / len(times)) if times else 0
    graded = correct + wrong
    accuracy = (correct / graded * 100) if graded else 0.0

    print("-" * 72)
    print(f"total:                   {total}")
    print(f"correct:                 {correct}")
    print(f"failed (no plate):       {failed}")
    print(f"wrong:                   {wrong}")
    print(f"accuracy (of graded):    {accuracy:.1f}%")
    print(f"average_processing_time: {avg} ms")


if __name__ == "__main__":
    main()
