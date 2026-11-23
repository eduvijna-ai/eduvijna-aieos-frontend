"""Bootstrap isolated probe-only PostgreSQL for destructive Backend pytest fixtures."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from dsn_contract import (
    GOVERNED_PROBE_CI_DB_NAME,
    validate_local_probe_database_targets,
    validate_probe_ci_database_targets,
)
from export_sanitize import public_bootstrap_summary, write_sanitized_json

EXPECTED_MIGRATION_HEAD = "a360s010005"
BACKEND_PIN_SHA = "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa"
PROBE_CONTAINER_NAME = "aieos-pk-v1-hint-e2e-pg-probe"
DEFAULT_PROBE_PORT = "55440"


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    path = Path(root).resolve()
    if not (path / "tests" / "conftest.py").is_file():
        raise SystemExit("Invalid AIEOS_BACKEND_ROOT")
    return path


def _script_dir() -> Path:
    return Path(__file__).resolve().parent


def _wait_for_tcp(host: str, port: int, timeout_s: float = 120.0) -> None:
    import socket

    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                return
        except OSError:
            time.sleep(0.5)
    raise RuntimeError("probe PostgreSQL did not accept connections")


def _start_owned_probe_postgres(port: str) -> str:
    script = _script_dir() / "start_owned_probe_postgres.mjs"
    proc = subprocess.run(
        ["node", str(script)],
        env={
            **os.environ,
            "PK_V1_HINT_E2E_PROBE_PG_PORT": port,
            "PK_V1_HINT_E2E_PROBE_PG_CONTAINER": os.environ.get(
                "PK_V1_HINT_E2E_PROBE_PG_CONTAINER", PROBE_CONTAINER_NAME
            ),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError("start_owned_probe_postgres failed")
    summary = json.loads(proc.stdout.strip().splitlines()[-1])
    if not summary.get("ok"):
        raise RuntimeError("owned probe postgres start did not report ok")
    _wait_for_tcp("127.0.0.1", int(port))
    return port


def _cleanup_probe_start() -> None:
    subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import { cleanupPartialProbeStart } from './managed_lifecycle.mjs'; cleanupPartialProbeStart();",
        ],
        cwd=_script_dir(),
        capture_output=True,
        text=True,
    )


def _restrict_permissions(path: Path) -> None:
    try:
        path.chmod(0o600)
    except OSError:
        pass


def _ensure_ci_probe_database(bootstrap_url: str) -> None:
    backend = _backend_root()
    sys.path.insert(0, str(backend))
    from sqlalchemy import text
    from tests.conftest import wait_for_engine

    engine = wait_for_engine(bootstrap_url)
    with engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": GOVERNED_PROBE_CI_DB_NAME},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{GOVERNED_PROBE_CI_DB_NAME}"'))


def main() -> int:
    if os.environ.get("PK_V1_HINT_E2E_PROBE_DATABASE_URL"):
        validate_probe_ci_database_targets(os.environ)
    else:
        validate_local_probe_database_targets(os.environ)

    started_container = False
    report_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_PROBE_DB_REPORT",
            _script_dir().parents[1] / "tmp" / "pk-v1-hint-e2e-probe-db.json",
        )
    )
    sanitized_path = report_path.parent / "pk-v1-hint-e2e-probe-db-sanitized.json"
    try:
        external = os.environ.get("PK_V1_HINT_E2E_PROBE_DATABASE_URL")
        if external:
            b_url = os.environ["PK_V1_HINT_E2E_PROBE_BOOTSTRAP_DATABASE_URL"]
            m_url = external
            r_url = os.environ.get(
                "PK_V1_HINT_E2E_PROBE_RUNTIME_DATABASE_URL", external
            )
            port = "5432"
            _ensure_ci_probe_database(b_url)
        else:
            port = os.environ.get("PK_V1_HINT_E2E_PROBE_PG_PORT", DEFAULT_PROBE_PORT)
            port = _start_owned_probe_postgres(port)
            started_container = True
            backend = _backend_root()
            sys.path.insert(0, str(backend))
            from tests.conftest import bootstrap_url, migrator_url, runtime_url

            b_url = bootstrap_url(port)
            m_url = migrator_url(port)
            r_url = runtime_url(port)

        backend = _backend_root()
        sys.path.insert(0, str(backend / "src"))
        sys.path.insert(0, str(backend))
        from alembic import command
        from sqlalchemy import text
        from tests.conftest import (
            alembic_config,
            provision_identities,
            provision_runtime_grants,
            wait_for_engine,
        )

        bootstrap = wait_for_engine(b_url)
        with bootstrap.connect() as conn:
            version = conn.execute(text("SHOW server_version")).scalar_one()
            if not str(version).startswith("18."):
                raise RuntimeError("PostgreSQL 18 required for probe substrate")

        provision_identities(bootstrap)
        os.environ["AIEOS_DATABASE_URL"] = m_url
        cfg = alembic_config(m_url)
        command.upgrade(cfg, "head")
        with bootstrap.connect() as conn:
            head = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
        if head != EXPECTED_MIGRATION_HEAD:
            raise RuntimeError("probe migration head mismatch")
        provision_runtime_grants(bootstrap)

        ownership_path = _script_dir().parents[1] / "tmp" / "pk-v1-hint-e2e-probe-docker-ownership.json"
        container_id = None
        if ownership_path.is_file():
            container_id = json.loads(
                ownership_path.read_text(encoding="utf-8")
            ).get("containerId")

        report = {
            "role": "probe",
            "postgres_major": 18,
            "migration_head": head,
            "bootstrap_database_url": b_url,
            "migrator_database_url": m_url,
            "runtime_database_url": r_url,
            "started_container": started_container,
            "host_port": port,
            "backend_pin_sha": BACKEND_PIN_SHA,
            "container_name": os.environ.get(
                "PK_V1_HINT_E2E_PROBE_PG_CONTAINER", PROBE_CONTAINER_NAME
            ),
            "container_id": container_id,
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        _restrict_permissions(report_path)
        write_sanitized_json(str(sanitized_path), report)
        _restrict_permissions(sanitized_path)
        print(json.dumps(public_bootstrap_summary(report) | {"role": "probe"}))
        return 0
    except Exception:
        if started_container:
            _cleanup_probe_start()
        print(json.dumps({"probe_bootstrap_ok": False}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())