"""Bootstrap disposable PostgreSQL 18 for AIEOS360-CX01-I01 showcase rehearsal.

Reuses backend tests/conftest.py identity, migration, and runtime-grant patterns.
NON_PRODUCTION only. Requires AIEOS_BACKEND_ROOT at governed backend pin.
Governed migration head: a360s010004.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

EXPECTED_MIGRATION_HEAD = "a360s010004"


def _cleanup_owned_local_container(script_dir: Path) -> str | None:
    import subprocess

    result = subprocess.run(
        ["node", str(script_dir / "remove_owned_pg.mjs")],
        check=False,
        env=os.environ.copy(),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return (result.stderr or result.stdout or "owned container cleanup failed").strip()
    return None


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    path = Path(root).resolve()
    if not (path / "tests" / "conftest.py").is_file():
        raise SystemExit(f"Invalid AIEOS_BACKEND_ROOT: {path}")
    return path


def main() -> int:
    backend = _backend_root()
    script_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_dir))
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))

    from reset_safety import assert_reset_target_safe

    assert_reset_target_safe()

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
    from tests.dbutil import clear_asset_audit_rows_for_schema_downgrade  # noqa: E402

    port = os.environ.get("AIEOS_TEST_PG_PORT", "55448")
    report_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_DB_REPORT",
            Path(__file__).resolve().parents[2] / "tmp" / "aieos360-cx01-i01-showcase-db.json",
        )
    )

    external = os.environ.get("AIEOS_TEST_DATABASE_URL")
    started_container = False
    bootstrap = None
    try:
        if external:
            b_url = os.environ.get("AIEOS_TEST_BOOTSTRAP_DATABASE_URL", external)
            m_url = external
            r_url = os.environ.get("AIEOS_TEST_RUNTIME_DATABASE_URL", external)
        else:
            import subprocess

            port = os.environ.get("AIEOS_TEST_PG_PORT", "55448")
            subprocess.run(
                ["node", str(script_dir / "start_governed_pg.mjs")],
                check=True,
                env={**os.environ, "AIEOS_TEST_PG_PORT": str(port)},
            )
            started_container = True
            b_url = bootstrap_url(port)
            m_url = migrator_url(port)
            r_url = runtime_url(port)

        if os.environ.get("AIEOS360_CX01_I01R9_PROOF_BOOTSTRAP_FAIL_AFTER_PG") == "1":
            raise RuntimeError(
                "proof: simulated local bootstrap failure after owned container start"
            )

        if (
            started_container
            and os.environ.get("AIEOS360_CX01_I01R9_PROOF_BOOTSTRAP_REPORT_WRITE_FAIL")
            == "1"
        ):
            report_path.parent.mkdir(parents=True, exist_ok=True)
            raise OSError("proof: simulated report write failure")

        bootstrap = wait_for_engine(b_url)
        with bootstrap.connect() as conn:
            version = conn.execute(text("SHOW server_version")).scalar_one()
            if not str(version).startswith("18."):
                raise RuntimeError(f"PostgreSQL 18 required; got {version}")

        provision_identities(bootstrap)
        os.environ["AIEOS_DATABASE_URL"] = m_url
        cfg = alembic_config(m_url)
        if (
            external
            and os.environ.get("AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG") == "1"
        ):
            with bootstrap.connect() as conn:
                schema_migrated = conn.execute(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                              AND table_name = 'alembic_version'
                        )
                        """
                    )
                ).scalar_one()
            if schema_migrated:
                command.upgrade(cfg, "head")
                clear_asset_audit_rows_for_schema_downgrade(bootstrap)
                command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
        head = None
        with bootstrap.connect() as conn:
            head = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
        if head != EXPECTED_MIGRATION_HEAD:
            raise RuntimeError(
                f"Expected migration head {EXPECTED_MIGRATION_HEAD}; got {head}"
            )
        provision_runtime_grants(bootstrap)

        report = {
            "postgres_major": 18,
            "migration_head": head,
            "runtime_database_url": r_url,
            "bootstrap_database_url": b_url,
            "started_container": started_container,
            "container_name": os.environ.get(
                "AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER", "aieos-aieos360-cx01-i01-showcase-pg"
            )
            if started_container
            else None,
            "port": port,
            "shared_database": True,
            "coherent_school_context_provider": "DevelopmentCoherentSchoolContextProvider",
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report))
    except BaseException:
        if bootstrap is not None:
            bootstrap.dispose()
        if started_container:
            cleanup_diag = _cleanup_owned_local_container(script_dir)
            if cleanup_diag:
                print(
                    f"warning: owned container cleanup diagnostic: {cleanup_diag}",
                    file=sys.stderr,
                )
        raise

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
