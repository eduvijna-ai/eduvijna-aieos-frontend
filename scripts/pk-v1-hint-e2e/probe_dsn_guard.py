"""Forbid Backend pytest destructive fixtures on the live hint E2E journey database."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse


def _physical_target(url: str) -> tuple[str, int, str]:
    """Canonical DB identity = host + port + database (role-independent)."""
    from dsn_contract import parse_db_url, reject_connection_routing_overrides

    reject_connection_routing_overrides(url, label="probe DSN")
    parsed = parse_db_url(url)
    return (parsed.host, parsed.port, parsed.database)


def assert_probe_urls_isolated_from_journey(
    *,
    journey_urls: dict[str, str],
    probe_urls: dict[str, str],
) -> None:
    journey_targets = {_physical_target(url) for url in journey_urls.values() if url}
    for label, url in probe_urls.items():
        if not url:
            raise ValueError(f"probe DSN guard: missing {label}")
        if label == "admin_create_database":
            continue
        probe_target = _physical_target(url)
        if probe_target in journey_targets:
            raise ValueError(
                "PROBE_DSN_FORBIDDEN_SHARED_JOURNEY: "
                f"{label} must not target the active browser-journey database"
            )


def load_journey_urls_from_report(report_path: Path) -> dict[str, str]:
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert_journey_report_complete(report)
    return {
        "bootstrap": str(report["bootstrap_database_url"]),
        "migrator": str(
            report.get("migrator_database_url") or report["bootstrap_database_url"]
        ),
        "runtime": str(report["runtime_database_url"]),
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
    return scrub_probe_pytest_environ(probe, dict(os.environ))


def assert_forbidden_identical_dsn_pair(active_url: str, probe_url: str) -> None:
    if _physical_target(active_url) == _physical_target(probe_url):
        raise ValueError(
            "PROBE_DSN_FORBIDDEN_SHARED_JOURNEY: identical active and probe physical DB target"
        )


def assert_journey_report_complete(report: dict[str, object]) -> None:
    for key in ("bootstrap_database_url", "runtime_database_url"):
        if not report.get(key):
            raise ValueError(f"journey report missing {key}")
    migrator = report.get("migrator_database_url") or report["bootstrap_database_url"]
    if not migrator:
        raise ValueError("journey report missing migrator_database_url")


def scrub_probe_pytest_environ(
    probe_urls: dict[str, str],
    inherited: dict[str, str],
) -> dict[str, str]:
    """Probe-only DSNs for Backend pytest; scrub journey-routing inherited vars."""
    out = {
        "AIEOS_DATABASE_URL": probe_urls["migrator"],
        "AIEOS_TEST_DATABASE_URL": probe_urls["migrator"],
        "AIEOS_TEST_RUNTIME_DATABASE_URL": probe_urls["runtime"],
        "AIEOS_TEST_BOOTSTRAP_DATABASE_URL": probe_urls["bootstrap"],
    }
    journey_keys = (
        "AIEOS_TEST_DATABASE_URL",
        "AIEOS_TEST_RUNTIME_DATABASE_URL",
        "AIEOS_TEST_BOOTSTRAP_DATABASE_URL",
        "AIEOS_DATABASE_URL",
        "DATABASE_URL",
    )
    for key in inherited:
        if key in journey_keys and key not in out:
            continue
        if key.startswith("AIEOS_") and "DATABASE" in key and key not in out:
            continue
    return out


_SECRET_IN_ERROR = re.compile(
    r"(postgresql[^\s]*://[^\s]+@|aieos_test|pk-v1-hint-e2e-(author|reviewer|publisher))",
    re.IGNORECASE,
)


def assert_safe_error_message(message: str) -> None:
    if _SECRET_IN_ERROR.search(message):
        raise ValueError("unsafe error message would disclose credentials")