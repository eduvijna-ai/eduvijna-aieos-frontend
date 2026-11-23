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

SCENARIO_MARKER = "[PK-V1-HINT-E2E] REAL-STACK LEARNER-HINT VERTICAL"
SCENARIO_ID = "pk-v1-hint-e2e-learner-hint-vertical"
BACKEND_PIN_SHA = "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa"
EXPECTED_MIGRATION_HEAD = "a360s010005"
OPENAPI_AUTHORITY_SHA = (
    "0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22"
)
AUTHOR_BEARER = "pk-v1-hint-e2e-author"
REVIEWER_BEARER = "pk-v1-hint-e2e-reviewer"
PUBLISHER_BEARER = "pk-v1-hint-e2e-publisher"


def _http_failure(label: str, status_code: int) -> RuntimeError:
    return RuntimeError(f"{label} failed with HTTP status {status_code}")


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
        SCENARIO_NAMESPACE,
        SYNTHETIC_TENANT_ID,
    )
    from aieos.platform.ai.fake import FakeStructuredModelGateway
    from aieos.platform.security.authorization.decisions import PrincipalKind
    import uuid

    from deterministic_worksheet import (
        OBJ_DEMONSTRATED_ID,
        OBJ_INSUFFICIENT_ID,
        OBJ_NOT_YET_ID,
        Q_CORRECT_ID,
        Q_INCORRECT_ID,
        Q_OPEN_ID,
        Q_UNANSWERED_ID,
        WORKSHEET_TITLE,
        deterministic_hint_e2e_worksheet_model,
    )
    from tests.platform.security.authorization.helpers import seed_principal

    runtime_url = os.environ.get("PK_V1_HINT_E2E_RUNTIME_DATABASE_URL")
    bootstrap_url = os.environ.get("PK_V1_HINT_E2E_BOOTSTRAP_DATABASE_URL")
    db_report_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_DB_REPORT",
            Path(__file__).resolve().parents[2] / "tmp" / "pk-v1-hint-e2e-db.json",
        )
    )
    db_report: dict | None = None
    if db_report_path.is_file():
        db_report = json.loads(db_report_path.read_text(encoding="utf-8"))
    if not runtime_url:
        if not db_report:
            raise SystemExit(
                "PK_V1_HINT_E2E_RUNTIME_DATABASE_URL or "
                "PK_V1_HINT_E2E_DB_REPORT required"
            )
        runtime_url = db_report["runtime_database_url"]
    if not bootstrap_url:
        if db_report and db_report.get("bootstrap_database_url"):
            bootstrap_url = db_report["bootstrap_database_url"]
        else:
            raise SystemExit(
                "PK_V1_HINT_E2E_BOOTSTRAP_DATABASE_URL or "
                "bootstrap_database_url in PK_V1_HINT_E2E_DB_REPORT required"
            )

    fixture_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_FIXTURE_PATH",
            Path(__file__).resolve().parents[2]
            / "tmp"
            / "pk-v1-hint-e2e-fixture.json",
        )
    )

    if db_report and db_report.get("migration_head") != EXPECTED_MIGRATION_HEAD:
        raise SystemExit(
            f"Expected migration head {EXPECTED_MIGRATION_HEAD}; "
            f"got {db_report.get('migration_head')}"
        )

    tenant_id = SYNTHETIC_TENANT_ID
    author_id = uuid.uuid5(SCENARIO_NAMESPACE, "pk-v1-hint-e2e-author-principal")
    reviewer_id = uuid.uuid5(SCENARIO_NAMESPACE, "pk-v1-hint-e2e-reviewer-principal")
    publisher_id = uuid.uuid5(SCENARIO_NAMESPACE, "pk-v1-hint-e2e-publisher-principal")
    student_id = STUDENT_A_PRINCIPAL_ID

    bootstrap_engine = create_engine(bootstrap_url)
    runtime_engine = create_engine(runtime_url)

    ensure_synthetic_student_principals(bootstrap_engine)
    for principal_id in (author_id, reviewer_id, publisher_id):
        seed_principal(
            bootstrap_engine, principal_id, principal_kind=PrincipalKind.HUMAN
        )

    gateway = FakeStructuredModelGateway(
        result_factory=lambda _request: deterministic_hint_e2e_worksheet_model(),
        provider_id="fake",
        model_id="fake-model",
    )
    app = build_development_teacher_os_app(
        runtime_engine,
        tenant_id=tenant_id,
        principal_id=author_id,
        model_gateway=gateway,
        ai_provider_id="fake",
        ai_model_id="fake-model",
    )

    scenario_date = date.fromisoformat(
        os.environ.get("PK_V1_HINT_E2E_SCENARIO_DATE", "2026-09-08")
    )
    target_date = scenario_date + timedelta(days=1)

    with TestClient(app, raise_server_exceptions=False) as client:
        works = client.get(
            "/api/v1/teaching/works",
            params={"limit": 100},
            headers=_headers(str(tenant_id)),
        )
        if works.status_code != 200:
            raise _http_failure("works list", works.status_code)

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
                raise _http_failure("work create", created.status_code)
            work_id = created.json()["work_id"]
            work_etag = created.headers["ETag"]

        artifacts = client.get(
            f"/api/v1/teaching/works/{work_id}/artifacts",
            headers=_headers(str(tenant_id)),
        )
        if artifacts.status_code != 200:
            raise _http_failure("artifacts list", artifacts.status_code)
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
                raise _http_failure("generate", generated.status_code)
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
            raise _http_failure("content get", content_get.status_code)
        content = content_get.json()
        published_version_id_before = content.get("published_version_id")

        if content.get("stewardship_state") == "IN_REVIEW":
            detail = client.get(
                f"/api/v1/teacher-os/review-queue/{content_id}/versions/{version_id}",
                headers=_headers(str(tenant_id)),
            )
            if detail.status_code != 200:
                raise _http_failure("review detail", detail.status_code)
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
                raise _http_failure("approve", approved.status_code)

        content_after = client.get(
            f"/api/v1/contents/{content_id}",
            headers=_headers(str(tenant_id)),
        )
        if content_after.status_code != 200:
            raise _http_failure("content reload", content_after.status_code)
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
            raise _http_failure("version get", version_get.status_code)
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
        "author_principal_id": str(author_id),
        "reviewer_principal_id": str(reviewer_id),
        "publisher_principal_id": str(publisher_id),
        "student_principal_id": str(student_id),
        "author_bearer_token": AUTHOR_BEARER,
        "reviewer_bearer_token": REVIEWER_BEARER,
        "publisher_bearer_token": PUBLISHER_BEARER,
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
    from export_sanitize import public_seed_summary, write_sanitized_json

    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
    try:
        fixture_path.chmod(0o600)
    except OSError:
        pass
    sanitized_path = fixture_path.parent / "pk-v1-hint-e2e-fixture-sanitized.json"
    write_sanitized_json(str(sanitized_path), fixture)
    try:
        sanitized_path.chmod(0o600)
    except OSError:
        pass
    print(json.dumps(public_seed_summary(fixture)))

    bootstrap_engine.dispose()
    runtime_engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
