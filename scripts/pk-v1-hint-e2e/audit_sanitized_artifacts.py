"""Privacy audit for PK-V1-HINT sanitized CI artifact upload (not an E2E_PASS claim)."""

from __future__ import annotations

import argparse
import json
import os
import stat
import sys
from pathlib import Path
from typing import Any

from export_sanitize import (
    ALLOWLIST_DB_REPORT,
    ALLOWLIST_FIXTURE,
    ALLOWLIST_SUMMARY,
    ALLOWED_EVIDENCE_TIERS,
    EVIDENCE_CONTRACT_VERSION,
    PACKAGE_SCENARIO_ID,
    SECRET_MARKERS,
    assert_export_has_no_secrets,
    build_db_report_export,
    build_fixture_export,
    build_summary_export,
)

_ALLOWED_TOP_FILES = frozenset(
    {
        "evidence-summary.json",
        "fixture-sanitized.json",
        "db-report-sanitized.json",
        "probe-db-report-sanitized.json",
    }
)

_FORBIDDEN_SUFFIXES = (".html", ".zip", ".png", ".webm", ".trace", ".log")

_SCALAR = (str, int, float, bool, type(None))
_MAX_STRING_LEN = 256


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _sanitized_dir() -> Path:
    return Path(
        os.environ.get(
            "PK_V1_HINT_E2E_SANITIZED_DIR",
            _repo_root() / "tmp" / "pk-v1-hint-e2e-sanitized",
        )
    )


def _reject_unsafe_string(value: Any, field: str) -> str | None:
    if not isinstance(value, str):
        return f"{field}_TYPE"
    if len(value) > _MAX_STRING_LEN:
        return f"{field}_TOO_LONG"
    if "\n" in value or "\r" in value:
        return f"{field}_MULTILINE"
    if SECRET_MARKERS.search(value):
        return f"{field}_SECRET_MARKER"
    return None


def _assert_allowlisted_keys(obj: dict[str, Any], allowlist: frozenset[str]) -> str | None:
    extra = set(obj.keys()) - set(allowlist)
    if extra:
        return f"UNKNOWN_KEY:{sorted(extra)[0]}"
    return None


def _validate_summary_payload(obj: dict[str, Any], *, require_full_bundle: bool) -> str | None:
    code = _assert_allowlisted_keys(obj, ALLOWLIST_SUMMARY)
    if code:
        return code
    if obj.get("evidence_contract_version") != EVIDENCE_CONTRACT_VERSION:
        return "UNSUPPORTED_EVIDENCE_CONTRACT"
    if obj.get("package_scenario_id") != PACKAGE_SCENARIO_ID:
        return "PACKAGE_SCENARIO_MISMATCH"
    if not isinstance(obj.get("sanitized_evidence_ok"), bool):
        return "SANITIZED_EVIDENCE_OK_TYPE"
    tier_counts = obj.get("tier_counts")
    if tier_counts is not None:
        if not isinstance(tier_counts, dict):
            return "TIER_COUNTS_TYPE"
        total = 0
        for key, value in tier_counts.items():
            if not isinstance(key, str) or key not in ALLOWED_EVIDENCE_TIERS:
                return "TIER_COUNTS_KEY"
            if not isinstance(value, int) or value < 0:
                return "TIER_COUNTS_VALUE"
            total += value
        if require_full_bundle and total != 67:
            return "TIER_COUNTS_SUM"
    for key in ("ledger_row_count", "generated_at_ms"):
        if key in obj and not isinstance(obj[key], int):
            return f"{key}_TYPE"
    for key in (
        "attempt_run_id",
        "github_sha",
        "backend_pin_sha",
        "openapi_authority_sha",
        "migration_head",
    ):
        if key in obj:
            err = _reject_unsafe_string(obj[key], key)
            if err:
                return err
    for key in ("has_fixture", "has_db_report", "has_probe_db_report"):
        if key in obj and not isinstance(obj[key], bool):
            return f"{key}_TYPE"
    try:
        build_summary_export(obj)
    except ValueError:
        return "SUMMARY_EXPORT_SHAPE"
    return None


def _validate_db_payload(obj: dict[str, Any], *, role: str) -> str | None:
    code = _assert_allowlisted_keys(obj, ALLOWLIST_DB_REPORT)
    if code:
        return code
    if obj.get("role") != role:
        return "DB_ROLE_MISMATCH"
    if obj.get("postgres_major") != 18:
        return "POSTGRES_MAJOR"
    if obj.get("bootstrap_ok") is not True:
        return "BOOTSTRAP_NOT_OK"
    for key in ("migration_head", "backend_pin_sha", "container_name", "container_id_prefix"):
        if key in obj:
            err = _reject_unsafe_string(obj[key], key)
            if err:
                return err
    try:
        build_db_report_export({**obj, "role": role})
    except ValueError:
        return "DB_EXPORT_SHAPE"
    return None


def _validate_fixture_payload(obj: dict[str, Any]) -> str | None:
    code = _assert_allowlisted_keys(obj, ALLOWLIST_FIXTURE)
    if code:
        return code
    if obj.get("seed_ok") is not True:
        return "SEED_NOT_OK"
    for key, value in obj.items():
        if isinstance(value, str):
            err = _reject_unsafe_string(value, key)
            if err:
                return err
    try:
        build_fixture_export(obj)
    except ValueError:
        return "FIXTURE_EXPORT_SHAPE"
    return None


def _enumerate_flat_entries(out_dir: Path) -> tuple[list[Path] | None, str | None]:
    entries: list[Path] = []
    try:
        names = sorted(out_dir.iterdir(), key=lambda p: p.name)
    except OSError:
        return None, "DIR_READ_FAILED"
    for entry in names:
        name = entry.name
        if name.startswith("."):
            return None, "HIDDEN_ENTRY"
        try:
            if entry.is_symlink():
                return None, "SYMLINK_ENTRY"
            if entry.is_dir():
                return None, "NESTED_DIRECTORY"
            if not entry.is_file():
                return None, "SPECIAL_FILE_ENTRY"
            if stat.S_ISFIFO(entry.stat().st_mode) or stat.S_ISSOCK(entry.stat().st_mode):
                return None, "SPECIAL_FILE_ENTRY"
        except OSError:
            return None, "ENTRY_STAT_FAILED"
        if any(name.endswith(suffix) for suffix in _FORBIDDEN_SUFFIXES):
            return None, "FORBIDDEN_ARTIFACT_TYPE"
        entries.append(entry)
    return entries, None


def audit_sanitized_dir(out_dir: Path) -> tuple[bool, str, dict]:
    if not out_dir.is_dir():
        return False, "MISSING_SANITIZED_DIR", {"audit_ok": False}

    entries, enum_err = _enumerate_flat_entries(out_dir)
    if enum_err:
        return False, enum_err, {"audit_ok": False}

    if not entries:
        return False, "EMPTY_SANITIZED_DIR", {"audit_ok": False}

    file_names = [p.name for p in entries]
    for name in file_names:
        if name not in _ALLOWED_TOP_FILES:
            return False, "UNALLOWED_ARTIFACT_FILE", {"audit_ok": False, "file": name}

    if "evidence-summary.json" not in file_names:
        return False, "MISSING_EVIDENCE_SUMMARY", {"audit_ok": False}

    require_full_bundle = {
        "fixture-sanitized.json",
        "db-report-sanitized.json",
        "probe-db-report-sanitized.json",
    }.issubset(file_names)

    parsed: dict[str, dict[str, Any]] = {}
    for entry in entries:
        try:
            obj = json.loads(entry.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return False, "MALFORMED_JSON", {"audit_ok": False, "file": entry.name}
        if not isinstance(obj, dict) or not obj:
            return False, "EMPTY_OR_NON_OBJECT_JSON", {"audit_ok": False, "file": entry.name}
        parsed[entry.name] = obj

    summary_err = _validate_summary_payload(
        parsed["evidence-summary.json"],
        require_full_bundle=require_full_bundle,
    )
    if summary_err:
        return False, summary_err, {"audit_ok": False, "file": "evidence-summary.json"}

    if "db-report-sanitized.json" in parsed:
        err = _validate_db_payload(parsed["db-report-sanitized.json"], role="primary")
        if err:
            return False, err, {"audit_ok": False, "file": "db-report-sanitized.json"}
    if "probe-db-report-sanitized.json" in parsed:
        err = _validate_db_payload(parsed["probe-db-report-sanitized.json"], role="probe")
        if err:
            return False, err, {"audit_ok": False, "file": "probe-db-report-sanitized.json"}
    if "fixture-sanitized.json" in parsed:
        err = _validate_fixture_payload(parsed["fixture-sanitized.json"])
        if err:
            return False, err, {"audit_ok": False, "file": "fixture-sanitized.json"}

    leaks: list[str] = []
    for entry in entries:
        text = entry.read_text(encoding="utf-8", errors="replace")
        try:
            assert_export_has_no_secrets(text)
        except ValueError:
            leaks.append(entry.name)

    if leaks:
        return False, "CREDENTIAL_MARKER_IN_ARTIFACT", {
            "audit_ok": False,
            "paths": leaks,
        }

    return True, "UPLOAD_SAFE", {
        "audit_ok": True,
        "files": file_names,
        "upload_safe": True,
        "e2e_pass_claim": False,
        "partial_bundle": not require_full_bundle,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--upload-audit",
        action="store_true",
        help="Allowlisted privacy audit for CI artifact upload only.",
    )
    args = parser.parse_args()
    if not args.upload_audit:
        print(json.dumps({"audit_ok": False, "code": "MODE_REQUIRED"}))
        return 2

    ok, code, payload = audit_sanitized_dir(_sanitized_dir())
    payload = {"code": code, **payload}
    print(json.dumps(payload))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())