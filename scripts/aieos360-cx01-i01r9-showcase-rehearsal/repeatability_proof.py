"""Run canonical CX01 reset twice; prove prior rehearsal outputs are cleared."""

from __future__ import annotations

import json
import os
import subprocess
import uuid
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
EXPECTED_MIGRATION_HEAD = "a360s010004"


def _run_canonical_reset(env: dict[str, str]) -> None:
    if env.get("AIEOS_TEST_DATABASE_URL"):
        if env.get("AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG") != "1":
            raise SystemExit(
                "repeatability proof requires caller-authorized "
                "AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG=1 for external PostgreSQL"
            )
    result = subprocess.run(
        ["node", str(SCRIPT_DIR / "reset.mjs")],
        cwd=REPO_ROOT,
        env=env,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"canonical reset.mjs failed with {result.returncode}")


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

    env = {**os.environ}
    env.setdefault("AIEOS_TEST_PG_PORT", "55448")

    tmp = REPO_ROOT / "tmp"
    db_report_path = tmp / "aieos360-cx01-i01-showcase-db.json"
    fixture_path = tmp / "aieos360-cx01-i01-showcase-fixture.json"

    env.setdefault("AIEOS360_CX01_I01_SHOWCASE_DB_REPORT", str(db_report_path))
    env.setdefault("AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH", str(fixture_path))

    _run_canonical_reset(env)
    fixture_1 = json.loads(fixture_path.read_text(encoding="utf-8"))
    db_1 = json.loads(db_report_path.read_text(encoding="utf-8"))
    bootstrap = db_1["bootstrap_database_url"]
    tenant_id = fixture_1["tenant_id"]

    _insert_synthetic_assignment(bootstrap, fixture_1)
    if _count_assignments(bootstrap, tenant_id) != 1:
        raise SystemExit("expected synthetic assignment after rehearsal pollution")

    _run_canonical_reset(env)
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
        "canonical_reset_path": "reset.mjs",
        "assignments_after_pollution": 1,
        "assignments_after_second_reset": 0,
        "migration_head_after_reset_2": db_2.get("migration_head"),
        "scenario_id_stable": True,
        "fixture_identity_after_reset_cycle_1": {
            "tenant_id": fixture_1.get("tenant_id"),
            "class_ref": fixture_1.get("class_ref"),
            "scenario_id": fixture_1.get("scenario_id"),
        },
        "fixture_identity_after_reset_cycle_2": {
            "tenant_id": fixture_2.get("tenant_id"),
            "class_ref": fixture_2.get("class_ref"),
            "scenario_id": fixture_2.get("scenario_id"),
        },
        "artifact_note": (
            "Repeatability proof spans two sequential reset cycles; "
            "fixture fields above are from distinct snapshots, not one combined state."
        ),
    }
    from export_sanitize import write_sanitized_json

    out = tmp / "aieos360-cx01-i01-showcase-repeatability-proof.json"
    write_sanitized_json(str(out), proof)
    print(json.dumps(proof, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
