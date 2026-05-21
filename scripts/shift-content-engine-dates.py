#!/usr/bin/env python3
"""
Shift post_date column (C) of the master sheet by N days.

Reads:  marketing-footage/social-export/_master-sheet.csv
Writes: marketing-footage/social-export/_master-sheet-shifted.csv

Default shift: +16 days (so cadence resumes 2026-06-03, the day after the
14-day launch arc ends on 2026-06-02). Override with --shift N.
"""
from __future__ import annotations
import argparse
import csv
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "marketing-footage" / "social-export" / "_master-sheet.csv"
DST = ROOT / "marketing-footage" / "social-export" / "_master-sheet-shifted.csv"

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shift", type=int, default=16, help="Days to add (default: 16)")
    args = ap.parse_args()

    with SRC.open() as f:
        reader = csv.reader(f)
        rows = list(reader)

    headers = rows[0]
    assert headers[2] == "post_date", f"Column C is not post_date (got {headers[2]!r})"

    shifted = 0
    skipped = 0
    for row in rows[1:]:
        if not row or len(row) < 3 or not row[2]:
            skipped += 1
            continue
        try:
            y, m, d = (int(x) for x in row[2].split("-"))
            new = date(y, m, d) + timedelta(days=args.shift)
            row[2] = new.isoformat()
            shifted += 1
        except ValueError:
            skipped += 1

    with DST.open("w", newline="") as f:
        csv.writer(f).writerows(rows)

    earliest = min(r[2] for r in rows[1:] if len(r) > 2 and r[2])
    latest = max(r[2] for r in rows[1:] if len(r) > 2 and r[2])
    print(f"Shifted {shifted} dates by {args.shift} days (skipped {skipped} blank/invalid).")
    print(f"New range: {earliest} → {latest}")
    print(f"Output: {DST}")

if __name__ == "__main__":
    main()
