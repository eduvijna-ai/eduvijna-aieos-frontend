"""Forbid Backend pytest destructive fixtures on the live hint E2E journey database."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse

# Keys that route subprocesses to a database — every inherited copy is removed.
_DATABASE_ROUTING_ENV_PREFIXES = ("DATABASE",)
_DATABASE_ROUTING_ENV_KEYS = frozenset(
    {
        "DATABASE_URL",
        "AIEOS_DATABASE_URL",
        "AIEOS_TEST_DATABASE_URL",
        "AIEOS_TEST_BOOTSTRAP_DATABASE_URL",
        "AIEOS_TEST_RUNTIME_DATABASE_URL",
        "AIEOS_TEST_MIGRATION_RUNTIME_DATABASE_URL",
        "AIEOS_TEST_WORKFLOW_DISPATCHER_DATABASE_URL",
        "AIEOS_TEST_EVENT_DISPATCHER_DATABASE_URL",
        "PK_V1_HINT_E2E_RUNTIME_DATABASE_URL",
        "PK_V1_HINT_E2E_PROBE_BOOTSTRAP_DATABASE_URL",
        "PK_V1_HINT_E2E_PROBE_DATABASE_URL",
        "PK_V1_HINT_E2E_PROBE_RUNTIME_DATABASE_URL",
    }
)

_SAFE_NON_DB_ENV_KEYS = frozenset(
    {
        "PATH",
        "HOME",
        "USER",
        "LANG",
        "LC_ALL",
        "TZ",
        "CI",
        "GITHUB_WORKSPACE",
        "PYTHONPATH",
        "PYTHONHOME",
        "VIRTUAL_ENV",
        "UV_CACHE_DIR",
        "AIEOS_BACKEND_ROOT",
        "AIEOS_BACKEND_PIN_SHA",
        "PK_V1_HINT_E2E_CI_EXTERNAL_PG",
        "PK_V1_HINT_E2E_PROBE_CI_EXTERNAL_PG",
        "PK_V1_HINT_E2E_DB_REPORT",
        "PK_V1_HINT_E2E_PROBE_DB_REPORT",
        "PK_V1_HINT_E2E_FIXTURE_PATH",
        "PK_V1_HINT_E2E_SANITIZED_DIR",
        "PK_V1_HINT_E2E_MANAGED_WRAPPER",
        "PK_V1_HINT_E2E_TEACHER_BACKEND_PORT",
        "PK_V1_HINT_E2E_STUDENT_BACKEND_PORT",
        "PK_V1_HINT_E2E_TEACHER_FRONTEND_PORT",
        "PK_V1_HINT_E2E_STUDENT_FRONTEND_PORT",
    }
)

_PROBE_ONLY_DB_KEYS = (
    "AIEOS_DATABASE_URL",
    "AIEOS_TEST_DATABASE_URL",
    "AIEOS_TEST_RUNTIME_DATABASE_URL",
    "AIEOS_TEST_BOOTSTRAP_DATABASE_URL",
)


def _canonical_loopback_host(host: str) -> str:
    lowered = (host or "").lower()
    if lowered == "localhost":
        return "127.0.0.1"
    return lowered


def _canonical_database_name(name: str) -> str:
    return name.lower()


def _physical_target(url: str) -> tuple[str, int, str]:
    """Canonical DB identity = loopback host + port + database (role-independent)."""
    from dsn_contract import parse_db_url, reject_connection_routing_overrides

    reject_connection_routing_overrides(url, label="probe DSN")
    parsed = parse_db_url(url)
    return (
        _canonical_loopback_host(parsed.host),
        parsed.port,
        _canonical_database_name(parsed.database),
    )


def _is_database_routing_env_key(key: str) -> bool:
    if key in _DATABASE_ROUTING_ENV_KEYS:
        return True
    if "DATABASE_URL" in key:
        return True
    if key.startswith("AIEOS_") and any(part in key for part in _DATABASE_ROUTING_ENV_PREFIXES):
        if "URL" in key or "DSN" in key:
            return True
    if key.startswith("PK_V1_HINT_E2E_") and ("DATABASE" in key or "DSN" in key):
        return True
    return False


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


def build_safe_probe_subprocess_env(
    inherited: dict[str, str],
    probe_urls: dict[str, str],
    journey_urls: dict[str, str],
) -> dict[str, str]:
    """Return a probe-only subprocess env (positive allowlist + probe DSNs only)."""
    assert_probe_urls_isolated_from_journey(journey_urls=journey_urls, probe_urls=probe_urls)

    out: dict[str, str] = {}
    for key in _SAFE_NON_DB_ENV_KEYS:
        if key in inherited:
            out[key] = inherited[key]

    probe_env = {
        "AIEOS_DATABASE_URL": probe_urls["migrator"],
        "AIEOS_TEST_DATABASE_URL": probe_urls["migrator"],
        "AIEOS_TEST_RUNTIME_DATABASE_URL": probe_urls["runtime"],
        "AIEOS_TEST_BOOTSTRAP_DATABASE_URL": probe_urls["bootstrap"],
    }
    out.update(probe_env)

    journey_targets = {_physical_target(url) for url in journey_urls.values() if url}
    for key, url in probe_env.items():
        if _physical_target(url) in journey_targets:
            raise ValueError(
                f"PROBE_SUBPROCESS_ENV_FORBIDDEN: {key} would target journey database"
            )

    for key, value in out.items():
        if not _is_database_routing_env_key(key):
            continue
        if key in probe_env:
            continue
        raise ValueError(f"PROBE_SUBPROCESS_ENV_LEAK: unexpected database route {key}")

    return out


def assert_env_before_backend_pytest(
    *,
    journey_report_path: Path,
    probe_report_path: Path,
    inherited: dict[str, str] | None = None,
) -> dict[str, str]:
    journey = load_journey_urls_from_report(journey_report_path)
    probe = load_probe_urls_from_report(probe_report_path)
    source = dict(os.environ) if inherited is None else inherited
    return build_safe_probe_subprocess_env(source, probe, journey)


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
    """Backward-compatible entry: builds full scrubbed subprocess env."""
    journey_placeholder = {
        "bootstrap": inherited.get(
            "AIEOS_TEST_BOOTSTRAP_DATABASE_URL",
            "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos",
        ),
        "migrator": inherited.get(
            "AIEOS_TEST_DATABASE_URL",
            "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos",
        ),
        "runtime": inherited.get(
            "AIEOS_TEST_RUNTIME_DATABASE_URL",
            "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos",
        ),
    }
    return build_safe_probe_subprocess_env(inherited, probe_urls, journey_placeholder)


_SECRET_IN_ERROR = re.compile(
    r"(postgresql[^\s]*://[^\s]+@|aieos_test|pk-v1-hint-e2e-(author|reviewer|publisher))",
    re.IGNORECASE,
)


def assert_safe_error_message(message: str) -> None:
    if _SECRET_IN_ERROR.search(message):
        raise ValueError("unsafe error message would disclose credentials")