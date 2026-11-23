"""Forbid Backend pytest destructive fixtures on the live hint E2E journey database."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse


def _identity(url: str) -> tuple[str, int, str, str]:
    normalized = url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )
    parsed = urlparse(normalized)
    if not parsed.hostname or parsed.port is None:
        raise ValueError("probe DSN guard: URL must include host and port")
    database = (parsed.path or "").lstrip("/")
    if not database:
        raise ValueError("probe DSN guard: URL must include database name")
    user = parsed.username or ""
    return (parsed.hostname, int(parsed.port), database, user)


def assert_probe_urls_isolated_from_journey(
    *,
    journey_urls: dict[str, str],
    probe_urls: dict[str, str],
) -> None:
    journey_identities = {_identity(url) for url in journey_urls.values() if url}
    for label, url in probe_urls.items():
        if not url:
            raise ValueError(f"probe DSN guard: missing {label}")
        probe_identity = _identity(url)
        if probe_identity in journey_identities:
            raise ValueError(
                "PROBE_DSN_FORBIDDEN_SHARED_JOURNEY: "
                f"{label} must not target the active browser-journey database"
            )
    runtime = journey_urls.get("runtime")
    migrator = probe_urls.get("migrator") or probe_urls.get("database")
    if runtime and migrator and _identity(runtime) == _identity(migrator):
        raise ValueError(
            "PROBE_DSN_FORBIDDEN_SHARED_JOURNEY: probe migrator equals journey runtime"
        )


def load_journey_urls_from_report(report_path: Path) -> dict[str, str]:
    report = json.loads(report_path.read_text(encoding="utf-8"))
    return {
        "bootstrap": report["bootstrap_database_url"],
        "migrator": report.get("migrator_database_url") or report["bootstrap_database_url"],
        "runtime": report["runtime_database_url"],
    }


def load_probe_urls_from_report(report_path: Path) -> dict[str, str]:
    report = json.loads(report_path.read_text(encoding="utf-8"))
    return {
        "bootstrap": report["bootstrap_database_url"],
        "migrator": report.get("migrator_database_url", report["bootstrap_database_url"]),
        "runtime": report["runtime_database_url"],
        "database": report.get("migrator_database_url") or report["bootstrap_database_url"],
    }


def assert_env_before_backend_pytest(
    *,
    journey_report_path: Path,
    probe_report_path: Path,
) -> dict[str, str]:
    journey = load_journey_urls_from_report(journey_report_path)
    probe = load_probe_urls_from_report(probe_report_path)
    assert_probe_urls_isolated_from_journey(journey_urls=journey, probe_urls=probe)
    return {
        "AIEOS_DATABASE_URL": probe["migrator"],
        "AIEOS_TEST_DATABASE_URL": probe["migrator"],
        "AIEOS_TEST_RUNTIME_DATABASE_URL": probe["runtime"],
        "AIEOS_TEST_BOOTSTRAP_DATABASE_URL": probe["bootstrap"],
    }


def assert_forbidden_identical_dsn_pair(active_url: str, probe_url: str) -> None:
    if _identity(active_url) == _identity(probe_url):
        raise ValueError(
            "PROBE_DSN_FORBIDDEN_SHARED_JOURNEY: identical active and probe DSN"
        )


_SECRET_IN_ERROR = re.compile(
    r"(postgresql[^\s]*://[^\s]+@|aieos_test|pk-v1-hint-e2e-(author|reviewer|publisher))",
    re.IGNORECASE,
)


def assert_safe_error_message(message: str) -> None:
    if _SECRET_IN_ERROR.search(message):
        raise ValueError("unsafe error message would disclose credentials")