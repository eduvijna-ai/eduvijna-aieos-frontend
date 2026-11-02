"""Serve the NON_PRODUCTION Teacher OS API for AIEOS360-CX01-I01-E2E.

Uses DevelopmentCoherentSchoolContextProvider canonical defaults only and
contains no harness-local School Context maps or provider overrides.

I06: DETERMINISTIC (default) keeps the governed Fake gateway. REAL_AI composes
the existing Backend Model Gateway from operator-provided provider env.
"""

from __future__ import annotations

import os
import sys
from datetime import timedelta
from pathlib import Path

SHOWCASE_MODE_DETERMINISTIC = "DETERMINISTIC"
SHOWCASE_MODE_REAL_AI = "REAL_AI"


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    return Path(root).resolve()


def _resolve_showcase_mode() -> str:
    raw = os.environ.get("AIEOS360_CX01_I06_SHOWCASE_MODE", SHOWCASE_MODE_DETERMINISTIC)
    mode = str(raw).strip().upper() or SHOWCASE_MODE_DETERMINISTIC
    if mode not in (SHOWCASE_MODE_DETERMINISTIC, SHOWCASE_MODE_REAL_AI):
        raise SystemExit(
            f"invalid AIEOS360_CX01_I06_SHOWCASE_MODE={raw!r}; "
            f"expected {SHOWCASE_MODE_DETERMINISTIC} or {SHOWCASE_MODE_REAL_AI}"
        )
    return mode


def _deterministic_fake_result_factory(request):
    from aieos.domains.education.preparation_kit_v1 import PreparationKitV1
    from aieos.domains.education.worksheet_v1 import WorksheetV1
    from aieos.domains.teaching.application.assistant_answer_v1 import (
        TeacherAssistantAnswerV1,
    )
    from aieos.platform.ai.gateway import ModelGenerationFailed
    from tests.domains.teaching.helpers_dev04_i06 import pass_preparation_kit
    from tests.domains.teaching.worksheet_fixtures import valid_worksheet_model

    output_type = request.output_type
    if output_type is TeacherAssistantAnswerV1:
        return TeacherAssistantAnswerV1.development_fake(request.input_text)
    if output_type is PreparationKitV1:
        return pass_preparation_kit()
    if output_type is WorksheetV1:
        return valid_worksheet_model()
    raise ModelGenerationFailed(
        f"showcase fake gateway has no fixture for {getattr(output_type, '__name__', output_type)}"
    )


def _compose_model_gateway(showcase_mode: str):
    from aieos.platform.ai.composition import compose_configured_model_provider
    from aieos.platform.ai.fake import FakeStructuredModelGateway

    if showcase_mode == SHOWCASE_MODE_REAL_AI:
        configured = compose_configured_model_provider(environ=os.environ)
        if configured.provider_id == "fake":
            raise SystemExit(
                "REAL_AI showcase mode cannot compose Development Fake gateway"
            )
        return (
            configured.gateway,
            configured.provider_id,
            configured.model_id,
            configured.projection,
        )

    gateway = FakeStructuredModelGateway(
        result_factory=_deterministic_fake_result_factory,
        provider_id="fake",
        model_id="fake-model",
    )
    return gateway, "fake", "fake-model", None


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
    from aieos.domains.teaching.infrastructure.persistence.uow import (
        SqlAlchemyTeachingUnitOfWorkFactory,
    )
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

    showcase_mode = _resolve_showcase_mode()
    runtime_url = os.environ.get("AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL")
    if not runtime_url:
        raise SystemExit("AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL is required")

    port = int(os.environ.get("AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT", "8020"))
    host = os.environ.get(
        "AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_HOST", "127.0.0.1"
    )

    gateway, ai_provider_id, ai_model_id, provider_runtime = _compose_model_gateway(
        showcase_mode
    )

    engine = create_engine(runtime_url)
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
        cursor_signing_key=b"aieos360-cx01-i01-showcase-teacher-cursor",
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
        ai_provider_id=ai_provider_id,
        ai_model_id=ai_model_id,
        provider_runtime=provider_runtime,
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
