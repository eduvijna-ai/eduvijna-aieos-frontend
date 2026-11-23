"""Bootstrap disposable PostgreSQL 18 for PK-V1-HINT-E2E-I01.

Owned local Docker lifecycle OR governed GitHub Actions services.postgres only.
Never calls backend tests/conftest.py::start_postgres (destructive rm -f).
NON_PRODUCTION only.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from dsn_contract import validate_database_targets
from export_sanitize import public_bootstrap_summary, write_sanitized_json

EXPECTED_MIGRATION_HEAD = "a360s010005"
BACKEND_PIN_SHA = "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa"
DEFAULT_PG_PORT = "55439"
CONTAINER_NAME = "aieos-pk-v1-hint-e2e-pg"


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    path = Path(root).resolve()
    if not (path / "tests" / "conftest.py").is_file():
        raise SystemExit(f"Invalid AIEOS_BACKEND_ROOT: {path}")
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
    raise RuntimeError(f"PostgreSQL did not accept connections on {host}:{port}")


def _start_owned_local_postgres(port: str) -> str:
    script = _script_dir() / "start_owned_postgres.mjs"
    env = {
        **os.environ,
        "AIEOS_TEST_PG_PORT": port,
        "PK_V1_HINT_E2E_PG_CONTAINER": os.environ.get(
            "PK_V1_HINT_E2E_PG_CONTAINER", CONTAINER_NAME
        ),
    }
    proc = subprocess.run(
        ["node", str(script)],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            proc.stderr.strip() or proc.stdout.strip() or "start_owned_postgres failed"
        )
    summary = json.loads(proc.stdout.strip().splitlines()[-1])
    if not summary.get("ok"):
        raise RuntimeError("owned postgres start did not report ok")
    _wait_for_tcp("127.0.0.1", int(port))
    return port


def _restrict_permissions(path: Path) -> None:
    try:
        path.chmod(0o600)
    except OSError:
        pass


def _cleanup_primary_start() -> None:
    subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import { cleanupPartialPrimaryStart } from './managed_lifecycle.mjs'; cleanupPartialPrimaryStart();",
        ],
        cwd=_script_dir(),
        capture_output=True,
        text=True,
    )


def main() -> int:
    validate_database_targets()

    backend = _backend_root()
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))

    from alembic import command
    from sqlalchemy import text

    from tests.conftest import (  # noqa: E402
        alembic_config,
        bootstrap_url,
        migrator_url,
        provision_identities,
        provision_runtime_grants,
        runtime_url,
        wait_for_engine,
    )

    report_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_DB_REPORT",
            _script_dir().parents[1] / "tmp" / "pk-v1-hint-e2e-db.json",
        )
    )
    sanitized_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_DB_REPORT_SANITIZED",
            report_path.parent / "pk-v1-hint-e2e-db-sanitized.json",
        )
    )

    external = os.environ.get("AIEOS_TEST_DATABASE_URL")
    started_container = False
    container_id = None
    try:
        if external:
            b_url = os.environ.get("AIEOS_TEST_BOOTSTRAP_DATABASE_URL", external)
            m_url = external
            r_url = os.environ.get("AIEOS_TEST_RUNTIME_DATABASE_URL", external)
            port = "5432"
        else:
            port = os.environ.get("AIEOS_TEST_PG_PORT", DEFAULT_PG_PORT)
            port = _start_owned_local_postgres(port)
            started_container = True
            ownership_path = (
                _script_dir().parents[1] / "tmp" / "pk-v1-hint-e2e-docker-ownership.json"
            )
            if ownership_path.is_file():
                container_id = json.loads(
                    ownership_path.read_text(encoding="utf-8")
                ).get("containerId")
            b_url = bootstrap_url(port)
            m_url = migrator_url(port)
            r_url = runtime_url(port)

        bootstrap = wait_for_engine(b_url)
        with bootstrap.connect() as conn:
            version = conn.execute(text("SHOW server_version")).scalar_one()
            if not str(version).startswith("18."):
                raise RuntimeError("PostgreSQL 18 required for journey substrate")

        provision_identities(bootstrap)
        os.environ["AIEOS_DATABASE_URL"] = m_url
        cfg = alembic_config(m_url)
        command.upgrade(cfg, "head")
        with bootstrap.connect() as conn:
            head = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
        if head != EXPECTED_MIGRATION_HEAD:
            raise RuntimeError("journey migration head mismatch")
        provision_runtime_grants(bootstrap)

        report = {
            "postgres_major": 18,
            "migration_head": head,
            "runtime_database_url": r_url,
            "bootstrap_database_url": b_url,
            "started_container": started_container,
            "host_port": port,
            "backend_pin_sha": BACKEND_PIN_SHA,
            "container_name": os.environ.get(
                "PK_V1_HINT_E2E_PG_CONTAINER", CONTAINER_NAME
            ),
            "container_id": container_id,
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        _restrict_permissions(report_path)
        write_sanitized_json(str(sanitized_path), report)
        _restrict_permissions(sanitized_path)

        print(json.dumps(public_bootstrap_summary(report)))
        return 0
    except Exception:
        if started_container:
            _cleanup_primary_start()
        print(json.dumps({"bootstrap_ok": False}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())