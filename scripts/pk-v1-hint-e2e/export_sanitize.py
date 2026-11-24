"""Allowlisted PK-V1-HINT proof JSON exports — no credential passthrough."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

PACKAGE_SCENARIO_ID = "pk-v1-hint-e2e-learner-hint-vertical"
EVIDENCE_CONTRACT_VERSION = 1

ALLOWED_EVIDENCE_TIERS = frozenset(
    {
        "REAL_STACK_EXECUTED_PASS",
        "CURRENT_BACKEND_PG_HTTP_PROOF",
        "FRONTEND_MOCK_ONLY",
        "NOT_TESTED",
        "DEFERRED_BY_ADR",
        "BLOCKED",
    }
)

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
        "evidence_contract_version",
        "generated_at_ms",
        "attempt_run_id",
        "github_sha",
        "backend_pin_sha",
        "openapi_authority_sha",
        "migration_head",
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

_RE_DECIMAL_PORT = re.compile(r"^[0-9]+$")
_RE_CONTAINER_ID_PREFIX = re.compile(r"^[0-9a-fA-F]{12}$")
_RE_FULL_CONTAINER_ID = re.compile(r"^[0-9a-fA-F]{12,64}$")

CI_PG_HOST_PORT = 5432
LOCAL_PRIMARY_PG_HOST_PORT = 55439
LOCAL_PROBE_PG_HOST_PORT = 55440


def _scalar(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool)) or value is None


def _coerce_governed_host_port(raw: Any, *, role: str) -> int:
    if isinstance(raw, bool):
        raise ValueError("host_port bool not allowed")
    if isinstance(raw, int):
        port = raw
    elif isinstance(raw, str):
        stripped = raw.strip()
        if stripped != raw or not _RE_DECIMAL_PORT.fullmatch(stripped):
            raise ValueError("host_port must be decimal digits")
        port = int(stripped)
    else:
        raise ValueError("host_port type")
    if port < 1024 or port > 65535:
        raise ValueError("host_port out of range")
    allowed_ci = {CI_PG_HOST_PORT}
    if role == "probe":
        allowed_owned = {LOCAL_PROBE_PG_HOST_PORT}
    else:
        allowed_owned = {LOCAL_PRIMARY_PG_HOST_PORT}
    if port not in allowed_ci | allowed_owned:
        raise ValueError("host_port not governed for pk-v1-hint")
    return port


def _container_id_prefix(report: dict[str, Any]) -> str:
    container_id = report.get("container_id")
    if not isinstance(container_id, str) or not _RE_FULL_CONTAINER_ID.fullmatch(container_id):
        raise ValueError("container_id shape required for owned substrate")
    prefix = container_id[:12].lower()
    if not _RE_CONTAINER_ID_PREFIX.fullmatch(prefix):
        raise ValueError("container_id_prefix shape")
    return prefix


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
    role = report.get("role", "primary")
    if role not in ("primary", "probe"):
        raise ValueError("db report role")
    started_container = report.get("started_container")
    if started_container is not True and started_container is not False:
        raise ValueError("started_container must be bool")
    host_port = _coerce_governed_host_port(report.get("host_port"), role=role)
    if started_container is False and host_port != CI_PG_HOST_PORT:
        raise ValueError("ci host_port mismatch")
    if started_container is True:
        expected_owned = (
            LOCAL_PROBE_PG_HOST_PORT if role == "probe" else LOCAL_PRIMARY_PG_HOST_PORT
        )
        if host_port != expected_owned:
            raise ValueError("owned host_port mismatch")
    base: dict[str, Any] = {
        "package_scenario_id": PACKAGE_SCENARIO_ID,
        "role": role,
        "postgres_major": report.get("postgres_major"),
        "migration_head": report.get("migration_head"),
        "started_container": started_container,
        "host_port": host_port,
        "backend_pin_sha": report.get("backend_pin_sha"),
        "container_name": report.get("container_name"),
        "bootstrap_ok": True,
    }
    if started_container is True:
        base["container_id_prefix"] = _container_id_prefix(report)
    elif report.get("container_id"):
        raise ValueError("container_id present without started_container")
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
            if key not in ALLOWED_EVIDENCE_TIERS:
                raise ValueError(f"tier_counts key not allowlisted: {key}")
            if value < 0:
                raise ValueError("tier_counts values must be non-negative integers")
            sanitized_counts[key] = value
        if SECRET_MARKERS.search(json.dumps(tier_counts)):
            raise ValueError("tier_counts must not contain secret markers")
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