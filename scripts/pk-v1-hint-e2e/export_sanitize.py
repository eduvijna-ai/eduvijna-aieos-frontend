"""Sanitize PK-V1-HINT proof JSON — no credentials, DB URLs, bearer tokens, or hint bodies."""

from __future__ import annotations

import json
import re
from typing import Any

REDACTED = "[REDACTED]"
URL_WITH_PASSWORD = re.compile(
    r"(postgresql(?:\+\w+)?://)([^:@/]+):([^@/]+)@",
    re.IGNORECASE,
)
BEARER_KEY_SUFFIXES = (
    "bearer_token",
    "bearer",
    "_token",
)
SENSITIVE_KEYS = frozenset(
    {
        "runtime_database_url",
        "bootstrap_database_url",
        "migrator_database_url",
        "author_bearer_token",
        "reviewer_bearer_token",
        "publisher_bearer_token",
        "student_bearer_token",
        "password",
    }
)

PACKAGE_SCENARIO_ID = "pk-v1-hint-e2e-learner-hint-vertical"

HINT_PROBE_STRINGS = (
    "Think about matching denominators",
    "same size parts",
    "pk-v1-hint-e2e-author",
    "pk-v1-hint-e2e-reviewer",
    "pk-v1-hint-e2e-publisher",
    "dev-student-a",
)


def redact_database_url(url: str) -> str:
    if not url:
        return url
    return URL_WITH_PASSWORD.sub(r"\1\2:" + REDACTED + "@", url)


def database_url_descriptor(url: str) -> dict[str, Any]:
    from urllib.parse import urlparse

    normalized = url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )
    parsed = urlparse(normalized)
    return {
        "user": parsed.username,
        "host": parsed.hostname,
        "port": parsed.port,
        "database": (parsed.path or "").lstrip("/") or None,
        "has_password": bool(parsed.password),
    }


def _key_sensitive(key: str) -> bool:
    lower = key.lower()
    if lower in SENSITIVE_KEYS:
        return True
    return any(lower.endswith(suffix) for suffix in BEARER_KEY_SUFFIXES)


def sanitize_value(key: str, value: Any) -> Any:
    if isinstance(value, dict):
        return sanitize_object(value)
    if isinstance(value, list):
        return [sanitize_value(key, item) for item in value]
    if isinstance(value, str):
        if _key_sensitive(key):
            return REDACTED
        if "postgresql" in value and "@" in value:
            return redact_database_url(value)
        for marker in HINT_PROBE_STRINGS:
            if marker in value:
                return REDACTED
    return value


def sanitize_object(obj: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in obj.items():
        if key in ("runtime_database_url", "bootstrap_database_url") and isinstance(
            value, str
        ):
            out[f"{key.replace('_url', '_descriptor')}"] = database_url_descriptor(
                value
            )
            continue
        if _key_sensitive(key):
            out[key] = REDACTED
            continue
        if isinstance(value, dict):
            out[key] = sanitize_object(value)
        elif isinstance(value, list):
            out[key] = [sanitize_value(key, item) for item in value]
        elif isinstance(value, str) and "postgresql" in value and "@" in value:
            out[key] = redact_database_url(value)
        else:
            out[key] = sanitize_value(key, value)
    return out


def scan_for_leaks(text: str) -> list[str]:
    leaks: list[str] = []
    if URL_WITH_PASSWORD.search(text) and REDACTED not in text:
        if re.search(r"postgresql[^\\n]*:[^@/\\n]+@", text, re.IGNORECASE):
            leaks.append("credential-bearing database URL")
    if "aieos_test@" in text and REDACTED not in text:
        leaks.append("governed test password in URL")
    for token_marker in (
        "pk-v1-hint-e2e-author",
        "pk-v1-hint-e2e-reviewer",
        "pk-v1-hint-e2e-publisher",
        "dev-student-a",
    ):
        if token_marker in text:
            leaks.append(f"development bearer token ({token_marker})")
    for hint in ("Think about matching denominators",):
        if hint in text:
            leaks.append("learner hint body text")
    return leaks


def write_sanitized_json(path: str, payload: dict[str, Any]) -> None:
    from pathlib import Path

    sanitized = sanitize_object(payload)
    sanitized.setdefault("package_scenario_id", PACKAGE_SCENARIO_ID)
    text = json.dumps(sanitized, indent=2) + "\n"
    leaks = scan_for_leaks(text)
    if leaks:
        raise ValueError(f"sanitized export still contains leaks: {leaks}")
    Path(path).write_text(text, encoding="utf-8")


def public_bootstrap_summary(report: dict[str, Any]) -> dict[str, Any]:
    return {
        "bootstrap_ok": True,
        "postgres_major": report.get("postgres_major"),
        "migration_head": report.get("migration_head"),
        "started_container": report.get("started_container"),
        "host_port": report.get("host_port"),
        "backend_pin_sha": report.get("backend_pin_sha"),
        "container_name": report.get("container_name"),
        "container_id_prefix": (report.get("container_id") or "")[:12] or None,
    }


def public_seed_summary(fixture: dict[str, Any]) -> dict[str, Any]:
    return {
        "seed_ok": True,
        "scenario_id": fixture.get("scenario_id"),
        "backend_pin_sha": fixture.get("backend_pin_sha"),
        "migration_head": fixture.get("migration_head"),
        "content_id": fixture.get("content_id"),
        "version_id": fixture.get("version_id"),
        "work_id": fixture.get("work_id"),
        "class_ref": fixture.get("class_ref"),
        "q_open_id": fixture.get("q_open_id"),
        "stewardship_state": fixture.get("stewardship_state"),
    }