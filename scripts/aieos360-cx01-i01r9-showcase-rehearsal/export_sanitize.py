"""Sanitize CX01 proof/export JSON — no credentials, full DB URLs, or bearer tokens."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse

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
        "teacher_bearer_token",
        "student_bearer_token",
        "student_b_bearer_token",
        "principal_bearer_token",
        "parent_bearer_token",
        "password",
    }
)

APPROVED_CLIENT_SCENARIO_ID = "AIEOS360-CX-SCENARIO-01"
PACKAGE_SCENARIO_ID = "aieos360-cx01-i01-showcase-rehearsal"


def redact_database_url(url: str) -> str:
    if not url:
        return url
    return URL_WITH_PASSWORD.sub(r"\1\2:" + REDACTED + "@", url)


def database_url_descriptor(url: str) -> dict[str, Any]:
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
            out[key] = value
    return out


def scan_for_leaks(text: str) -> list[str]:
    leaks: list[str] = []
    if URL_WITH_PASSWORD.search(text) and REDACTED not in text:
        if re.search(r"postgresql[^\\n]*:[^@/\\n]+@", text, re.IGNORECASE):
            leaks.append("credential-bearing database URL")
    if "aieos_test@" in text and REDACTED not in text:
        leaks.append("governed test password in URL")
    for token_marker in (
        "aieos360-cx01-i01-showcase-teacher",
        "aieos360-cx01-i01-showcase-principal",
        "aieos360-cx01-i01-showcase-parent",
    ):
        if token_marker in text:
            leaks.append(f"development bearer token ({token_marker})")
    return leaks


def write_sanitized_json(path: str, payload: dict[str, Any]) -> None:
    sanitized = sanitize_object(payload)
    sanitized.setdefault("approved_client_scenario_id", APPROVED_CLIENT_SCENARIO_ID)
    sanitized.setdefault("package_scenario_id", PACKAGE_SCENARIO_ID)
    text = json.dumps(sanitized, indent=2) + "\n"
    leaks = scan_for_leaks(text)
    if leaks:
        raise ValueError(f"sanitized export still contains leaks: {leaks}")
    from pathlib import Path

    Path(path).write_text(text, encoding="utf-8")
