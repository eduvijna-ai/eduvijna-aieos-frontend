"""Pure CI probe-database creation ordering — no live connections."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Sequence
from urllib.parse import urlparse

from dsn_contract import (
    GOVERNED_DB_NAME,
    GOVERNED_PROBE_CI_DB_NAME,
    parse_db_url,
    reject_connection_routing_overrides,
)


@dataclass(frozen=True)
class CiProbeCreationPlan:
    admin_bootstrap_url: str
    probe_database_name: str
    probe_bootstrap_url: str
    probe_migrator_url: str
    probe_runtime_url: str


class CiProbeCreationError(ValueError):
    pass


def physical_target(url: str) -> tuple[str, int, str]:
    reject_connection_routing_overrides(url, label="DSN")
    normalized = url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )
    parsed = urlparse(normalized)
    if not parsed.hostname or parsed.port is None:
        raise CiProbeCreationError("URL must include host and port")
    database = (parsed.path or "").lstrip("/")
    if not database:
        raise CiProbeCreationError("URL must include database name")
    return (parsed.hostname, int(parsed.port), database)


def build_ci_probe_creation_plan(env: dict[str, str]) -> CiProbeCreationPlan:
    if env.get("PK_V1_HINT_E2E_PROBE_CI_EXTERNAL_PG") != "1":
        raise CiProbeCreationError("CI probe plan requires PK_V1_HINT_E2E_PROBE_CI_EXTERNAL_PG=1")
    admin = env.get("AIEOS_TEST_BOOTSTRAP_DATABASE_URL", "")
    if not admin:
        raise CiProbeCreationError("AIEOS_TEST_BOOTSTRAP_DATABASE_URL required for admin CREATE DATABASE")
    admin_parsed = parse_db_url(admin)
    if admin_parsed.database != GOVERNED_DB_NAME:
        raise CiProbeCreationError(
            f"admin bootstrap must target journey DB {GOVERNED_DB_NAME}, not {admin_parsed.database}"
        )
    probe_bootstrap = env.get("PK_V1_HINT_E2E_PROBE_BOOTSTRAP_DATABASE_URL", "")
    probe_migrator = env.get("PK_V1_HINT_E2E_PROBE_DATABASE_URL", "")
    probe_runtime = env.get("PK_V1_HINT_E2E_PROBE_RUNTIME_DATABASE_URL", "")
    if not probe_migrator:
        raise CiProbeCreationError("PK_V1_HINT_E2E_PROBE_DATABASE_URL required")
    for label, url in (
        ("probe bootstrap", probe_bootstrap),
        ("probe migrator", probe_migrator),
        ("probe runtime", probe_runtime),
    ):
        if not url:
            raise CiProbeCreationError(f"missing {label} URL")
        parsed = parse_db_url(url)
        if parsed.database != GOVERNED_PROBE_CI_DB_NAME:
            raise CiProbeCreationError(
                f"{label} must target {GOVERNED_PROBE_CI_DB_NAME}, got {parsed.database}"
            )
    if physical_target(admin) == physical_target(probe_migrator):
        raise CiProbeCreationError("probe migrator must not alias journey admin physical target")
    return CiProbeCreationPlan(
        admin_bootstrap_url=admin,
        probe_database_name=GOVERNED_PROBE_CI_DB_NAME,
        probe_bootstrap_url=probe_bootstrap,
        probe_migrator_url=probe_migrator,
        probe_runtime_url=probe_runtime,
    )


def ordered_ci_probe_operations(
    plan: CiProbeCreationPlan,
    *,
    probe_db_exists: bool,
) -> list[str]:
    if probe_db_exists:
        raise CiProbeCreationError(
            "unexpected pre-existing probe database; refusing adoption"
        )
    return [
        "connect_admin_existing_journey_database",
        "create_probe_database_autocommit",
        "connect_probe_bootstrap",
        "provision_identities_probe_only",
        "alembic_upgrade_probe_only",
        "provision_runtime_grants_probe_only",
    ]


def assert_operation_sequence(
    executed: Sequence[str],
    *,
    probe_db_exists: bool,
    plan: CiProbeCreationPlan,
) -> None:
    expected = ordered_ci_probe_operations(plan, probe_db_exists=probe_db_exists)
    if list(executed) != expected:
        raise CiProbeCreationError("probe bootstrap operation sequence mismatch")
    forbidden_on_admin = {
        "provision_identities_probe_only",
        "alembic_upgrade_probe_only",
        "provision_runtime_grants_probe_only",
        "pytest_postgres18_fixture",
    }
    admin_phase = executed[: executed.index("create_probe_database_autocommit") + 1]
    if any(op in forbidden_on_admin for op in admin_phase):
        raise CiProbeCreationError("destructive probe operations ran on admin connection")


def simulate_ci_probe_bootstrap(
    plan: CiProbeCreationPlan,
    *,
    probe_db_exists: bool,
    steps: Callable[[str], None] | None = None,
) -> list[str]:
    executed: list[str] = []
    for op in ordered_ci_probe_operations(plan, probe_db_exists=probe_db_exists):
        if steps:
            steps(op)
        executed.append(op)
    assert_operation_sequence(executed, probe_db_exists=probe_db_exists, plan=plan)
    return executed