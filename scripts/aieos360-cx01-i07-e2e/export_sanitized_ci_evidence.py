"""Sanitize CX01-I07 CI failure artifacts — never export raw fixture or bearer tokens."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
EXPORT_DIR = REPO_ROOT / "tmp" / "cx01-i07-proof-exports"
I01_SCRIPT = REPO_ROOT / "scripts" / "aieos360-cx01-i01r9-showcase-rehearsal"
sys.path.insert(0, str(I01_SCRIPT))

from export_sanitize import write_sanitized_json  # noqa: E402

INPUTS = [
    REPO_ROOT / "tmp" / "aieos360-cx01-i07-rehearsal-report.json",
    REPO_ROOT / "tmp" / "aieos360-cx01-i07-e2e-persistence.json",
]

FORBIDDEN_RAW = [
    "tmp/aieos360-cx01-i01-showcase-fixture.json",
    "tmp/aieos360-cx01-i01-showcase-manifest.json",
    "tmp/aieos360-cx01-i01-showcase-db.json",
]


def main() -> int:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    for path in INPUTS:
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        out = EXPORT_DIR / f"{path.stem}-sanitized.json"
        write_sanitized_json(str(out), payload)
    manifest = {
        "package": "AIEOS360-CX01-I07",
        "sanitized_only": True,
        "forbidden_raw_paths": FORBIDDEN_RAW,
    }
    write_sanitized_json(
        str(EXPORT_DIR / "cx01-i07-export-manifest.json"),
        manifest,
    )
    print(f"CX01-I07 sanitized exports: {EXPORT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
