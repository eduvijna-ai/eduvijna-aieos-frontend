"""Serve NON_PRODUCTION Teacher OS API for PK-V1-HINT-E2E-I01.

Three opaque bearer aliases map to distinct HUMAN principals (author, reviewer,
publisher) via a harness-local authenticator. Uses DevelopmentCoherentSchoolContextProvider
with extended teacher authority. No harness-local School Context maps beyond fixture IDs.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import timedelta
from pathlib import Path
from uuid import UUID


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    return Path(root).resolve()


def _load_fixture() -> dict:
    fixture_path = os.environ.get("PK_V1_HINT_E2E_FIXTURE_PATH")
    if not fixture_path:
        raise SystemExit("PK_V1_HINT_E2E_FIXTURE_PATH is required")
    return json.loads(Path(fixture_path).read_text(encoding="utf-8"))


class HintE2EThreeHumanAuthenticator:
    """Maps lane-specific bearer aliases to distinct HUMAN PrincipalIds."""

    def __init__(self, token_to_principal: dict[str, UUID]) -> None:
        self._map = dict(token_to_principal)

    def authenticate(self, request):
        from aieos.platform.security.context import UnauthenticatedError
        from aieos.platform.security.identity import TrustedRequestIdentity

        authorization = request.headers.get("Authorization")
        if authorization is None or not authorization.startswith("Bearer "):
            raise UnauthenticatedError("unauthenticated")
        token = authorization[len("Bearer ") :]
        principal = self._map.get(token)
        if principal is None:
            raise UnauthenticatedError("unauthenticated")
        return TrustedRequestIdentity(principal_id=principal)


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
        DevelopmentTeachingWorkPermit,
        DevelopmentTenantSecurityResolver,
    )
    from aieos.development.coherent_school_context import (
        CLASS_REF_5A,
        CLASS_REF_5B,
        DevelopmentCoherentSchoolContextProvider,
    )
    from aieos.development.learner_principals import CLASS_REF_5A as _CLASS_5A
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

    fixture = _load_fixture()
    tenant_id = UUID(fixture["tenant_id"])
    author_id = UUID(fixture["author_principal_id"])
    reviewer_id = UUID(fixture["reviewer_principal_id"])
    publisher_id = UUID(fixture["publisher_principal_id"])

    token_map = {
        fixture["author_bearer_token"]: author_id,
        fixture["reviewer_bearer_token"]: reviewer_id,
        fixture["publisher_bearer_token"]: publisher_id,
    }

    runtime_url = os.environ.get("PK_V1_HINT_E2E_RUNTIME_DATABASE_URL")
    if not runtime_url:
        raise SystemExit("PK_V1_HINT_E2E_RUNTIME_DATABASE_URL is required")

    port = int(os.environ.get("PK_V1_HINT_E2E_TEACHER_BACKEND_PORT", "8028"))
    host = os.environ.get("PK_V1_HINT_E2E_TEACHER_BACKEND_HOST", "127.0.0.1")

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

    school_context = DevelopmentCoherentSchoolContextProvider(
        tenant_id=tenant_id,
        teacher_authority={
            author_id: (_CLASS_5A, CLASS_REF_5B),
            reviewer_id: (_CLASS_5A,),
            publisher_id: (_CLASS_5A,),
        },
    )

    app = create_app(
        uow_factory=SqlAlchemyContentUnitOfWorkFactory(engine),
        teaching_uow_factory=SqlAlchemyTeachingUnitOfWorkFactory(
            engine,
            remediation_assessment_source_factory=SqlAlchemyRemediationAssessmentSource,
        ),
        assessment_uow_factory=SqlAlchemyAssessmentUnitOfWorkFactory(engine),
        assessment_authorization=DevelopmentClassroomAssessmentPermit(),
        request_identity_authenticator=HintE2EThreeHumanAuthenticator(token_map),
        security_resolver=DevelopmentTenantSecurityResolver(tenant_id, author_id),
        content_types=StaticContentTypeCatalog(development_content_type_names()),
        cursor_signing_key=b"pk-v1-hint-e2e-teacher-cursor",
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