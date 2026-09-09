"""Read-only persistence assertions for AIEOS360-S01-I05-E2E.

Invoked from Playwright after durable mutations. Uses governed UoW / SQL only.
NON_PRODUCTION. Never mutates product state.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    return Path(root).resolve()


def _runtime_url() -> str:
    url = os.environ.get("AIEOS360_I05_E2E_RUNTIME_DATABASE_URL")
    if url:
        return url
    report_path = Path(
        os.environ.get(
            "AIEOS360_I05_E2E_DB_REPORT",
            Path(__file__).resolve().parents[2] / "tmp" / "aieos360-i05-e2e-db.json",
        )
    )
    if not report_path.is_file():
        raise SystemExit("AIEOS360_I05_E2E_RUNTIME_DATABASE_URL or DB report required")
    return json.loads(report_path.read_text(encoding="utf-8"))["runtime_database_url"]


def _bootstrap_url() -> str:
    url = os.environ.get("AIEOS360_I05_E2E_BOOTSTRAP_DATABASE_URL")
    if url:
        return url
    report_path = Path(
        os.environ.get(
            "AIEOS360_I05_E2E_DB_REPORT",
            Path(__file__).resolve().parents[2] / "tmp" / "aieos360-i05-e2e-db.json",
        )
    )
    if not report_path.is_file():
        raise SystemExit(
            "AIEOS360_I05_E2E_BOOTSTRAP_DATABASE_URL or DB report required"
        )
    return json.loads(report_path.read_text(encoding="utf-8"))[
        "bootstrap_database_url"
    ]


def _enum_value(value: object) -> str:
    return getattr(value, "value", str(value))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        required=True,
        choices=(
            "count-evaluations",
            "assert-evaluation",
            "assert-classroom-assessment-absent",
            "assert-classroom-assessment",
            "assert-remediation-origin",
            "assert-no-downstream",
        ),
    )
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--assignment-id")
    parser.add_argument("--submission-id")
    parser.add_argument("--attempt-id")
    parser.add_argument("--learner-principal-id")
    parser.add_argument("--content-id")
    parser.add_argument("--content-version-id")
    parser.add_argument("--assessment-id")
    parser.add_argument("--work-id")
    parser.add_argument("--class-ref")
    parser.add_argument("--class-result-level")
    parser.add_argument("--teacher-principal-id")
    parser.add_argument("--aggregate-revision", type=int)
    parser.add_argument("--expected-count", type=int)
    args = parser.parse_args()

    backend = _backend_root()
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))

    from sqlalchemy import create_engine, text

    from aieos.domains.assessment.domain.evaluation_policy_v1 import (
        DETERMINISTIC_LEARNER_ASSESSMENT_POLICY_ID,
        DETERMINISTIC_LEARNER_ASSESSMENT_POLICY_VERSION,
    )
    from aieos.domains.assessment.domain.identities import AssessmentId
    from aieos.domains.assessment.infrastructure.persistence.uow import (
        SqlAlchemyAssessmentUnitOfWorkFactory,
    )
    from aieos.domains.teaching.domain.identities import WorkId
    from aieos.domains.teaching.infrastructure.persistence.uow import (
        SqlAlchemyTeachingUnitOfWorkFactory,
    )
    from tests.dbutil import set_tenant

    tenant_id = uuid.UUID(args.tenant_id)
    runtime_engine = create_engine(_runtime_url())
    bootstrap_engine = create_engine(_bootstrap_url())

    if args.mode == "count-evaluations":
        with bootstrap_engine.begin() as conn:
            set_tenant(conn, tenant_id)
            if args.assignment_id:
                count = int(
                    conn.execute(
                        text(
                            """
                            SELECT COUNT(*)
                            FROM assessment.learner_assessment_evaluations
                            WHERE tenant_id = :tid
                              AND teaching_assignment_id = :aid
                            """
                        ),
                        {
                            "tid": tenant_id,
                            "aid": uuid.UUID(args.assignment_id),
                        },
                    ).scalar_one()
                )
            else:
                count = int(
                    conn.execute(
                        text(
                            """
                            SELECT COUNT(*)
                            FROM assessment.learner_assessment_evaluations
                            WHERE tenant_id = :tid
                            """
                        ),
                        {"tid": tenant_id},
                    ).scalar_one()
                )
        result = {"evaluation_count": count}
        if args.expected_count is not None and count != args.expected_count:
            raise SystemExit(
                f"expected evaluation_count={args.expected_count}; got {count}"
            )
        print(json.dumps(result))
        return 0

    if args.mode == "assert-evaluation":
        if not args.assignment_id or not args.submission_id:
            raise SystemExit("assignment-id and submission-id required")
        factory = SqlAlchemyAssessmentUnitOfWorkFactory(runtime_engine)
        with factory(tenant_id) as uow:
            evaluations = (
                uow.learner_assessment_evaluations.list_for_teaching_assignment(
                    uuid.UUID(args.assignment_id)
                )
            )
            if len(evaluations) != 1:
                raise SystemExit(f"expected 1 evaluation; got {len(evaluations)}")
            evaluation = evaluations[0]
            if str(evaluation.submission_id) != args.submission_id:
                raise SystemExit("evaluation submission_id mismatch")
            if args.attempt_id and str(evaluation.attempt_id) != args.attempt_id:
                raise SystemExit("evaluation attempt_id mismatch")
            if (
                args.learner_principal_id
                and str(evaluation.learner_principal_id) != args.learner_principal_id
            ):
                raise SystemExit("evaluation learner_principal_id mismatch")
            if args.content_id and str(evaluation.content_id) != args.content_id:
                raise SystemExit("evaluation content_id mismatch")
            if (
                args.content_version_id
                and str(evaluation.content_version_id) != args.content_version_id
            ):
                raise SystemExit("evaluation content_version_id mismatch")
            if (
                evaluation.evaluation_policy_id
                != DETERMINISTIC_LEARNER_ASSESSMENT_POLICY_ID
            ):
                raise SystemExit("evaluation_policy_id mismatch")
            if (
                evaluation.evaluation_policy_version
                != DETERMINISTIC_LEARNER_ASSESSMENT_POLICY_VERSION
            ):
                raise SystemExit("evaluation_policy_version mismatch")
            item_outcomes = {
                item.question_id: _enum_value(item.outcome) for item in evaluation.items
            }
            objective_results = {
                row.objective_id: _enum_value(row.result)
                for row in evaluation.objective_evidence
            }
            print(
                json.dumps(
                    {
                        "evaluation_id": str(evaluation.evaluation_id.value),
                        "evaluation_policy_id": evaluation.evaluation_policy_id,
                        "evaluation_policy_version": (
                            evaluation.evaluation_policy_version
                        ),
                        "item_outcomes": item_outcomes,
                        "objective_results": objective_results,
                    }
                )
            )
        return 0

    if args.mode == "assert-classroom-assessment-absent":
        if not args.assignment_id:
            raise SystemExit("assignment-id required")
        with bootstrap_engine.begin() as conn:
            set_tenant(conn, tenant_id)
            count = int(
                conn.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM assessment.classroom_assessments
                        WHERE tenant_id = :tid AND assignment_id = :aid
                        """
                    ),
                    {"tid": tenant_id, "aid": uuid.UUID(args.assignment_id)},
                ).scalar_one()
            )
        if count != 0:
            raise SystemExit(f"expected 0 ClassroomAssessment rows; got {count}")
        print(json.dumps({"classroom_assessment_count": 0}))
        return 0

    if args.mode == "assert-classroom-assessment":
        if not args.assessment_id:
            raise SystemExit("assessment-id required")
        factory = SqlAlchemyAssessmentUnitOfWorkFactory(runtime_engine)
        with factory(tenant_id) as uow:
            loaded = uow.classroom_assessments.get(
                AssessmentId(uuid.UUID(args.assessment_id))
            )
            if loaded is None:
                raise SystemExit("ClassroomAssessment not found")
            state = _enum_value(loaded.lifecycle_state)
            if state != "RECORDED":
                raise SystemExit(f"expected RECORDED; got {state}")
            print(
                json.dumps(
                    {
                        "assessment_id": str(loaded.assessment_id.value),
                        "lifecycle_state": state,
                        "aggregate_revision": loaded.aggregate_revision.value,
                        "class_ref": loaded.class_ref,
                        "class_result_level": _enum_value(loaded.class_result_level),
                        "assignment_id": (
                            str(loaded.assignment_id) if loaded.assignment_id else None
                        ),
                        "execution_id": (
                            str(loaded.execution_id) if loaded.execution_id else None
                        ),
                        "work_id": str(loaded.work_id) if loaded.work_id else None,
                        "content_id": str(loaded.content_id),
                        "content_version_id": str(loaded.content_version_id),
                    }
                )
            )
        return 0

    if args.mode == "assert-remediation-origin":
        if not args.work_id or not args.assessment_id:
            raise SystemExit("work-id and assessment-id required")
        factory = SqlAlchemyTeachingUnitOfWorkFactory(runtime_engine)
        with factory(tenant_id) as uow:
            origin = uow.remediation_origins.get(WorkId(uuid.UUID(args.work_id)))
            if origin is None:
                raise SystemExit("TeachingWorkRemediationOrigin missing")
            if str(origin.source_assessment_id) != args.assessment_id:
                raise SystemExit(
                    "source_assessment_id must be ClassroomAssessment id, "
                    f"got {origin.source_assessment_id}"
                )
            if (
                args.aggregate_revision is not None
                and origin.source_assessment_aggregate_revision
                != args.aggregate_revision
            ):
                raise SystemExit("source_assessment_aggregate_revision mismatch")
            if (
                args.class_result_level
                and _enum_value(origin.source_class_result_level_snapshot)
                != args.class_result_level
            ):
                raise SystemExit("source_class_result_level_snapshot mismatch")
            if args.class_ref and origin.source_class_ref != args.class_ref:
                raise SystemExit("source_class_ref mismatch")
            if args.content_id and str(origin.source_content_id) != args.content_id:
                raise SystemExit("source_content_id mismatch")
            if (
                args.content_version_id
                and str(origin.source_content_version_id) != args.content_version_id
            ):
                raise SystemExit("source_content_version_id mismatch")
            if args.assignment_id and (
                origin.source_assignment_id is None
                or str(origin.source_assignment_id.value) != args.assignment_id
            ):
                raise SystemExit("source_assignment_id mismatch")
            if origin.source_execution_id is not None:
                raise SystemExit(
                    "source_execution_id must be null for assignment-origin journey"
                )
            if (
                args.teacher_principal_id
                and str(origin.initiating_teacher_principal_id)
                != args.teacher_principal_id
            ):
                raise SystemExit("initiating_teacher_principal_id mismatch")
            print(
                json.dumps(
                    {
                        "work_id": str(origin.work_id.value),
                        "source_assessment_id": str(origin.source_assessment_id),
                        "source_assessment_aggregate_revision": (
                            origin.source_assessment_aggregate_revision
                        ),
                        "source_class_result_level_snapshot": _enum_value(
                            origin.source_class_result_level_snapshot
                        ),
                        "source_class_ref": origin.source_class_ref,
                        "source_content_id": str(origin.source_content_id),
                        "source_content_version_id": str(
                            origin.source_content_version_id
                        ),
                        "source_assignment_id": (
                            str(origin.source_assignment_id.value)
                            if origin.source_assignment_id
                            else None
                        ),
                        "source_execution_id": None,
                        "initiating_teacher_principal_id": str(
                            origin.initiating_teacher_principal_id
                        ),
                    }
                )
            )
        return 0

    if args.mode == "assert-no-downstream":
        if not args.work_id:
            raise SystemExit("work-id required")
        with bootstrap_engine.begin() as conn:
            set_tenant(conn, tenant_id)
            execution_count = int(
                conn.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM teaching.executions
                        WHERE tenant_id = :tid AND work_id = :wid
                        """
                    ),
                    {"tid": tenant_id, "wid": uuid.UUID(args.work_id)},
                ).scalar_one()
            )
            assignment_from_remediation = int(
                conn.execute(
                    text(
                        """
                        SELECT COUNT(*)
                        FROM teaching.assignments
                        WHERE tenant_id = :tid AND source_work_id = :wid
                        """
                    ),
                    {"tid": tenant_id, "wid": uuid.UUID(args.work_id)},
                ).scalar_one()
            )
        if execution_count != 0:
            raise SystemExit(
                f"remediation work must not auto-create executions; got {execution_count}"
            )
        if assignment_from_remediation != 0:
            raise SystemExit(
                "remediation work must not auto-create TeachingAssignment; "
                f"got {assignment_from_remediation}"
            )
        print(
            json.dumps(
                {
                    "execution_count": execution_count,
                    "assignment_from_remediation_count": assignment_from_remediation,
                }
            )
        )
        return 0

    raise SystemExit(f"unsupported mode {args.mode}")


if __name__ == "__main__":
    raise SystemExit(main())
