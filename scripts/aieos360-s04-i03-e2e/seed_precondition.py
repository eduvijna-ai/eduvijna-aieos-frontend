"""Seed I03 integrated cross-role real-stack precondition (shared PostgreSQL).

Creates:
  - HUMAN teacher principal (SYNTHETIC_PRINCIPAL_ID)
  - Student A and Student B principals (development learners)
  - Canonical Principal OS HUMAN principal (ACTIVE, HUMAN)
  - Canonical Parent OS HUMAN adult A principal (ACTIVE, HUMAN)
  - TeachingWork + generated APPROVED unpublished worksheet

Does NOT create TeachingAssignment / LearnerAttempt / LearnerSubmission /
assessment results / Principal or Parent Intelligence responses.

School Context authority is NOT seeded into PostgreSQL — it comes from
DevelopmentCoherentSchoolContextProvider canonical defaults at runtime.

NON_PRODUCTION only.
Backend pin: 637583f42b7c475ef83f6f99bca7e65e665a253d
Migration head: a360s010004
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

SCENARIO_MARKER = (
    "[AIEOS360-S04-I03-E2E] INTEGRATED CROSS-ROLE REAL-STACK AIEOS360"
)
SCENARIO_ID = "aieos360-s04-i03-e2e-integrated-cross-role"
BACKEND_PIN_SHA = "637583f42b7c475ef83f6f99bca7e65e665a253d"
EXPECTED_MIGRATION_HEAD = "a360s010004"
OPENAPI_AUTHORITY_SHA = (
    "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0"
)
ARCHITECTURE_PIN_SHA = "b167bfd951cf9acecb6ff2470ed0fb8c1925097e"
FRONTEND_BASE_SHA = "20a06f048510a2519e0487d12ea7c16f59e7fd7c"
DEV_TEACHER_BEARER_TOKEN = "aieos360-s04-i03-e2e-teacher"
DEV_PRINCIPAL_BEARER_TOKEN = "aieos360-s04-i03-e2e-principal"
DEV_PARENT_BEARER_TOKEN = "aieos360-s04-i03-e2e-parent"


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    path = Path(root).resolve()
    if not (path / "src" / "aieos" / "development" / "app_factory.py").is_file():
        raise SystemExit(f"Invalid AIEOS_BACKEND_ROOT: {path}")
    return path


def _headers(
    tenant_id: str,
    *,
    idempotency_key: str | None = None,
    if_match: str | None = None,
) -> dict[str, str]:
    out = {"X-AIEOS-Tenant-ID": tenant_id}
    if idempotency_key is not None:
        out["Idempotency-Key"] = idempotency_key
    if if_match is not None:
        out["If-Match"] = if_match
    return out


def main() -> int:
    backend = _backend_root()
    script_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))
    sys.path.insert(0, str(script_dir))

    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine, text

    from aieos.development.app_factory import build_development_teacher_os_app
    from aieos.development.coherent_school_context import (
        CLASS_REF_5A,
        CLASS_REF_5B,
        PARENT_OS_HUMAN_ADULT_A_ID,
        PRINCIPAL_OS_HUMAN_PRINCIPAL_ID,
        STUDENT_A_PRINCIPAL_ID,
        STUDENT_B_PRINCIPAL_ID,
        SYNTHETIC_PRINCIPAL_ID,
        SYNTHETIC_TENANT_ID,
    )
    from aieos.development.learner_principals import (
        DEVELOPMENT_STUDENT_A_TOKEN,
        DEVELOPMENT_STUDENT_B_TOKEN,
        ensure_synthetic_student_principals,
    )
    from aieos.platform.ai.fake import FakeStructuredModelGateway
    from aieos.platform.security.authorization.decisions import PrincipalKind
    from deterministic_worksheet import (
        OBJ_DEMONSTRATED_ID,
        OBJ_INSUFFICIENT_ID,
        OBJ_NOT_YET_ID,
        Q_CORRECT_ID,
        Q_INCORRECT_ID,
        Q_OPEN_ID,
        Q_UNANSWERED_ID,
        WORKSHEET_TITLE,
        deterministic_i03_worksheet_model,
    )
    from tests.platform.security.authorization.helpers import (
        seed_membership,
        seed_principal,
        seed_tenant,
    )

    runtime_url = os.environ.get("AIEOS360_S04_I03_E2E_RUNTIME_DATABASE_URL")
    bootstrap_url = os.environ.get("AIEOS360_S04_I03_E2E_BOOTSTRAP_DATABASE_URL")
    db_report_path = Path(
        os.environ.get(
            "AIEOS360_S04_I03_E2E_DB_REPORT",
            Path(__file__).resolve().parents[2] / "tmp" / "aieos360-s04-i03-e2e-db.json",
        )
    )
    db_report: dict | None = None
    if db_report_path.is_file():
        db_report = json.loads(db_report_path.read_text(encoding="utf-8"))
    if not runtime_url:
        if not db_report:
            raise SystemExit(
                "AIEOS360_S04_I03_E2E_RUNTIME_DATABASE_URL or "
                "AIEOS360_S04_I03_E2E_DB_REPORT required"
            )
        runtime_url = db_report["runtime_database_url"]
    if not bootstrap_url:
        if db_report and db_report.get("bootstrap_database_url"):
            bootstrap_url = db_report["bootstrap_database_url"]
        else:
            raise SystemExit(
                "AIEOS360_S04_I03_E2E_BOOTSTRAP_DATABASE_URL or "
                "bootstrap_database_url in AIEOS360_S04_I03_E2E_DB_REPORT required"
            )

    fixture_path = Path(
        os.environ.get(
            "AIEOS360_S04_I03_E2E_FIXTURE_PATH",
            Path(__file__).resolve().parents[2]
            / "tmp"
            / "aieos360-s04-i03-e2e-fixture.json",
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
    student_b_id = STUDENT_B_PRINCIPAL_ID
    principal_id = PRINCIPAL_OS_HUMAN_PRINCIPAL_ID
    parent_id = PARENT_OS_HUMAN_ADULT_A_ID

    bootstrap_engine = create_engine(bootstrap_url)
    runtime_engine = create_engine(runtime_url)

    ensure_synthetic_student_principals(bootstrap_engine)
    seed_tenant(bootstrap_engine, tenant_id)
    seed_principal(
        bootstrap_engine, teacher_id, principal_kind=PrincipalKind.HUMAN
    )
    seed_principal(
        bootstrap_engine,
        principal_id,
        principal_kind=PrincipalKind.HUMAN,
        status="ACTIVE",
    )
    seed_principal(
        bootstrap_engine,
        parent_id,
        principal_kind=PrincipalKind.HUMAN,
        status="ACTIVE",
    )
    seed_membership(
        bootstrap_engine,
        tenant_id=tenant_id,
        principal_id=student_id,
    )
    seed_membership(
        bootstrap_engine,
        tenant_id=tenant_id,
        principal_id=student_b_id,
    )

    gateway = FakeStructuredModelGateway(
        result_factory=lambda _request: deterministic_i03_worksheet_model(),
        provider_id="fake",
        model_id="fake-model",
    )
    # Seed uses governed teacher app factory only to create TeachingWork /
    # Content prerequisite. Runtime role surfaces use the coherent provider.
    app = build_development_teacher_os_app(
        runtime_engine,
        tenant_id=tenant_id,
        principal_id=teacher_id,
        model_gateway=gateway,
        ai_provider_id="fake",
        ai_model_id="fake-model",
    )

    scenario_date = date.fromisoformat(
        os.environ.get("AIEOS360_S04_I03_E2E_SCENARIO_DATE", "2026-09-18")
    )
    target_date = scenario_date + timedelta(days=1)

    with TestClient(app, raise_server_exceptions=False) as client:
        works = client.get(
            "/api/v1/teaching/works",
            params={"limit": 100},
            headers=_headers(str(tenant_id)),
        )
        if works.status_code != 200:
            raise RuntimeError(f"works list failed: {works.status_code} {works.text}")

        work_id = None
        work_etag = None
        for item in works.json()["items"]:
            if item.get("goal_text") == SCENARIO_MARKER:
                work_id = item["work_id"]
                work_etag = f'"r{item["aggregate_revision"]}"'
                break

        if work_id is None:
            created = client.post(
                "/api/v1/teaching/works",
                json={
                    "intent_type": "prepare_tomorrow",
                    "goal_text": SCENARIO_MARKER,
                    "target_date": target_date.isoformat(),
                    "locale": "en-IN",
                    "class_label": "Grade 5A",
                    "subject": "Mathematics",
                    "topic": "Deterministic I03 integrated cross-role evidence",
                },
                headers=_headers(
                    str(tenant_id),
                    idempotency_key=f"{SCENARIO_ID}:create-work",
                ),
            )
            if created.status_code not in (200, 201):
                raise RuntimeError(f"work create failed: {created.text}")
            work_id = created.json()["work_id"]
            work_etag = created.headers["ETag"]

        artifacts = client.get(
            f"/api/v1/teaching/works/{work_id}/artifacts",
            headers=_headers(str(tenant_id)),
        )
        if artifacts.status_code != 200:
            raise RuntimeError(f"artifacts list failed: {artifacts.text}")
        existing_items = artifacts.json().get("items") or []

        if existing_items:
            artifact = existing_items[0]
            content_id = artifact["content_id"]
            version_id = artifact["version_id"]
        else:
            generated = client.post(
                f"/api/v1/teaching/works/{work_id}/actions/generate",
                headers=_headers(
                    str(tenant_id),
                    idempotency_key=f"{SCENARIO_ID}:generate",
                    if_match=work_etag,
                ),
            )
            if generated.status_code not in (200, 409):
                raise RuntimeError(
                    f"generate failed: {generated.status_code} {generated.text}"
                )
            if generated.status_code == 409:
                artifacts_retry = client.get(
                    f"/api/v1/teaching/works/{work_id}/artifacts",
                    headers=_headers(str(tenant_id)),
                )
                if (
                    artifacts_retry.status_code != 200
                    or not artifacts_retry.json()["items"]
                ):
                    raise RuntimeError(
                        "generate already exists but no artifacts found"
                    )
                artifact = artifacts_retry.json()["items"][0]
                content_id = artifact["content_id"]
                version_id = artifact["version_id"]
            else:
                body = generated.json()
                content_id = body["artifact"]["content_id"]
                version_id = body["artifact"]["version_id"]

        content_get = client.get(
            f"/api/v1/contents/{content_id}",
            headers=_headers(str(tenant_id)),
        )
        if content_get.status_code != 200:
            raise RuntimeError(f"content get failed: {content_get.text}")
        content = content_get.json()
        published_version_id_before = content.get("published_version_id")

        if content.get("stewardship_state") == "IN_REVIEW":
            detail = client.get(
                f"/api/v1/teacher-os/review-queue/{content_id}/versions/{version_id}",
                headers=_headers(str(tenant_id)),
            )
            if detail.status_code != 200:
                raise RuntimeError(f"review detail failed: {detail.text}")
            approved = client.post(
                f"/api/v1/contents/{content_id}/versions/{version_id}/actions/approve",
                json={},
                headers={
                    **_headers(
                        str(tenant_id),
                        idempotency_key=f"{SCENARIO_ID}:approve",
                    ),
                    "If-Match": detail.headers["ETag"],
                },
            )
            if approved.status_code != 200:
                raise RuntimeError(f"approve failed: {approved.text}")

        content_after = client.get(
            f"/api/v1/contents/{content_id}",
            headers=_headers(str(tenant_id)),
        )
        if content_after.status_code != 200:
            raise RuntimeError(f"content reload failed: {content_after.text}")
        final_content = content_after.json()
        if final_content["stewardship_state"] != "APPROVED":
            raise RuntimeError(
                f"expected APPROVED stewardship; got {final_content['stewardship_state']}"
            )
        if final_content["content_type"] != "worksheet":
            raise RuntimeError(
                f"expected worksheet; got {final_content['content_type']}"
            )

        version_get = client.get(
            f"/api/v1/contents/{content_id}/versions/{version_id}",
            headers=_headers(str(tenant_id)),
        )
        if version_get.status_code != 200:
            raise RuntimeError(f"version get failed: {version_get.text}")
        version_payload = version_get.json().get("payload") or {}
        question_ids = [
            item["id"] for item in version_payload.get("questions", [])
        ]
        expected_ids = {
            Q_CORRECT_ID,
            Q_INCORRECT_ID,
            Q_UNANSWERED_ID,
            Q_OPEN_ID,
            "q-filler-a",
            "q-filler-b",
        }
        if set(question_ids) != expected_ids:
            raise RuntimeError(
                f"deterministic question ids mismatch: got {question_ids}"
            )

    with bootstrap_engine.connect() as conn:
        for pid, label in (
            (parent_id, "Parent A"),
            (principal_id, "Principal"),
            (student_b_id, "Student B"),
        ):
            row = conn.execute(
                text(
                    """
                    SELECT status, principal_kind
                    FROM security.principals
                    WHERE principal_id = :pid
                    """
                ),
                {"pid": pid},
            ).one()
            if row.status != "ACTIVE":
                raise RuntimeError(f"expected {label} status ACTIVE; got {row.status}")
            if row.principal_kind != "HUMAN":
                raise RuntimeError(
                    f"expected {label} kind HUMAN; got {row.principal_kind}"
                )

    with runtime_engine.connect() as conn:
        row = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        if row != EXPECTED_MIGRATION_HEAD:
            raise RuntimeError(f"unexpected migration head {row}")

    fixture = {
        "scenario_id": SCENARIO_ID,
        "scenario_marker": SCENARIO_MARKER,
        "architecture_pin_sha": ARCHITECTURE_PIN_SHA,
        "frontend_base_sha": FRONTEND_BASE_SHA,
        "backend_pin_sha": BACKEND_PIN_SHA,
        "migration_head": EXPECTED_MIGRATION_HEAD,
        "openapi_authority_sha": OPENAPI_AUTHORITY_SHA,
        "tenant_id": str(tenant_id),
        "teacher_principal_id": str(teacher_id),
        "student_principal_id": str(student_id),
        "student_b_principal_id": str(student_b_id),
        "principal_principal_id": str(principal_id),
        "parent_principal_id": str(parent_id),
        "parent_kind": "HUMAN",
        "parent_status": "ACTIVE",
        "principal_kind": "HUMAN",
        "principal_status": "ACTIVE",
        "parent_capability": "parent.intelligence.read",
        "school_context_provider": "DevelopmentCoherentSchoolContextProvider",
        "harness_teacher_authority_map": None,
        "harness_student_membership_map": None,
        "harness_principal_scope_map": None,
        "harness_parent_learner_mapping": None,
        "teacher_bearer_token": DEV_TEACHER_BEARER_TOKEN,
        "student_bearer_token": DEVELOPMENT_STUDENT_A_TOKEN,
        "student_b_bearer_token": DEVELOPMENT_STUDENT_B_TOKEN,
        "principal_bearer_token": DEV_PRINCIPAL_BEARER_TOKEN,
        "parent_bearer_token": DEV_PARENT_BEARER_TOKEN,
        "class_ref": CLASS_REF_5A,
        "class_ref_5b": CLASS_REF_5B,
        "work_id": work_id,
        "content_id": content_id,
        "version_id": version_id,
        "content_type": "worksheet",
        "stewardship_state": "APPROVED",
        "published_version_id_before": published_version_id_before,
        "current_version_id": version_id,
        "worksheet_title": WORKSHEET_TITLE,
        "q_correct_id": Q_CORRECT_ID,
        "q_incorrect_id": Q_INCORRECT_ID,
        "q_unanswered_id": Q_UNANSWERED_ID,
        "q_open_id": Q_OPEN_ID,
        "obj_demonstrated_id": OBJ_DEMONSTRATED_ID,
        "obj_not_yet_id": OBJ_NOT_YET_ID,
        "obj_insufficient_id": OBJ_INSUFFICIENT_ID,
        "evaluation_policy_id": "aieos.learner_assessment.deterministic",
        "evaluation_policy_version": 1,
        "shared_database": True,
        "seeded_at": datetime.now(UTC).isoformat(),
    }
    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(fixture, indent=2))

    bootstrap_engine.dispose()
    runtime_engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
