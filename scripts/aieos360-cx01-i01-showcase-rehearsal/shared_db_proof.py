"""Prove CX01-I01 rehearsal uses one shared PostgreSQL 18 database contract."""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

EXPECTED_MIGRATION_HEAD = "a360s010004"


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    tmp = Path(__file__).resolve().parents[2] / "tmp"
    db_report_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_DB_REPORT",
            tmp / "aieos360-cx01-i01-showcase-db.json",
        )
    )
    fixture_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH",
            tmp / "aieos360-cx01-i01-showcase-fixture.json",
        )
    )
    if not db_report_path.is_file() or not fixture_path.is_file():
        raise SystemExit("db report and fixture required — run reset first")

    db_report = _read_json(db_report_path)
    fixture = _read_json(fixture_path)

    if db_report.get("postgres_major") != 18:
        raise SystemExit(f"expected PostgreSQL 18; got {db_report.get('postgres_major')}")
    if not db_report.get("shared_database"):
        raise SystemExit("shared_database must be true")
    runtime_url = db_report["runtime_database_url"]
    for role in ("teacher", "student", "principal", "parent"):
        env_key = f"AIEOS360_CX01_I01_SHOWCASE_{role.upper()}_RUNTIME_DATABASE_URL"
        if os.environ.get(env_key) and os.environ[env_key] != runtime_url:
            raise SystemExit(f"{role} runtime URL diverges from shared contract")

    backend = os.environ.get("AIEOS_BACKEND_ROOT")
    if not backend:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    sys.path.insert(0, str(Path(backend).resolve() / "src"))
    sys.path.insert(0, str(Path(backend).resolve()))

    from sqlalchemy import create_engine, text

    from tests.dbutil import set_tenant

    bootstrap_url = db_report.get("bootstrap_database_url", runtime_url)
    tenant_id = uuid.UUID(fixture["tenant_id"])

    bootstrap_engine = create_engine(bootstrap_url)
    with bootstrap_engine.connect() as conn:
        head = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        if head != EXPECTED_MIGRATION_HEAD:
            raise SystemExit(f"migration head {head} != {EXPECTED_MIGRATION_HEAD}")

        set_tenant(conn, tenant_id)
        principal_count = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM security.principals p
                JOIN security.tenant_memberships m
                  ON m.principal_id = p.principal_id
                WHERE m.tenant_id = :tid
                """
            ),
            {"tid": tenant_id},
        ).scalar_one()
        if principal_count < 3:
            raise SystemExit(f"expected seeded principals; got {principal_count}")

        work_count = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM teaching.works
                WHERE tenant_id = :tid AND goal_text LIKE :marker
                """
            ),
            {"tid": tenant_id, "marker": "%CX01-I01%"},
        ).scalar_one()
        if work_count < 1:
            raise SystemExit("expected seeded prerequisite TeachingWork")
    bootstrap_engine.dispose()

    proof = {
        "shared_database": True,
        "runtime_database_url_host": runtime_url.split("@")[-1],
        "migration_head": EXPECTED_MIGRATION_HEAD,
        "postgres_major": 18,
        "roles_share_contract": ["teacher", "student", "principal", "parent"],
        "fixture_scenario_id": fixture["scenario_id"],
    }
    out_path = tmp / "aieos360-cx01-i01-showcase-shared-db-proof.json"
    out_path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(proof, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
