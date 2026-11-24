"""Privacy audit for PK-V1-HINT sanitized CI artifact upload (not an E2E_PASS claim)."""

from __future__ import annotations

import argparse
import json
import os
import stat
import sys
from pathlib import Path
from typing import Any

from artifact_semantic_validation import (
    validate_db_fields,
    validate_fixture_fields,
    validate_summary_fields,
)
from export_sanitize import (
    ALLOWLIST_DB_REPORT,
    ALLOWLIST_FIXTURE,
    ALLOWLIST_SUMMARY,
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


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _sanitized_dir() -> Path:
    return Path(
        os.environ.get(
            "PK_V1_HINT_E2E_SANITIZED_DIR",
            _repo_root() / "tmp" / "pk-v1-hint-e2e-sanitized",
        )
    )


def _assert_allowlisted_keys(obj: dict[str, Any], allowlist: frozenset[str]) -> str | None:
    extra = set(obj.keys()) - set(allowlist)
    if extra:
        return "UNKNOWN_KEY"
    return None


def _validate_summary_payload(obj: dict[str, Any], *, require_full_bundle: bool) -> str | None:
    code = _assert_allowlisted_keys(obj, ALLOWLIST_SUMMARY)
    if code:
        return code
    if obj.get("evidence_contract_version") != EVIDENCE_CONTRACT_VERSION:
        return "UNSUPPORTED_EVIDENCE_CONTRACT"
    if obj.get("package_scenario_id") != PACKAGE_SCENARIO_ID:
        return "PACKAGE_SCENARIO_MISMATCH"
    semantic = validate_summary_fields(obj, require_authority_pins=require_full_bundle)
    if semantic:
        return semantic
    try:
        build_summary_export(obj)
    except ValueError:
        return "SUMMARY_EXPORT_SHAPE"
    return None


def _validate_db_payload(obj: dict[str, Any], *, role: str) -> str | None:
    code = _assert_allowlisted_keys(obj, ALLOWLIST_DB_REPORT)
    if code:
        return code
    semantic = validate_db_fields(obj, role=role)
    if semantic:
        return semantic
    try:
        build_db_report_export({**obj, "role": role})
    except ValueError:
        return "DB_EXPORT_SHAPE"
    return None


def _validate_fixture_payload(obj: dict[str, Any]) -> str | None:
    code = _assert_allowlisted_keys(obj, ALLOWLIST_FIXTURE)
    if code:
        return code
    semantic = validate_fixture_fields(obj)
    if semantic:
        return semantic
    try:
        build_fixture_export(obj)
    except ValueError:
        return "FIXTURE_EXPORT_SHAPE"
    return None


def _enumerate_flat_entries(out_dir: Path) -> tuple[list[Path] | None, str | None]:
    entries: list[Path] = []
    try:
        if out_dir.is_symlink():
            return None, "SYMLINK_ENTRY"
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
            mode = entry.stat().st_mode
            if stat.S_ISFIFO(mode) or stat.S_ISSOCK(mode):
                return None, "SPECIAL_FILE_ENTRY"
            if entry.stat().st_nlink > 1:
                return None, "HARDLINKED_FILE_ENTRY"
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
            return False, "UNALLOWED_ARTIFACT_FILE", {"audit_ok": False}

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
            return False, "MALFORMED_JSON", {"audit_ok": False}
        if not isinstance(obj, dict) or not obj:
            return False, "EMPTY_OR_NON_OBJECT_JSON", {"audit_ok": False}
        parsed[entry.name] = obj

    summary_err = _validate_summary_payload(
        parsed["evidence-summary.json"],
        require_full_bundle=require_full_bundle,
    )
    if summary_err:
        return False, summary_err, {"audit_ok": False}

    if "db-report-sanitized.json" in parsed:
        err = _validate_db_payload(parsed["db-report-sanitized.json"], role="primary")
        if err:
            return False, err, {"audit_ok": False}
    if "probe-db-report-sanitized.json" in parsed:
        err = _validate_db_payload(parsed["probe-db-report-sanitized.json"], role="probe")
        if err:
            return False, err, {"audit_ok": False}
    if "fixture-sanitized.json" in parsed:
        err = _validate_fixture_payload(parsed["fixture-sanitized.json"])
        if err:
            return False, err, {"audit_ok": False}

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