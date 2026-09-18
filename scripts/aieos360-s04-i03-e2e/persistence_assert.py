"""Read-only persistence assertions for aieos360-s04-i03-E2E.

Invoked from Playwright after durable mutations and Parent reads.
Uses governed SQL only. NON_PRODUCTION. Never mutates product state.
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


def _db_report() -> dict:
    report_path = Path(
        os.environ.get(
            "AIEOS360_S04_I03_E2E_DB_REPORT",
            Path(__file__).resolve().parents[2]
            / "tmp"
            / "aieos360-s04-i03-e2e-db.json",
        )
    )
    if not report_path.is_file():
        raise SystemExit("AIEOS360_S04_I03_E2E_DB_REPORT required")
    return json.loads(report_path.read_text(encoding="utf-8"))


def _bootstrap_url() -> str:
    url = os.environ.get("AIEOS360_S04_I03_E2E_BOOTSTRAP_DATABASE_URL")
    if url:
        return url
    return _db_report()["bootstrap_database_url"]


def _runtime_url() -> str:
    url = os.environ.get("AIEOS360_S04_I03_E2E_RUNTIME_DATABASE_URL")
    if url:
        return url
    if os.environ.get("AIEOS_TEST_RUNTIME_DATABASE_URL"):
        return os.environ["AIEOS_TEST_RUNTIME_DATABASE_URL"]
    return _db_report()["runtime_database_url"]


def _enum_value(value: object) -> str:
    return getattr(value, "value", str(value))


def _ids(rows: list) -> list[str]:
    return [str(row[0]) for row in rows]


def _serialize_row(row) -> list[object]:
    out: list[object] = []
    for value in row:
        if value is None or isinstance(value, (str, int, float, bool)):
            out.append(value)
        else:
            out.append(str(value))
    return out


def _read_snapshot(conn, tenant_id: uuid.UUID) -> dict[str, object]:
    from sqlalchemy import text

    alembic_head = conn.execute(
        text("SELECT version_num FROM alembic_version")
    ).scalar_one()
    content_rows = list(
        conn.execute(
            text(
                """
                SELECT content_id, stewardship_state, content_type,
                       published_version_id, current_version_id
                FROM content.contents
                WHERE tenant_id = :tid
                ORDER BY content_id
                """
            ),
            {"tid": tenant_id},
        ).fetchall()
    )
    version_rows = list(
        conn.execute(
            text(
                """
                SELECT version_id, content_id, version_number
                FROM content.content_versions
                WHERE tenant_id = :tid
                ORDER BY content_id, version_number, version_id
                """
            ),
            {"tid": tenant_id},
        ).fetchall()
    )
    assignment_rows = list(
        conn.execute(
            text(
                """
                SELECT assignment_id, lifecycle_state, class_ref,
                       content_id, content_version_id, teacher_principal_id
                FROM teaching.assignments
                WHERE tenant_id = :tid
                ORDER BY assigned_at, assignment_id
                """
            ),
            {"tid": tenant_id},
        ).fetchall()
    )
    attempt_rows = list(
        conn.execute(
            text(
                """
                SELECT attempt_id, teaching_assignment_id, learner_principal_id,
                       lifecycle_state, submission_id, aggregate_revision
                FROM learning.attempts
                WHERE tenant_id = :tid
                ORDER BY started_at, attempt_id
                """
            ),
            {"tid": tenant_id},
        ).fetchall()
    )
    submission_rows = list(
        conn.execute(
            text(
                """
                SELECT submission_id, teaching_assignment_id, learner_principal_id
                FROM learning.submissions
                WHERE tenant_id = :tid
                ORDER BY submitted_at, submission_id
                """
            ),
            {"tid": tenant_id},
        ).fetchall()
    )
    evaluation_rows = list(
        conn.execute(
            text(
                """
                SELECT evaluation_id, submission_id, teaching_assignment_id
                FROM assessment.learner_assessment_evaluations
                WHERE tenant_id = :tid
                ORDER BY evaluated_at, evaluation_id
                """
            ),
            {"tid": tenant_id},
        ).fetchall()
    )
    classroom_rows = list(
        conn.execute(
            text(
                """
                SELECT assessment_id, assignment_id, class_ref, lifecycle_state,
                       aggregate_revision
                FROM assessment.classroom_assessments
                WHERE tenant_id = :tid
                ORDER BY created_at, assessment_id
                """
            ),
            {"tid": tenant_id},
        ).fetchall()
    )
    principal_rows = list(
        conn.execute(
            text(
                """
                SELECT principal_id, status, principal_kind
                FROM security.principals
                ORDER BY principal_id
                """
            )
        ).fetchall()
    )
    forbidden_sor_tables = list(
        conn.execute(
            text(
                """
                SELECT n.nspname, c.relname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind = 'r'
                  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                  AND (
                    n.nspname ILIKE '%parent%'
                    OR c.relname ILIKE '%parent%'
                    OR n.nspname ILIKE '%school_context%'
                    OR c.relname ILIKE '%school_context%'
                    OR n.nspname ILIKE '%principal_intelligence%'
                    OR c.relname ILIKE '%principal_intelligence%'
                    OR n.nspname ILIKE '%parent_intelligence%'
                    OR c.relname ILIKE '%parent_intelligence%'
                    OR n.nspname ILIKE '%roster%'
                    OR c.relname ILIKE '%roster%'
                    OR n.nspname ILIKE '%enrollment%'
                    OR c.relname ILIKE '%enrollment%'
                    OR n.nspname ILIKE '%guardian%'
                    OR c.relname ILIKE '%guardian%'
                    OR n.nspname ILIKE '%family%'
                    OR c.relname ILIKE '%family%'
                  )
                ORDER BY n.nspname, c.relname
                """
            )
        ).fetchall()
    )
    return {
        "alembic_head": str(alembic_head),
        "content_count": len(content_rows),
        "content_ids": _ids(content_rows),
        "content_rows": [_serialize_row(row) for row in content_rows],
        "content_version_count": len(version_rows),
        "content_version_ids": _ids(version_rows),
        "teaching_assignment_count": len(assignment_rows),
        "assignment_ids": _ids(assignment_rows),
        "assignment_lifecycles": [row[1] for row in assignment_rows],
        "assignment_class_refs": [row[2] for row in assignment_rows],
        "assignment_content_ids": [str(row[3]) for row in assignment_rows],
        "assignment_content_version_ids": [str(row[4]) for row in assignment_rows],
        "learner_attempt_count": len(attempt_rows),
        "attempt_ids": _ids(attempt_rows),
        "attempt_lifecycles": [row[3] for row in attempt_rows],
        "attempt_submission_ids": [
            str(row[4]) if row[4] is not None else None for row in attempt_rows
        ],
        "attempt_revisions": [int(row[5]) for row in attempt_rows],
        "learner_submission_count": len(submission_rows),
        "submission_ids": _ids(submission_rows),
        "learner_assessment_evaluation_count": len(evaluation_rows),
        "evaluation_ids": _ids(evaluation_rows),
        "classroom_assessment_count": len(classroom_rows),
        "classroom_assessment_ids": _ids(classroom_rows),
        "principal_count": len(principal_rows),
        "principal_rows": [_serialize_row(row) for row in principal_rows],
        "parent_persistence_tables": [
            f"{row[0]}.{row[1]}"
            for row in forbidden_sor_tables
            if "parent" in f"{row[0]}.{row[1]}".lower()
        ],
        "forbidden_school_context_sor_tables": [
            f"{row[0]}.{row[1]}" for row in forbidden_sor_tables
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        required=True,
        choices=(
            "snapshot-persistence",
            "assert-durable-learning",
            "assert-no-parent-tables",
            "assert-coherent-provider-defaults",
            "count-evaluations",
            "assert-evaluation",
        ),
    )
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--assignment-id")
    parser.add_argument("--attempt-id")
    parser.add_argument("--submission-id")
    parser.add_argument("--learner-principal-id")
    parser.add_argument("--content-id")
    parser.add_argument("--content-version-id")
    parser.add_argument("--expected-count", type=int)
    parser.add_argument("--output")
    args = parser.parse_args()

    backend = _backend_root()
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))

    from sqlalchemy import create_engine, text

    from aieos.domains.assessment.domain.evaluation_policy_v1 import (
        DETERMINISTIC_LEARNER_ASSESSMENT_POLICY_ID,
        DETERMINISTIC_LEARNER_ASSESSMENT_POLICY_VERSION,
    )
    from aieos.domains.assessment.infrastructure.persistence.uow import (
        SqlAlchemyAssessmentUnitOfWorkFactory,
    )
    from tests.dbutil import set_tenant

    tenant_id = uuid.UUID(args.tenant_id)
    bootstrap_engine = create_engine(_bootstrap_url())
    runtime_engine = create_engine(_runtime_url())

    if args.mode == "snapshot-persistence":
        with bootstrap_engine.begin() as conn:
            set_tenant(conn, tenant_id)
            snapshot = _read_snapshot(conn, tenant_id)
        if snapshot["alembic_head"] != "a360s010004":
            raise SystemExit(
                f"expected alembic head a360s010004; got {snapshot['alembic_head']}"
            )
        if snapshot["forbidden_school_context_sor_tables"]:
            raise SystemExit(
                "School Context / Parent / Principal Intelligence / "
                "roster SoR tables must not exist; "
                f"got {snapshot['forbidden_school_context_sor_tables']}"
            )
        if args.output:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(
                json.dumps(snapshot, indent=2) + "\n", encoding="utf-8"
            )
        print(json.dumps(snapshot))
        return 0

    if args.mode == "assert-durable-learning":
        if not args.assignment_id or not args.learner_principal_id:
            raise SystemExit("assignment-id and learner-principal-id required")
        with bootstrap_engine.begin() as conn:
            set_tenant(conn, tenant_id)
            attempts = list(
                conn.execute(
                    text(
                        """
                        SELECT attempt_id, lifecycle_state, submission_id
                        FROM learning.attempts
                        WHERE tenant_id = :tid
                          AND teaching_assignment_id = :aid
                          AND learner_principal_id = :lid
                        ORDER BY started_at, attempt_id
                        """
                    ),
                    {
                        "tid": tenant_id,
                        "aid": uuid.UUID(args.assignment_id),
                        "lid": uuid.UUID(args.learner_principal_id),
                    },
                ).fetchall()
            )
            submissions = list(
                conn.execute(
                    text(
                        """
                        SELECT submission_id, teaching_assignment_id
                        FROM learning.submissions
                        WHERE tenant_id = :tid
                          AND teaching_assignment_id = :aid
                          AND learner_principal_id = :lid
                        ORDER BY submitted_at, submission_id
                        """
                    ),
                    {
                        "tid": tenant_id,
                        "aid": uuid.UUID(args.assignment_id),
                        "lid": uuid.UUID(args.learner_principal_id),
                    },
                ).fetchall()
            )
        if len(attempts) != 1:
            raise SystemExit(f"expected 1 LearnerAttempt; got {len(attempts)}")
        attempt = attempts[0]
        if attempt[1] != "SUBMITTED":
            raise SystemExit(f"expected SUBMITTED attempt; got {attempt[1]}")
        if attempt[2] is None:
            raise SystemExit("expected attempt.submission_id")
        if len(submissions) != 1:
            raise SystemExit(
                f"expected 1 LearnerSubmission; got {len(submissions)}"
            )
        if str(submissions[0][0]) != str(attempt[2]):
            raise SystemExit("attempt.submission_id mismatch")
        if args.attempt_id and str(attempt[0]) != args.attempt_id:
            raise SystemExit("attempt_id mismatch")
        if args.submission_id and str(submissions[0][0]) != args.submission_id:
            raise SystemExit("submission_id mismatch")
        print(
            json.dumps(
                {
                    "attempt_id": str(attempt[0]),
                    "attempt_lifecycle_state": attempt[1],
                    "submission_id": str(submissions[0][0]),
                    "learner_attempt_count": 1,
                    "learner_submission_count": 1,
                }
            )
        )
        return 0

    if args.mode == "assert-no-parent-tables":
        with bootstrap_engine.begin() as conn:
            tables = [
                f"{row[0]}.{row[1]}"
                for row in conn.execute(
                    text(
                        """
                        SELECT n.nspname, c.relname
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE c.relkind = 'r'
                          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                          AND (
                            n.nspname ILIKE '%parent%'
                            OR c.relname ILIKE '%parent%'
                          )
                        ORDER BY n.nspname, c.relname
                        """
                    )
                ).fetchall()
            ]
            head = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
        if tables:
            raise SystemExit(f"Parent persistence tables exist: {tables}")
        if head != "a360s010004":
            raise SystemExit(f"expected alembic head a360s010004; got {head}")
        print(json.dumps({"parent_persistence_tables": [], "alembic_head": head}))
        return 0

    if args.mode == "assert-coherent-provider-defaults":
        provider = (
            backend / "src" / "aieos" / "development" / "coherent_school_context.py"
        ).read_text(encoding="utf-8")
        required = (
            "class DevelopmentCoherentSchoolContextProvider",
            "SYNTHETIC_PRINCIPAL_ID: (CLASS_REF_5A, CLASS_REF_5B)",
            "STUDENT_A_PRINCIPAL_ID:",
            "STUDENT_B_PRINCIPAL_ID:",
            "PRINCIPAL_OS_HUMAN_PRINCIPAL_ID: (CLASS_REF_5A, CLASS_REF_5B)",
            "PARENT_OS_HUMAN_ADULT_A_ID: (STUDENT_A_PRINCIPAL_ID,)",
            "PARENT_OS_HUMAN_ADULT_B_ID: (STUDENT_B_PRINCIPAL_ID,)",
        )
        for token in required:
            if token not in provider:
                raise SystemExit(
                    f"coherent School Context defaults moved; missing {token!r}"
                )
        print(
            json.dumps(
                {
                    "provider": "DevelopmentCoherentSchoolContextProvider",
                    "canonical_defaults": True,
                }
            )
        )
        return 0

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

    raise SystemExit(f"unsupported mode {args.mode}")


if __name__ == "__main__":
    raise SystemExit(main())
