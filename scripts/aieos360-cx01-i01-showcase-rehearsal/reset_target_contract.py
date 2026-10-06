"""Pure URL contract validation for CX01-I01 destructive reset targets.

No database connections. NON_PRODUCTION rehearsal substrates only.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse

CX01_SHOWCASE_CONTAINER = "aieos-aieos360-cx01-i01-showcase-pg"
DEDICATED_PG_HOST_PORT = 55448
GOVERNED_DB_NAME = "aieos"
GOVERNED_TEST_PASSWORD = "aieos_test"
GOVERNED_CI_PG_PORT = 5432
GOVERNED_LOCAL_PG_PORT = DEDICATED_PG_HOST_PORT
APPROVED_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost"})

BOOTSTRAP_USER = "aieos_bootstrap"
MIGRATOR_USER = "aieos_migrator"
RUNTIME_USER = "aieos_runtime"


@dataclass(frozen=True)
class ParsedDbUrl:
    user: str
    password: str
    host: str
    port: int
    database: str


def parse_db_url(url: str) -> ParsedDbUrl:
    normalized = url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )
    parsed = urlparse(normalized)
    if parsed.scheme not in ("postgresql",):
        raise ValueError(f"unsupported database URL scheme: {parsed.scheme}")
    if not parsed.hostname or not parsed.username or parsed.password is None:
        raise ValueError("database URL must include user, password, host, and database")
    port = parsed.port
    if port is None:
        raise ValueError("database URL must include explicit port")
    database = (parsed.path or "").lstrip("/")
    if not database:
        raise ValueError("database URL must include database name")
    return ParsedDbUrl(
        user=parsed.username,
        password=parsed.password,
        host=parsed.hostname,
        port=port,
        database=database,
    )


def _reject_host(host: str) -> None:
    if host not in APPROVED_LOOPBACK_HOSTS:
        raise ValueError(
            f"database host must be loopback (127.0.0.1/localhost); got {host}"
        )


def _assert_url_matches(
    url: str,
    *,
    label: str,
    expected_user: str,
    expected_port: int,
) -> ParsedDbUrl:
    parsed = parse_db_url(url)
    _reject_host(parsed.host)
    if parsed.port != expected_port:
        raise ValueError(
            f"{label} port must be {expected_port}; got {parsed.port} ({url})"
        )
    if parsed.database != GOVERNED_DB_NAME:
        raise ValueError(
            f"{label} database must be {GOVERNED_DB_NAME}; got {parsed.database}"
        )
    if parsed.user != expected_user:
        raise ValueError(
            f"{label} user must be {expected_user}; got {parsed.user}"
        )
    if parsed.password != GOVERNED_TEST_PASSWORD:
        raise ValueError(f"{label} password does not match governed CI test identity")
    return parsed


def validate_external_ci_database_targets(env: dict[str, str]) -> None:
    if env.get("AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG") != "1":
        raise ValueError(
            "external PostgreSQL requires AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG=1"
        )
    migrator = env.get("AIEOS_TEST_DATABASE_URL")
    if not migrator:
        raise ValueError("AIEOS_TEST_DATABASE_URL is required for external CI substrate")
    bootstrap = env.get("AIEOS_TEST_BOOTSTRAP_DATABASE_URL", migrator)
    runtime = env.get("AIEOS_TEST_RUNTIME_DATABASE_URL", migrator)
    _assert_url_matches(
        bootstrap,
        label="AIEOS_TEST_BOOTSTRAP_DATABASE_URL",
        expected_user=BOOTSTRAP_USER,
        expected_port=GOVERNED_CI_PG_PORT,
    )
    _assert_url_matches(
        migrator,
        label="AIEOS_TEST_DATABASE_URL",
        expected_user=MIGRATOR_USER,
        expected_port=GOVERNED_CI_PG_PORT,
    )
    _assert_url_matches(
        runtime,
        label="AIEOS_TEST_RUNTIME_DATABASE_URL",
        expected_user=RUNTIME_USER,
        expected_port=GOVERNED_CI_PG_PORT,
    )
    for key in (
        "AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL",
        "AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL",
    ):
        override = env.get(key)
        if not override:
            continue
        expected_user = BOOTSTRAP_USER if "BOOTSTRAP" in key else RUNTIME_USER
        _assert_url_matches(
            override,
            label=key,
            expected_user=expected_user,
            expected_port=GOVERNED_CI_PG_PORT,
        )


def validate_local_dedicated_database_targets(env: dict[str, str]) -> None:
    container = env.get(
        "AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER", CX01_SHOWCASE_CONTAINER
    )
    if container != CX01_SHOWCASE_CONTAINER:
        raise ValueError(
            f"container must be {CX01_SHOWCASE_CONTAINER}; got {container}"
        )
    port = env.get("AIEOS_TEST_PG_PORT", str(GOVERNED_LOCAL_PG_PORT))
    if str(port) != str(GOVERNED_LOCAL_PG_PORT):
        raise ValueError(
            f"AIEOS_TEST_PG_PORT must be {GOVERNED_LOCAL_PG_PORT}; got {port}"
        )
    for key in (
        "AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL",
        "AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL",
    ):
        override = env.get(key)
        if not override:
            continue
        expected_user = BOOTSTRAP_USER if "BOOTSTRAP" in key else RUNTIME_USER
        _assert_url_matches(
            override,
            label=key,
            expected_user=expected_user,
            expected_port=GOVERNED_LOCAL_PG_PORT,
        )


def validate_reset_environment(env: dict[str, str] | None = None) -> None:
    source = env if env is not None else os.environ
    if source.get("AIEOS_TEST_DATABASE_URL"):
        validate_external_ci_database_targets(source)
        return
    validate_local_dedicated_database_targets(source)


def main() -> int:
    validate_reset_environment()
    print("reset_target_contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
