"""Seed I05 cross-role precondition (shared PostgreSQL truth).

Creates:
  - HUMAN teacher principal
  - Student A principal (development learner)
  - TeachingWork + generated APPROVED unpublished worksheet with deterministic
    Q-CORRECT / Q-INCORRECT / Q-UNANSWERED / Q-OPEN questions

Does NOT create TeachingAssignment — Teacher Assign happens in the E2E.
NON_PRODUCTION only.
Backend pin: 3d25bb2d7ae3a6a95affdf075a75f20db48a6959
Migration head: a360s010004
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

SCENARIO_MARKER = (
    "[AIEOS360-S01-I05-E2E] REAL STUDENT → ASSESSMENT → TEACHER → IMPROVE"
)
SCENARIO_ID = "aieos360-s01-i05-e2e-student-assessment-teacher-improve"
BACKEND_PIN_SHA = "3d25bb2d7ae3a6a95affdf075a75f20db48a6959"
EXPECTED_MIGRATION_HEAD = "a360s010004"
OPENAPI_AUTHORITY_SHA = (
    "7B51CE21725651B8D556B9DD6D264473DF0A2E7CAF30D722E1CC776C651FAFBB"
)


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
    from aieos.development.learner_principals import (
        CLASS_REF_5A,
        DEVELOPMENT_STUDENT_A_TOKEN,
        STUDENT_A_PRINCIPAL_ID,
        ensure_synthetic_student_principals,
    )
    from aieos.development.teacher_os_review_scenario import (
        SYNTHETIC_PRINCIPAL_ID,
        SYNTHETIC_TENANT_ID,
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
        deterministic_i05_worksheet_model,
    )
    from tests.platform.security.authorization.helpers import seed_principal

    runtime_url = os.environ.get("AIEOS360_I05_E2E_RUNTIME_DATABASE_URL")
    bootstrap_url = os.environ.get("AIEOS360_I05_E2E_BOOTSTRAP_DATABASE_URL")
    db_report_path = Path(
        os.environ.get(
            "AIEOS360_I05_E2E_DB_REPORT",
            Path(__file__).resolve().parents[2] / "tmp" / "aieos360-i05-e2e-db.json",
        )
    )
    db_report: dict | None = None
    if db_report_path.is_file():
        db_report = json.loads(db_report_path.read_text(encoding="utf-8"))
    if not runtime_url:
        if not db_report:
            raise SystemExit(
                "AIEOS360_I05_E2E_RUNTIME_DATABASE_URL or "
                "AIEOS360_I05_E2E_DB_REPORT required"
            )
        runtime_url = db_report["runtime_database_url"]
    if not bootstrap_url:
        if db_report and db_report.get("bootstrap_database_url"):
            bootstrap_url = db_report["bootstrap_database_url"]
        else:
            raise SystemExit(
                "AIEOS360_I05_E2E_BOOTSTRAP_DATABASE_URL or "
                "bootstrap_database_url in AIEOS360_I05_E2E_DB_REPORT required"
            )

    fixture_path = Path(
        os.environ.get(
            "AIEOS360_I05_E2E_FIXTURE_PATH",
            Path(__file__).resolve().parents[2]
            / "tmp"
            / "aieos360-i05-e2e-fixture.json",
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

    gateway = FakeStructuredModelGateway(
        result_factory=lambda _request: deterministic_i05_worksheet_model(),
        provider_id="fake",
        model_id="fake-model",
    )
    app = build_development_teacher_os_app(
        runtime_engine,
        tenant_id=tenant_id,
        principal_id=teacher_id,
        model_gateway=gateway,
        ai_provider_id="fake",
        ai_model_id="fake-model",
    )

    scenario_date = date.fromisoformat(
        os.environ.get("AIEOS360_I05_E2E_SCENARIO_DATE", "2026-09-08")
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
                    "topic": "Deterministic I05 evidence",
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

    with runtime_engine.connect() as conn:
        row = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        if row != EXPECTED_MIGRATION_HEAD:
            raise RuntimeError(f"unexpected migration head {row}")

    fixture = {
        "scenario_id": SCENARIO_ID,
        "scenario_marker": SCENARIO_MARKER,
        "backend_pin_sha": BACKEND_PIN_SHA,
        "migration_head": EXPECTED_MIGRATION_HEAD,
        "openapi_authority_sha": OPENAPI_AUTHORITY_SHA,
        "tenant_id": str(tenant_id),
        "teacher_principal_id": str(teacher_id),
        "student_principal_id": str(student_id),
        "teacher_bearer_token": "aieos360-i05-e2e-teacher",
        "student_bearer_token": DEVELOPMENT_STUDENT_A_TOKEN,
        "class_ref": CLASS_REF_5A,
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
