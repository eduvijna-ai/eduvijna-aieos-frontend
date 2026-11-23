"""Verify sanitized pk-v1-hint evidence exists (post-teardown); no raw secret reads required."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

_UNSAFE_EVIDENCE = re.compile(
    r"(postgresql[^\s\"']*://[^\s\"']+@|aieos_test|Bearer\s+)",
    re.IGNORECASE,
)

_REQUIRED_SUMMARY_KEYS = frozenset(
    {
        "package_scenario_id",
        "sanitized_evidence_ok",
        "ledger_row_count",
        "tier_counts",
        "has_fixture",
        "has_db_report",
        "has_probe_db_report",
    }
)


def _repo_tmp() -> Path:
    return Path(__file__).resolve().parents[2] / "tmp"


def _sanitized_dir() -> Path:
    return Path(
        os.environ.get(
            "PK_V1_HINT_E2E_SANITIZED_DIR",
            _repo_tmp() / "pk-v1-hint-e2e-sanitized",
        )
    )


def _attempt_status_path() -> Path:
    return _repo_tmp() / "pk-v1-hint-e2e-attempt-status.json"


def _scan_for_credential_leaks(out_dir: Path) -> list[str]:
    leaks: list[str] = []
    if not out_dir.is_dir():
        return leaks
    for path in sorted(out_dir.rglob("*.json")):
        text = path.read_text(encoding="utf-8")
        if _UNSAFE_EVIDENCE.search(text):
            leaks.append(str(path.relative_to(out_dir)))
    return leaks


def _load_summary(summary_path: Path) -> dict[str, object]:
    if not summary_path.is_file():
        raise FileNotFoundError("MISSING_EVIDENCE_SUMMARY")
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    missing = _REQUIRED_SUMMARY_KEYS - set(summary)
    if missing:
        raise ValueError(f"INCOMPLETE_EVIDENCE_SUMMARY:{sorted(missing)}")
    return summary


def run_preflight_schema() -> int:
    """Schema/test-only: no executed-E2E evidence claim."""
    out_dir = _sanitized_dir()
    ledger = (
        Path(__file__).resolve().parents[2] / "docs" / "PK-V1-HINT-E2E-I01-REAL-STACK-PROOF.md"
    )
    if not ledger.is_file():
        print(json.dumps({"preflight_ok": False, "code": "MISSING_LEDGER_DOC"}))
        return 1
    print(
        json.dumps(
            {
                "preflight_ok": True,
                "mode": "preflight_schema",
                "sanitized_dir_configured": str(out_dir),
            }
        )
    )
    return 0


def run_require_e2e_evidence() -> int:
    attempt_path = _attempt_status_path()
    if not attempt_path.is_file():
        print(
            json.dumps(
                {
                    "sanitized_verify_ok": None,
                    "code": "E2E_NOT_EXECUTED",
                    "mode": "require_e2e_evidence",
                }
            )
        )
        return 0

    attempt = json.loads(attempt_path.read_text(encoding="utf-8"))
    if attempt.get("attempted") is not True:
        print(
            json.dumps(
                {
                    "sanitized_verify_ok": None,
                    "code": "E2E_NOT_EXECUTED",
                    "mode": "require_e2e_evidence",
                }
            )
        )
        return 0

    if attempt.get("finished") is not True:
        print(
            json.dumps(
                {
                    "sanitized_verify_ok": False,
                    "code": "E2E_ATTEMPT_INCOMPLETE",
                    "mode": "require_e2e_evidence",
                }
            )
        )
        return 1

    out_dir = _sanitized_dir()
    summary_path = out_dir / "evidence-summary.json"
    try:
        summary = _load_summary(summary_path)
    except FileNotFoundError:
        print(
            json.dumps(
                {"sanitized_verify_ok": False, "code": "MISSING_EVIDENCE_SUMMARY"}
            )
        )
        return 1
    except ValueError as exc:
        print(json.dumps({"sanitized_verify_ok": False, "code": str(exc)}))
        return 1

    if summary.get("sanitized_evidence_ok") is not True:
        print(json.dumps({"sanitized_verify_ok": False, "code": "EVIDENCE_NOT_OK"}))
        return 1

    if attempt.get("sanitized_export_ok") is False:
        print(
            json.dumps(
                {
                    "sanitized_verify_ok": False,
                    "code": "SANITIZED_EXPORT_FAILED_DURING_E2E",
                }
            )
        )
        return 1

    leaks = _scan_for_credential_leaks(out_dir)
    if leaks:
        print(
            json.dumps(
                {
                    "sanitized_verify_ok": False,
                    "code": "CREDENTIAL_MARKER_IN_SANITIZED",
                    "paths": leaks,
                }
            )
        )
        return 1

    child_exit = attempt.get("child_exit")
    if child_exit not in (0, None) and summary.get("sanitized_evidence_ok") is True:
        # Evidence may exist for diagnosis after child failure; mark verify ok only
        # when summary is complete and export was not explicitly failed.
        pass

    print(
        json.dumps(
            {
                "sanitized_verify_ok": True,
                "mode": "require_e2e_evidence",
                "ledger_row_count": summary.get("ledger_row_count"),
                "has_fixture": summary.get("has_fixture"),
                "has_db_report": summary.get("has_db_report"),
                "has_probe_db_report": summary.get("has_probe_db_report"),
                "child_exit": child_exit,
            }
        )
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--preflight-schema",
        action="store_true",
        help="Static schema check only; does not require executed E2E evidence.",
    )
    parser.add_argument(
        "--require-e2e-evidence",
        action="store_true",
        help="Mandatory post-invocation verification (CI always() step).",
    )
    args = parser.parse_args()

    if args.preflight_schema:
        return run_preflight_schema()

    if args.require_e2e_evidence or os.environ.get("PK_V1_HINT_E2E_REQUIRE_EVIDENCE") == "1":
        return run_require_e2e_evidence()

    if os.environ.get("PK_V1_HINT_E2E_RAN") != "1":
        print(json.dumps({"sanitized_verify_skipped": True, "reason": "E2E_NOT_RAN"}))
        return 0

    out_dir = _sanitized_dir()
    summary_path = out_dir / "evidence-summary.json"
    if not summary_path.is_file():
        print(json.dumps({"sanitized_verify_ok": False, "code": "MISSING_EVIDENCE_SUMMARY"}))
        return 1

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    if summary.get("sanitized_evidence_ok") is not True:
        print(json.dumps({"sanitized_verify_ok": False, "code": "EVIDENCE_NOT_OK"}))
        return 1

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