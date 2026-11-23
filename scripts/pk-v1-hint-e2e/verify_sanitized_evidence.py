"""Verify sanitized pk-v1-hint evidence exists (post-teardown); no raw secret reads required."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def main() -> int:
    if os.environ.get("PK_V1_HINT_E2E_RAN") != "1":
        print(json.dumps({"sanitized_verify_skipped": True, "reason": "E2E_NOT_RAN"}))
        return 0

    repo_tmp = Path(__file__).resolve().parents[2] / "tmp"
    out_dir = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_SANITIZED_DIR",
            repo_tmp / "pk-v1-hint-e2e-sanitized",
        )
    )
    summary_path = out_dir / "evidence-summary.json"
    if not summary_path.is_file():
        print(json.dumps({"sanitized_verify_ok": False, "code": "MISSING_EVIDENCE_SUMMARY"}))
        return 1

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    if summary.get("sanitized_evidence_ok") is not True:
        print(json.dumps({"sanitized_verify_ok": False, "code": "EVIDENCE_NOT_OK"}))
        return 1

    # Ledger row count is informational only until live CI maps scenarios.
    print(
        json.dumps(
            {
                "sanitized_verify_ok": True,
                "ledger_row_count": summary.get("ledger_row_count"),
                "has_fixture": summary.get("has_fixture"),
                "has_db_report": summary.get("has_db_report"),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())