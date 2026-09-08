"""Serve NON_PRODUCTION Student OS API for AIEOS360-S01-I04R1 product E2E.

Wires DevelopmentStudentPrincipalAuthenticator and a file-gated membership
reader so the Playwright scenario can deny current membership after SUBMIT
without changing backend source. Must never be used as production entrypoint.
"""

from __future__ import annotations

import os
import sys
from datetime import timedelta
from pathlib import Path


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    return Path(root).resolve()


class FileGatedLearnerMembershipReader:
    """Wraps the development membership reader with a disposable gate file.

    Gate contents:
      allowed → forward to inner reader
      denied  → empty memberships (current-access deny; historical submitted
                reads remain owner-based on the frozen I03 contract)
    """

    def __init__(self, inner, gate_path: Path) -> None:
        self._inner = inner
        self._gate_path = gate_path

    def list_current_memberships(self, tenant_id, learner_principal_id):
        if self._gate_path.is_file():
            state = self._gate_path.read_text(encoding="utf-8").strip().lower()
            if state == "denied":
                return ()
        return self._inner.list_current_memberships(tenant_id, learner_principal_id)


def main() -> int:
    backend = _backend_root()
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))

    import uvicorn
    from sqlalchemy import create_engine

    from aieos.development.auth_adapters import (
        DevelopmentAIGenerationPermit,
        DevelopmentAssetCurrentUsePermit,
        DevelopmentAssetReferencePermit,
        DevelopmentClassroomAssessmentPermit,
        DevelopmentPublicationAuthorizationPermit,
        DevelopmentPublicationGovernancePermit,
        DevelopmentReviewAuthorizationPermit,
        DevelopmentReviewCommentPermit,
        DevelopmentStudentPrincipalAuthenticator,
        DevelopmentTeachingWorkPermit,
        DevelopmentTenantSecurityResolver,
    )
    from aieos.development.learner_principals import (
        STUDENT_A_PRINCIPAL_ID,
        SYNTHETIC_TENANT_ID,
    )
    from aieos.development.learner_school_context import (
        development_learner_membership_reader,
    )
    from aieos.development.schemas import (
        build_development_schema_registry,
        development_content_type_names,
    )
    from aieos.development.school_context import DevelopmentSchoolContextClassReader
    from aieos.domains.assessment.infrastructure.persistence.uow import (
        SqlAlchemyAssessmentUnitOfWorkFactory,
    )
    from aieos.domains.content.application.catalog import StaticContentTypeCatalog
    from aieos.domains.content.infrastructure.persistence.uow import (
        SqlAlchemyContentUnitOfWorkFactory,
    )
    from aieos.domains.teaching.infrastructure.persistence.uow import (
        SqlAlchemyTeachingUnitOfWorkFactory,
    )
    from aieos.platform.ai.fake import FakeStructuredModelGateway
    from aieos.platform.ai.infrastructure.persistence.uow import (
        SqlAlchemyAIUnitOfWorkFactory,
    )
    from aieos.platform.api.app import create_app
    from aieos.platform.runtime.student_learning_command import (
        SqlAlchemyStudentLearningCommandUnitOfWorkFactory,
    )

    runtime_url = os.environ.get("STUDENT_PRODUCT_E2E_RUNTIME_DATABASE_URL")
    if not runtime_url:
        raise SystemExit("STUDENT_PRODUCT_E2E_RUNTIME_DATABASE_URL is required")

    gate_path = Path(
        os.environ.get(
            "STUDENT_PRODUCT_E2E_MEMBERSHIP_GATE",
            Path(__file__).resolve().parents[2]
            / "tmp"
            / "student-product-e2e-membership-gate.txt",
        )
    )
    port = int(os.environ.get("STUDENT_PRODUCT_E2E_BACKEND_PORT", "8001"))
    host = os.environ.get("STUDENT_PRODUCT_E2E_BACKEND_HOST", "127.0.0.1")

    engine = create_engine(runtime_url)
    membership = FileGatedLearnerMembershipReader(
        development_learner_membership_reader(tenant_id=SYNTHETIC_TENANT_ID),
        gate_path,
    )

    app = create_app(
        uow_factory=SqlAlchemyContentUnitOfWorkFactory(engine),
        teaching_uow_factory=SqlAlchemyTeachingUnitOfWorkFactory(engine),
        assessment_uow_factory=SqlAlchemyAssessmentUnitOfWorkFactory(engine),
        assessment_authorization=DevelopmentClassroomAssessmentPermit(),
        request_identity_authenticator=DevelopmentStudentPrincipalAuthenticator(),
        security_resolver=DevelopmentTenantSecurityResolver(
            SYNTHETIC_TENANT_ID, STUDENT_A_PRINCIPAL_ID
        ),
        content_types=StaticContentTypeCatalog(development_content_type_names()),
        cursor_signing_key=b"aieos360-s01-i04r1-student-product-e2e-cursor",
        schema_registry=build_development_schema_registry(),
        idempotency_retention=timedelta(hours=24),
        review_authorization=DevelopmentReviewAuthorizationPermit(),
        review_comment_policy=DevelopmentReviewCommentPermit(),
        publication_authorization=DevelopmentPublicationAuthorizationPermit(),
        publication_governance=DevelopmentPublicationGovernancePermit(),
        asset_reference_validation=DevelopmentAssetReferencePermit(),
        asset_current_governance=DevelopmentAssetCurrentUsePermit(),
        ai_uow_factory=SqlAlchemyAIUnitOfWorkFactory(engine),
        model_gateway=FakeStructuredModelGateway(),
        ai_generation_authorization=DevelopmentAIGenerationPermit(),
        ai_provider_id="fake",
        ai_model_id="fake-model",
        school_context_class_reader=DevelopmentSchoolContextClassReader(
            tenant_id=SYNTHETIC_TENANT_ID,
            teacher_principal_id=STUDENT_A_PRINCIPAL_ID,
        ),
        teaching_authorization=DevelopmentTeachingWorkPermit(),
        learner_membership_reader=membership,
        student_learning_uow_factory=SqlAlchemyStudentLearningCommandUnitOfWorkFactory(
            engine
        ),
    )

    config = uvicorn.Config(
        app=app,
        host=host,
        port=port,
        workers=1,
        loop="asyncio",
        http="h11",
        proxy_headers=False,
        server_header=False,
        reload=False,
        lifespan="on",
    )
    server = uvicorn.Server(config)
    server.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
