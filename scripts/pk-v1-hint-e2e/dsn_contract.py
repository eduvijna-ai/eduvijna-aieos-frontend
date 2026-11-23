"""Pure URL contract validation for PK-V1-HINT-E2E disposable database targets.

No database connections. NON_PRODUCTION substrates only.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlparse

PK_V1_HINT_E2E_CONTAINER = "aieos-pk-v1-hint-e2e-pg"
DEDICATED_PG_HOST_PORT = 55439
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


FORBIDDEN_URL_QUERY_KEYS = frozenset(
    {
        "host",
        "hostaddr",
        "port",
        "service",
        "dbname",
        "user",
        "password",
        "options",
        "sslmode",
        "target_session_attrs",
    }
)


def reject_connection_routing_overrides(url: str, *, label: str) -> None:
    if "#" in url.split("://", 1)[-1]:
        raise ValueError(f"{label} must not include URL fragment")
    normalized = url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )
    parsed = urlparse(normalized)
    if parsed.query:
        params = {key.lower() for key, _value in parse_qsl(parsed.query, strict_parsing=True)}
        forbidden = params & FORBIDDEN_URL_QUERY_KEYS
        if forbidden:
            raise ValueError(
                f"{label} contains forbidden connection-routing query keys: "
                f"{sorted(forbidden)}"
            )
        if params:
            raise ValueError(
                f"{label} contains unsupported query parameters: {sorted(params)}"
            )
    if parsed.fragment:
        raise ValueError(f"{label} must not include URL fragment")
    if parsed.hostname and ("," in parsed.hostname or "/" in parsed.hostname):
        raise ValueError(f"{label} must not use multihost or socket path authority")


def parse_db_url(url: str) -> ParsedDbUrl:
    reject_connection_routing_overrides(url, label="database URL")
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
    reject_connection_routing_overrides(url, label=label)
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
        raise ValueError(f"{label} password does not match governed test identity")
    return parsed


def validate_external_ci_database_targets(env: dict[str, str]) -> None:
    if env.get("PK_V1_HINT_E2E_CI_EXTERNAL_PG") != "1":
        raise ValueError(
            "external PostgreSQL requires PK_V1_HINT_E2E_CI_EXTERNAL_PG=1"
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


def validate_local_dedicated_database_targets(env: dict[str, str]) -> None:
    container = env.get("PK_V1_HINT_E2E_PG_CONTAINER", PK_V1_HINT_E2E_CONTAINER)
    if container != PK_V1_HINT_E2E_CONTAINER:
        raise ValueError(
            f"container must be {PK_V1_HINT_E2E_CONTAINER}; got {container}"
        )
    port = env.get("AIEOS_TEST_PG_PORT", str(GOVERNED_LOCAL_PG_PORT))
    if str(port) != str(GOVERNED_LOCAL_PG_PORT):
        raise ValueError(
            f"AIEOS_TEST_PG_PORT must be {GOVERNED_LOCAL_PG_PORT}; got {port}"
        )


def validate_database_targets(env: dict[str, str] | None = None) -> None:
    source = env if env is not None else os.environ
    if source.get("AIEOS_TEST_DATABASE_URL"):
        validate_external_ci_database_targets(source)
        return
    validate_local_dedicated_database_targets(source)


def main() -> int:
    validate_database_targets()
    print('{"dsn_contract_ok": true}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())