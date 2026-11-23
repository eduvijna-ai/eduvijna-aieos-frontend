"""Allowlisted PK-V1-HINT proof JSON exports — no credential passthrough."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

PACKAGE_SCENARIO_ID = "pk-v1-hint-e2e-learner-hint-vertical"

ALLOWLIST_DB_REPORT = frozenset(
    {
        "package_scenario_id",
        "role",
        "postgres_major",
        "migration_head",
        "started_container",
        "host_port",
        "backend_pin_sha",
        "container_name",
        "container_id_prefix",
        "bootstrap_ok",
    }
)

ALLOWLIST_FIXTURE = frozenset(
    {
        "package_scenario_id",
        "scenario_id",
        "backend_pin_sha",
        "migration_head",
        "openapi_authority_sha",
        "tenant_id",
        "content_id",
        "version_id",
        "work_id",
        "class_ref",
        "q_correct_id",
        "q_incorrect_id",
        "q_unanswered_id",
        "q_open_id",
        "obj_demonstrated_id",
        "obj_not_yet_id",
        "obj_insufficient_id",
        "evaluation_policy_id",
        "evaluation_policy_version",
        "stewardship_state",
        "shared_database",
        "seed_ok",
    }
)

ALLOWLIST_SUMMARY = frozenset(
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

ALLOWLIST_SCENARIO_ROW = frozenset({"scenario_id", "evidence_tier"})
ALLOWLIST_LOCK = frozenset({"scenario_id", "ok"})
ALLOWLIST_PROBE_RUN = frozenset(
    {
        "package_scenario_id",
        "probe_substrate_isolated",
        "passed",
        "failed",
        "suites",
        "lock_scenario_count",
    }
)

SECRET_MARKERS = re.compile(
    r"(postgresql[^\s\"]*://[^\s\"]+@|aieos_test@|pk-v1-hint-e2e-(author|reviewer|publisher)|dev-student-a|Think about matching denominators)",
    re.IGNORECASE,
)


def _scalar(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool)) or value is None


def _pick_allowlisted(payload: dict[str, Any], allowlist: frozenset[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in allowlist:
        if key not in payload:
            continue
        value = payload[key]
        if isinstance(value, dict):
            raise ValueError(f"nested object not allowed for export key {key}")
        if isinstance(value, list):
            raise ValueError(f"list not allowed for export key {key}")
        if not _scalar(value):
            raise ValueError(f"unsupported export value type for {key}")
        out[key] = value
    return out


def build_db_report_export(report: dict[str, Any]) -> dict[str, Any]:
    base = {
        "package_scenario_id": PACKAGE_SCENARIO_ID,
        "role": report.get("role", "primary"),
        "postgres_major": report.get("postgres_major"),
        "migration_head": report.get("migration_head"),
        "started_container": report.get("started_container"),
        "host_port": report.get("host_port"),
        "backend_pin_sha": report.get("backend_pin_sha"),
        "container_name": report.get("container_name"),
        "container_id_prefix": (report.get("container_id") or "")[:12] or None,
        "bootstrap_ok": True,
    }
    return _pick_allowlisted(base, ALLOWLIST_DB_REPORT)


def build_fixture_export(fixture: dict[str, Any]) -> dict[str, Any]:
    base = {"package_scenario_id": PACKAGE_SCENARIO_ID, **fixture, "seed_ok": True}
    return _pick_allowlisted(base, ALLOWLIST_FIXTURE)


def build_summary_export(summary: dict[str, Any]) -> dict[str, Any]:
    base = _pick_allowlisted(
        {"package_scenario_id": PACKAGE_SCENARIO_ID, **summary},
        ALLOWLIST_SUMMARY - {"tier_counts"},
    )
    tier_counts = summary.get("tier_counts")
    if tier_counts is not None:
        if not isinstance(tier_counts, dict):
            raise ValueError("tier_counts must be a mapping")
        sanitized_counts: dict[str, int] = {}
        for key, value in tier_counts.items():
            if not isinstance(key, str) or not isinstance(value, int):
                raise ValueError("tier_counts entries must be string keys and int values")
            sanitized_counts[key] = value
        base["tier_counts"] = sanitized_counts
    return base


def build_probe_run_export(payload: dict[str, Any]) -> dict[str, Any]:
    base = {"package_scenario_id": PACKAGE_SCENARIO_ID, **payload}
    return _pick_allowlisted(base, ALLOWLIST_PROBE_RUN)


def assert_export_has_no_secrets(text: str) -> None:
    if SECRET_MARKERS.search(text):
        raise ValueError("sanitized export still contains forbidden secret markers")


def write_sanitized_json(path: str, payload: dict[str, Any]) -> None:
    role = payload.get("role")
    if payload.get("sanitized_evidence_ok") is not None:
        exported = build_summary_export(payload)
    elif role == "probe" or payload.get("probe_substrate_isolated") is not None:
        exported = (
            build_probe_run_export(payload)
            if payload.get("probe_substrate_isolated") is not None
            else build_db_report_export(payload)
        )
    elif payload.get("scenario_id") and payload.get("author_bearer_token"):
        exported = build_fixture_export(payload)
    elif payload.get("scenario_id") or payload.get("stewardship_state"):
        exported = build_fixture_export(payload)
    elif payload.get("runtime_database_url") or payload.get("bootstrap_database_url"):
        exported = build_db_report_export(payload)
    else:
        exported = _pick_allowlisted(
            {"package_scenario_id": PACKAGE_SCENARIO_ID, **payload},
            ALLOWLIST_SUMMARY,
        )
    text = json.dumps(exported, indent=2) + "\n"
    assert_export_has_no_secrets(text)
    Path(path).write_text(text, encoding="utf-8")


def public_bootstrap_summary(report: dict[str, Any]) -> dict[str, Any]:
    return build_db_report_export(report)


def public_seed_summary(fixture: dict[str, Any]) -> dict[str, Any]:
    return build_fixture_export(fixture)