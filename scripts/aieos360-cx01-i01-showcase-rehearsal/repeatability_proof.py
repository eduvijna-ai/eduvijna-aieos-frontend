"""Run CX01 reset twice; prove prior rehearsal outputs are cleared."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
EXPECTED_MIGRATION_HEAD = "a360s010004"


def _run_reset_cycle() -> None:
    env = {**os.environ}
    env.setdefault("AIEOS_TEST_PG_PORT", "55448")
    if env.get("AIEOS_TEST_DATABASE_URL"):
        env.setdefault("AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG", "1")
    for name in (
        "bootstrap_database.py",
        "seed_precondition.py",
        "emit_manifest.py",
    ):
        script = SCRIPT_DIR / name
        backend_root = env["AIEOS_BACKEND_ROOT"]
        result = subprocess.run(
            [
                os.environ.get("AIEOS360_CX01_I01_SHOWCASE_UV", "uv"),
                "run",
                "python",
                str(script),
            ],
            cwd=backend_root,
            env={
                **env,
                "AIEOS_BACKEND_ROOT": backend_root,
                "PYTHONPATH": os.pathsep.join(
                    [
                        str(Path(backend_root) / "src"),
                        backend_root,
                        str(SCRIPT_DIR),
                    ]
                ),
            },
            check=False,
        )
        if result.returncode != 0:
            raise SystemExit(f"{name} failed with {result.returncode}")


def _count_assignments(bootstrap_url: str, tenant_id: str) -> int:
    from sqlalchemy import create_engine, text

    from tests.dbutil import set_tenant

    engine = create_engine(bootstrap_url)
    with engine.connect() as conn:
        set_tenant(conn, uuid.UUID(tenant_id))
        count = conn.execute(
            text("SELECT COUNT(*) FROM teaching.assignments")
        ).scalar_one()
    engine.dispose()
    return int(count)


def _insert_synthetic_assignment(bootstrap_url: str, fixture: dict) -> None:
    from sqlalchemy import create_engine, text

    from tests.dbutil import set_tenant

    assignment_id = uuid.uuid4()
    now = datetime.now(UTC)
    tenant_id = uuid.UUID(fixture["tenant_id"])
    engine = create_engine(bootstrap_url)
    with engine.begin() as conn:
        set_tenant(conn, tenant_id)
        conn.execute(
            text(
                """
                INSERT INTO teaching.assignments (
                    assignment_id, tenant_id, teacher_principal_id,
                    content_id, content_version_id, audience_type, class_ref,
                    audience_display_label, source_work_id, lifecycle_state,
                    assigned_at, available_from, due_at, closed_at, cancelled_at,
                    aggregate_revision, created_at, updated_at
                ) VALUES (
                    :assignment_id, :tenant_id, :teacher_id,
                    :content_id, :version_id, 'class', :class_ref,
                    'CX01 synthetic', :work_id, 'ACTIVE',
                    :now, :now, NULL, NULL, NULL,
                    0, :now, :now
                )
                """
            ),
            {
                "assignment_id": assignment_id,
                "tenant_id": uuid.UUID(fixture["tenant_id"]),
                "teacher_id": uuid.UUID(fixture["teacher_principal_id"]),
                "content_id": uuid.UUID(fixture["content_id"]),
                "version_id": uuid.UUID(fixture["version_id"]),
                "class_ref": fixture["class_ref"],
                "work_id": uuid.UUID(fixture["work_id"]),
                "now": now,
            },
        )
    engine.dispose()


def main() -> int:
    if not os.environ.get("AIEOS_BACKEND_ROOT"):
        raise SystemExit("AIEOS_BACKEND_ROOT is required")

    tmp = REPO_ROOT / "tmp"
    db_report_path = tmp / "aieos360-cx01-i01-showcase-db.json"
    fixture_path = tmp / "aieos360-cx01-i01-showcase-fixture.json"

    os.environ.setdefault(
        "AIEOS360_CX01_I01_SHOWCASE_DB_REPORT", str(db_report_path)
    )
    os.environ.setdefault(
        "AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH", str(fixture_path)
    )

    _run_reset_cycle()
    fixture_1 = json.loads(fixture_path.read_text(encoding="utf-8"))
    db_1 = json.loads(db_report_path.read_text(encoding="utf-8"))
    bootstrap = db_1["bootstrap_database_url"]
    tenant_id = fixture_1["tenant_id"]

    _insert_synthetic_assignment(bootstrap, fixture_1)
    if _count_assignments(bootstrap, tenant_id) != 1:
        raise SystemExit("expected synthetic assignment after rehearsal pollution")

    _run_reset_cycle()
    fixture_2 = json.loads(fixture_path.read_text(encoding="utf-8"))
    db_2 = json.loads(db_report_path.read_text(encoding="utf-8"))

    if _count_assignments(db_2["bootstrap_database_url"], tenant_id) != 0:
        raise SystemExit("reset must clear prior TeachingAssignment outputs")

    for key in ("scenario_id", "tenant_id", "class_ref", "class_ref_5b"):
        if fixture_1[key] != fixture_2[key]:
            raise SystemExit(f"fixture field {key} diverged across resets")

    if db_2.get("migration_head") != EXPECTED_MIGRATION_HEAD:
        raise SystemExit("migration head drift after second reset")

    proof = {
        "reset_cycles": 2,
        "assignments_after_pollution": 1,
        "assignments_after_second_reset": 0,
        "migration_head_after_reset_2": db_2.get("migration_head"),
        "scenario_id_stable": True,
    }
    out = tmp / "aieos360-cx01-i01-showcase-repeatability-proof.json"
    out.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(proof, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
