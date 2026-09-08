"""Seed Student assignment precondition for AIEOS360-S01-I04R1 product E2E.

Uses governed backend development/test utilities only:
  ensure_synthetic_student_principals
  seed_published_learner_content
  create_learner_assignment

Does not call frontend PostgreSQL/PostgREST. NON_PRODUCTION only.
Backend pin: 921d35eb08890a4e1d86cf95daf9d38cdfc4a13c
Migration head: a360s010002
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

SCENARIO_ID = "aieos360-s01-i04r1-student-assignment-attempt-product-e2e"
BACKEND_PIN_SHA = "921d35eb08890a4e1d86cf95daf9d38cdfc4a13c"
EXPECTED_MIGRATION_HEAD = "a360s010002"
OPENAPI_AUTHORITY_SHA = (
    "4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330"
)
WORKSHEET_TITLE = "S01 Student Leaf Parts Worksheet"


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    path = Path(root).resolve()
    if not (path / "src" / "aieos" / "development" / "app_factory.py").is_file():
        raise SystemExit(f"Invalid AIEOS_BACKEND_ROOT: {path}")
    return path


def main() -> int:
    backend = _backend_root()
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))

    from sqlalchemy import create_engine

    from aieos.development.learner_principals import (
        CLASS_REF_5A,
        DEVELOPMENT_STUDENT_A_TOKEN,
        STUDENT_A_PRINCIPAL_ID,
        SYNTHETIC_TENANT_ID,
        ensure_synthetic_student_principals,
    )
    from aieos.development.teacher_os_review_scenario import SYNTHETIC_PRINCIPAL_ID
    from aieos.domains.education.schema import WORKSHEET_CONTENT_TYPE
    from aieos.platform.security.authorization.decisions import PrincipalKind
    from tests.domains.learning.helpers_aieos360_s01_i03 import (
        create_learner_assignment,
        seed_published_learner_content,
    )
    from tests.domains.teaching.worksheet_fixtures import valid_worksheet_payload
    from tests.platform.security.authorization.helpers import seed_principal

    runtime_url = os.environ.get("STUDENT_PRODUCT_E2E_RUNTIME_DATABASE_URL")
    bootstrap_url = os.environ.get("STUDENT_PRODUCT_E2E_BOOTSTRAP_DATABASE_URL")
    db_report_path = Path(
        os.environ.get(
            "STUDENT_PRODUCT_E2E_DB_REPORT",
            Path(__file__).resolve().parents[2] / "tmp" / "student-product-e2e-db.json",
        )
    )
    db_report: dict | None = None
    if db_report_path.is_file():
        db_report = json.loads(db_report_path.read_text(encoding="utf-8"))
    if not runtime_url:
        if not db_report:
            raise SystemExit(
                "STUDENT_PRODUCT_E2E_RUNTIME_DATABASE_URL or "
                "STUDENT_PRODUCT_E2E_DB_REPORT required"
            )
        runtime_url = db_report["runtime_database_url"]
    if not bootstrap_url:
        if db_report and db_report.get("bootstrap_database_url"):
            bootstrap_url = db_report["bootstrap_database_url"]
        else:
            raise SystemExit(
                "STUDENT_PRODUCT_E2E_BOOTSTRAP_DATABASE_URL or "
                "bootstrap_database_url in STUDENT_PRODUCT_E2E_DB_REPORT required"
            )

    fixture_path = Path(
        os.environ.get(
            "STUDENT_PRODUCT_E2E_FIXTURE_PATH",
            Path(__file__).resolve().parents[2]
            / "tmp"
            / "student-product-e2e-fixture.json",
        )
    )
    membership_gate_path = Path(
        os.environ.get(
            "STUDENT_PRODUCT_E2E_MEMBERSHIP_GATE",
            Path(__file__).resolve().parents[2]
            / "tmp"
            / "student-product-e2e-membership-gate.txt",
        )
    )

    if db_report and db_report.get("migration_head") != EXPECTED_MIGRATION_HEAD:
        raise SystemExit(
            f"Expected migration head {EXPECTED_MIGRATION_HEAD}; "
            f"got {db_report.get('migration_head')}"
        )

    tenant_id = SYNTHETIC_TENANT_ID
    teacher_id = SYNTHETIC_PRINCIPAL_ID
    student_id = STUDENT_A_PRINCIPAL_ID

    bootstrap_engine = create_engine(bootstrap_url)
    runtime_engine = create_engine(runtime_url)

    ensure_synthetic_student_principals(bootstrap_engine)
    seed_principal(
        bootstrap_engine, teacher_id, principal_kind=PrincipalKind.HUMAN
    )

    payload = valid_worksheet_payload(
        title=WORKSHEET_TITLE,
        question_count=6,
    )
    content_id, version_id = seed_published_learner_content(
        bootstrap_engine,
        tenant_id=tenant_id,
        content_type=WORKSHEET_CONTENT_TYPE,
        owner_id=teacher_id,
        payload=payload,
    )

    available_from = datetime.now(UTC) - timedelta(days=1)
    due_at = datetime.now(UTC) + timedelta(days=7)
    # Five fillers first (older updated_at). Primary last so it appears on HOME_SLICE.
    for index in range(5):
        filler_payload = valid_worksheet_payload(
            title=f"S01 Student Filler Worksheet {index + 1}",
            question_count=4,
        )
        filler_content_id, filler_version_id = seed_published_learner_content(
            bootstrap_engine,
            tenant_id=tenant_id,
            content_type=WORKSHEET_CONTENT_TYPE,
            owner_id=teacher_id,
            payload=filler_payload,
        )
        create_learner_assignment(
            runtime_engine,
            tenant_id=tenant_id,
            principal_id=teacher_id,
            content_id=filler_content_id,
            content_version_id=filler_version_id,
            idempotency_key=f"{SCENARIO_ID}:create-filler-assignment:{index}",
            class_ref=CLASS_REF_5A,
            available_from=available_from,
            due_at=due_at,
        )
    assignment = create_learner_assignment(
        runtime_engine,
        tenant_id=tenant_id,
        principal_id=teacher_id,
        content_id=content_id,
        content_version_id=version_id,
        idempotency_key=f"{SCENARIO_ID}:create-assignment",
        class_ref=CLASS_REF_5A,
        available_from=available_from,
        due_at=due_at,
    )

    true_false_question_ids = [
        item["id"]
        for item in payload["questions"]  # type: ignore[index]
        if item["question_type"] == "true_false"
    ]
    if not true_false_question_ids:
        raise RuntimeError("seed worksheet must include at least one true_false question")

    membership_gate_path.parent.mkdir(parents=True, exist_ok=True)
    membership_gate_path.write_text("allowed\n", encoding="utf-8")

    fixture = {
        "scenario_id": SCENARIO_ID,
        "backend_pin_sha": BACKEND_PIN_SHA,
        "migration_head": EXPECTED_MIGRATION_HEAD,
        "openapi_authority_sha": OPENAPI_AUTHORITY_SHA,
        "tenant_id": str(tenant_id),
        "teacher_principal_id": str(teacher_id),
        "student_principal_id": str(student_id),
        "bearer_token": DEVELOPMENT_STUDENT_A_TOKEN,
        "class_ref": CLASS_REF_5A,
        "assignment_id": str(assignment.assignment_id.value),
        "content_id": str(content_id),
        "content_version_id": str(version_id),
        "content_type": WORKSHEET_CONTENT_TYPE,
        "worksheet_title": WORKSHEET_TITLE,
        "true_false_question_id": true_false_question_ids[0],
        "membership_gate_path": str(membership_gate_path),
        "available_from": available_from.isoformat(),
        "due_at": due_at.isoformat(),
    }
    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(fixture, indent=2))

    bootstrap_engine.dispose()
    runtime_engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
