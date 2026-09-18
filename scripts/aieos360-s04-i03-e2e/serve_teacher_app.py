"""Serve the NON_PRODUCTION Teacher OS API for AIEOS360-S04-I03-E2E.

Uses DevelopmentCoherentSchoolContextProvider canonical defaults only and
contains no harness-local School Context maps or provider overrides.
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
        DevelopmentPrincipalAuthenticator,
        DevelopmentPublicationAuthorizationPermit,
        DevelopmentPublicationGovernancePermit,
        DevelopmentReviewAuthorizationPermit,
        DevelopmentReviewCommentPermit,
        DevelopmentTeachingWorkPermit,
        DevelopmentTenantSecurityResolver,
    )
    from aieos.development.coherent_school_context import (
        SYNTHETIC_PRINCIPAL_ID,
        SYNTHETIC_TENANT_ID,
        DevelopmentCoherentSchoolContextProvider,
    )
    from aieos.development.schemas import (
        build_development_schema_registry,
        development_content_type_names,
    )
    from aieos.domains.assessment.infrastructure.persistence.uow import (
        SqlAlchemyAssessmentUnitOfWorkFactory,
    )
    from aieos.domains.content.application.catalog import StaticContentTypeCatalog
    from aieos.domains.content.infrastructure.persistence.uow import (
        SqlAlchemyContentUnitOfWorkFactory,
    )
    from aieos.domains.teaching.application.assistant_answer_v1 import (
        TeacherAssistantAnswerV1,
    )
    from aieos.domains.teaching.infrastructure.persistence.uow import (
        SqlAlchemyTeachingUnitOfWorkFactory,
    )
    from aieos.platform.ai.fake import FakeStructuredModelGateway
    from aieos.platform.ai.infrastructure.persistence.uow import (
        SqlAlchemyAIUnitOfWorkFactory,
    )
    from aieos.platform.api.app import create_app
    from aieos.platform.runtime.remediation_assessment_source import (
        SqlAlchemyRemediationAssessmentSource,
    )
    from aieos.platform.runtime.student_learning_command import (
        SqlAlchemyStudentLearningCommandUnitOfWorkFactory,
    )
    from tests.domains.teaching.worksheet_fixtures import valid_worksheet_model

    runtime_url = os.environ.get("AIEOS360_S04_I03_E2E_RUNTIME_DATABASE_URL")
    if not runtime_url:
        raise SystemExit("AIEOS360_S04_I03_E2E_RUNTIME_DATABASE_URL is required")

    port = int(os.environ.get("AIEOS360_S04_I03_E2E_TEACHER_BACKEND_PORT", "8010"))
    host = os.environ.get(
        "AIEOS360_S04_I03_E2E_TEACHER_BACKEND_HOST", "127.0.0.1"
    )

    def result_factory(request):
        if request.output_type is TeacherAssistantAnswerV1:
            return TeacherAssistantAnswerV1.development_fake(request.input_text)
        return valid_worksheet_model()

    engine = create_engine(runtime_url)
    gateway = FakeStructuredModelGateway(
        result_factory=result_factory,
        provider_id="fake",
        model_id="fake-model",
    )
    school_context = DevelopmentCoherentSchoolContextProvider()

    # Deliberately omit learner membership, Principal scope, and Parent ports.
    app = create_app(
        uow_factory=SqlAlchemyContentUnitOfWorkFactory(engine),
        teaching_uow_factory=SqlAlchemyTeachingUnitOfWorkFactory(
            engine,
            remediation_assessment_source_factory=SqlAlchemyRemediationAssessmentSource,
        ),
        assessment_uow_factory=SqlAlchemyAssessmentUnitOfWorkFactory(engine),
        assessment_authorization=DevelopmentClassroomAssessmentPermit(),
        request_identity_authenticator=DevelopmentPrincipalAuthenticator(
            SYNTHETIC_PRINCIPAL_ID
        ),
        security_resolver=DevelopmentTenantSecurityResolver(
            SYNTHETIC_TENANT_ID, SYNTHETIC_PRINCIPAL_ID
        ),
        content_types=StaticContentTypeCatalog(development_content_type_names()),
        cursor_signing_key=b"aieos360-s04-i03-e2e-teacher-cursor",
        schema_registry=build_development_schema_registry(),
        idempotency_retention=timedelta(hours=24),
        review_authorization=DevelopmentReviewAuthorizationPermit(),
        review_comment_policy=DevelopmentReviewCommentPermit(),
        publication_authorization=DevelopmentPublicationAuthorizationPermit(),
        publication_governance=DevelopmentPublicationGovernancePermit(),
        asset_reference_validation=DevelopmentAssetReferencePermit(),
        asset_current_governance=DevelopmentAssetCurrentUsePermit(),
        ai_uow_factory=SqlAlchemyAIUnitOfWorkFactory(engine),
        model_gateway=gateway,
        ai_generation_authorization=DevelopmentAIGenerationPermit(),
        ai_provider_id="fake",
        ai_model_id="fake-model",
        school_context_class_reader=school_context,
        teaching_authorization=DevelopmentTeachingWorkPermit(),
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
    uvicorn.Server(config).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
