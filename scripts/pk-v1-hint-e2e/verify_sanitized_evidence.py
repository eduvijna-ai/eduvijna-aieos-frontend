"""Verify sanitized pk-v1-hint evidence exists (post-teardown); no raw secret reads required."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from export_sanitize import (
    ALLOWED_EVIDENCE_TIERS,
    EVIDENCE_CONTRACT_VERSION,
    PACKAGE_SCENARIO_ID,
)
from sp02a_ledger import parse_sp02a_ledger_doc, repo_ledger_doc

EXPECTED_BACKEND_PIN_SHA = "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa"
EXPECTED_OPENAPI_AUTHORITY_SHA = (
    "0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22"
)
EXPECTED_MIGRATION_HEAD = "a360s010005"

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
        "evidence_contract_version",
        "generated_at_ms",
        "attempt_run_id",
    }
)

_OPTIONAL_SUMMARY_KEYS = frozenset(
    {
        "github_sha",
        "backend_pin_sha",
        "openapi_authority_sha",
        "migration_head",
    }
)

_SANITIZED_ARTIFACTS = {
    "fixture": "fixture-sanitized.json",
    "db_report": "db-report-sanitized.json",
    "probe_db_report": "probe-db-report-sanitized.json",
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _repo_tmp() -> Path:
    return _repo_root() / "tmp"


def _sanitized_dir() -> Path:
    return Path(
        os.environ.get(
            "PK_V1_HINT_E2E_SANITIZED_DIR",
            _repo_tmp() / "pk-v1-hint-e2e-sanitized",
        )
    )


def _attempt_status_path() -> Path:
    if os.environ.get("PK_V1_HINT_E2E_VERIFIER_TEST_INJECT") == "1":
        override = os.environ.get("PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH")
        if override:
            return Path(override)
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


def _load_summary(summary_path: Path) -> dict[str, Any]:
    if not summary_path.is_file():
        raise FileNotFoundError("MISSING_EVIDENCE_SUMMARY")
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    missing = _REQUIRED_SUMMARY_KEYS - set(summary)
    if missing:
        raise ValueError(f"INCOMPLETE_EVIDENCE_SUMMARY:{sorted(missing)}")
    if summary.get("evidence_contract_version") != EVIDENCE_CONTRACT_VERSION:
        raise ValueError("UNSUPPORTED_EVIDENCE_CONTRACT_VERSION")
    return summary


def _validate_tier_counts(tier_counts: object, ledger_row_count: int) -> None:
    if not isinstance(tier_counts, dict):
        raise ValueError("INVALID_TIER_COUNTS")
    total = 0
    for key, value in tier_counts.items():
        if not isinstance(key, str) or key not in ALLOWED_EVIDENCE_TIERS:
            raise ValueError(f"UNKNOWN_TIER:{key}")
        if not isinstance(value, int) or value < 0:
            raise ValueError(f"INVALID_TIER_COUNT:{key}")
        total += value
    if total != ledger_row_count:
        raise ValueError("TIER_COUNT_SUM_MISMATCH")


def _validate_ledger_against_doc(summary: dict[str, Any]) -> None:
    _, doc_tiers = parse_sp02a_ledger_doc(repo_ledger_doc(_repo_root()))
    summary_tiers = summary.get("tier_counts")
    if summary_tiers != doc_tiers:
        raise ValueError("LEDGER_TIER_COUNTS_MISMATCH_COMMITTED_DOC")
    fabricated = int(summary_tiers.get("REAL_STACK_EXECUTED_PASS", 0)) + int(
        summary_tiers.get("CURRENT_BACKEND_PG_HTTP_PROOF", 0)
    )
    if fabricated > 0:
        raise ValueError("FABRICATED_RUNTIME_PASS_BEFORE_CI")


def _artifact_presence(out_dir: Path, summary: dict[str, Any]) -> None:
    for flag, filename in (
        ("has_fixture", _SANITIZED_ARTIFACTS["fixture"]),
        ("has_db_report", _SANITIZED_ARTIFACTS["db_report"]),
        ("has_probe_db_report", _SANITIZED_ARTIFACTS["probe_db_report"]),
    ):
        path = out_dir / filename
        claimed = summary.get(flag) is True
        exists = path.is_file()
        if claimed and not exists:
            raise ValueError(f"FORGED_ARTIFACT_FLAG:{flag}")
        if exists and not claimed:
            raise ValueError(f"UNCLAIMED_ARTIFACT_FILE:{filename}")


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _validate_source_pins(out_dir: Path, summary: dict[str, Any]) -> None:
    if summary.get("backend_pin_sha") and summary["backend_pin_sha"] != EXPECTED_BACKEND_PIN_SHA:
        raise ValueError("WRONG_BACKEND_PIN_SHA")
    if summary.get("migration_head") and summary["migration_head"] != EXPECTED_MIGRATION_HEAD:
        raise ValueError("WRONG_MIGRATION_HEAD")
    if summary.get("openapi_authority_sha") and summary[
        "openapi_authority_sha"
    ] != EXPECTED_OPENAPI_AUTHORITY_SHA:
        raise ValueError("WRONG_OPENAPI_SHA")

    db_path = out_dir / _SANITIZED_ARTIFACTS["db_report"]
    if db_path.is_file():
        db = _read_json(db_path)
        pin = db.get("backend_pin_sha")
        if pin and pin != EXPECTED_BACKEND_PIN_SHA:
            raise ValueError("WRONG_BACKEND_PIN_IN_DB_REPORT")
        head = db.get("migration_head")
        if head and head != EXPECTED_MIGRATION_HEAD:
            raise ValueError("WRONG_MIGRATION_IN_DB_REPORT")

    fixture_path = out_dir / _SANITIZED_ARTIFACTS["fixture"]
    if fixture_path.is_file():
        fixture = _read_json(fixture_path)
        openapi = fixture.get("openapi_authority_sha")
        if openapi and openapi != EXPECTED_OPENAPI_AUTHORITY_SHA:
            raise ValueError("WRONG_OPENAPI_IN_FIXTURE")

    if summary.get("package_scenario_id") != PACKAGE_SCENARIO_ID:
        raise ValueError("WRONG_PACKAGE_SCENARIO_ID")


def _validate_attempt_binding(attempt: dict[str, Any], summary: dict[str, Any]) -> None:
    attempt_id = attempt.get("attempt_run_id")
    summary_id = summary.get("attempt_run_id")
    if attempt_id and summary_id and attempt_id != summary_id:
        raise ValueError("STALE_ATTEMPT_RUN_ID_MISMATCH")

    started = attempt.get("started_at_ms")
    generated = summary.get("generated_at_ms")
    if isinstance(started, int) and isinstance(generated, int) and generated < started:
        raise ValueError("STALE_EVIDENCE_GENERATED_BEFORE_ATTEMPT")

    github_attempt = attempt.get("github_sha")
    github_summary = summary.get("github_sha")
    if github_attempt and github_summary and github_attempt != github_summary:
        raise ValueError("GITHUB_SHA_MISMATCH")


def evaluate_require_e2e_evidence(
    attempt: dict[str, Any],
    out_dir: Path,
) -> tuple[bool, str, dict[str, Any]]:
    if attempt.get("attempted") is not True:
        return True, "E2E_NOT_EXECUTED", {"sanitized_verify_ok": None}

    if attempt.get("finished") is not True:
        return False, "E2E_ATTEMPT_INCOMPLETE", {"sanitized_verify_ok": False}

    child_exit = attempt.get("child_exit")
    summary_path = out_dir / "evidence-summary.json"
    try:
        summary = _load_summary(summary_path)
    except FileNotFoundError:
        return False, "MISSING_EVIDENCE_SUMMARY", {"sanitized_verify_ok": False, "child_exit": child_exit}
    except ValueError as exc:
        return False, str(exc), {"sanitized_verify_ok": False, "child_exit": child_exit}

    if summary.get("sanitized_evidence_ok") is not True:
        return False, "EVIDENCE_NOT_OK", {"sanitized_verify_ok": False, "child_exit": child_exit}

    if attempt.get("sanitized_export_ok") is not True:
        return False, "SANITIZED_EXPORT_NOT_OK", {"sanitized_verify_ok": False, "child_exit": child_exit}

    leaks = _scan_for_credential_leaks(out_dir)
    if leaks:
        return (
            False,
            "CREDENTIAL_MARKER_IN_SANITIZED",
            {"sanitized_verify_ok": False, "paths": leaks, "child_exit": child_exit},
        )

    if child_exit not in (0, None):
        return False, "E2E_FAILED", {
            "sanitized_verify_ok": False,
            "child_exit": child_exit,
        }

    try:
        if summary.get("ledger_row_count") != 67:
            raise ValueError("WRONG_LEDGER_ROW_COUNT")
        _validate_tier_counts(summary.get("tier_counts"), 67)
        _validate_ledger_against_doc(summary)
        _artifact_presence(out_dir, summary)
        _validate_attempt_binding(attempt, summary)
        _validate_source_pins(out_dir, summary)
    except ValueError as exc:
        return False, str(exc), {
            "sanitized_verify_ok": False,
            "child_exit": child_exit,
            "detail": str(exc),
        }

    for flag in ("has_fixture", "has_db_report", "has_probe_db_report"):
        if summary.get(flag) is not True:
            return False, "INCOMPLETE_EXECUTED_EVIDENCE", {
                "sanitized_verify_ok": False,
                "child_exit": child_exit,
                "missing": flag,
            }

    if attempt.get("lifecycle_teardown_ok") is False:
        return False, "LIFECYCLE_TEARDOWN_FAILED", {"sanitized_verify_ok": False, "child_exit": child_exit}

    return True, "E2E_PASS", {
        "sanitized_verify_ok": True,
        "mode": "require_e2e_evidence",
        "status": "E2E_PASS",
        "ledger_row_count": summary.get("ledger_row_count"),
        "has_fixture": summary.get("has_fixture"),
        "has_db_report": summary.get("has_db_report"),
        "has_probe_db_report": summary.get("has_probe_db_report"),
        "child_exit": child_exit,
    }


def run_preflight_schema() -> int:
    """Schema/test-only: no executed-E2E evidence claim."""
    out_dir = _sanitized_dir()
    ledger = repo_ledger_doc(_repo_root())
    if not ledger.is_file():
        print(json.dumps({"preflight_ok": False, "code": "MISSING_LEDGER_DOC"}))
        return 1
    try:
        rows, tiers = parse_sp02a_ledger_doc(ledger)
    except (ValueError, FileNotFoundError) as exc:
        print(json.dumps({"preflight_ok": False, "code": str(exc)}))
        return 1
    print(
        json.dumps(
            {
                "preflight_ok": True,
                "mode": "preflight_schema",
                "sanitized_dir_configured": str(out_dir),
                "evidence_contract_version": EVIDENCE_CONTRACT_VERSION,
                "ledger_row_count": len(rows),
                "tier_counts": tiers,
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
    ok, code, payload = evaluate_require_e2e_evidence(attempt, _sanitized_dir())
    payload = {"mode": "require_e2e_evidence", "code": code, **payload}
    print(json.dumps(payload))
    if ok and code == "E2E_NOT_EXECUTED":
        return 0
    return 0 if ok else 1


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
    attempt_path = _attempt_status_path()
    if attempt_path.is_file():
        attempt = json.loads(attempt_path.read_text(encoding="utf-8"))
        ok, code, payload = evaluate_require_e2e_evidence(attempt, out_dir)
        print(json.dumps({"code": code, **payload}))
        if code == "E2E_NOT_EXECUTED":
            return 0
        return 0 if ok else 1

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