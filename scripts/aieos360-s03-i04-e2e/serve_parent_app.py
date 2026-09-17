"""Serve NON_PRODUCTION Parent OS API for AIEOS360-S03-I04-E2E.

Dedicated Parent FastAPI surface against the shared disposable PostgreSQL
runtime. Composes server-side Parent Intelligence only.

Does NOT compose:
  - school_context_class_reader (Teacher assignability)
  - learner_membership_reader (Student OS membership port on create_app)
  - Teacher assignment/ensure mutation authority for Parent convenience

Canonical Backend Parent development default access mapping is not used.
I04 composes DevelopmentSchoolContextParentLearnerAccessReader with a
harness-local mapping:

  PARENT_OS_HUMAN_ADULT_A_ID → (STUDENT_A_PRINCIPAL_ID,)

This is NON_PRODUCTION test/harness-only server-side authority. It is not
browser data, query input, request body, localStorage, frontend state,
production School Context, or ERP/SIS truth. Student B is intentionally
omitted so concealment can be proven against a valid HUMAN learner.
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
    from aieos.development.learner_principals import STUDENT_A_PRINCIPAL_ID
    from aieos.development.learner_school_context import (
        DevelopmentSchoolContextLearnerMembershipReader,
    )
    from aieos.development.parent_learner_access import (
        PARENT_OS_HUMAN_ADULT_A_ID,
        SYNTHETIC_TENANT_ID,
        DevelopmentParentIntelligencePermit,
        DevelopmentSchoolContextParentLearnerAccessReader,
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
    from aieos.domains.parent_intelligence.application.learner_access import (
        CurrentParentLearnerAccessService,
    )
    from aieos.domains.parent_intelligence.infrastructure.read_projection import (
        SqlAlchemyParentIntelligenceFactsReader,
    )
    from aieos.domains.teaching.infrastructure.persistence.uow import (
        SqlAlchemyTeachingUnitOfWorkFactory,
    )
    from aieos.platform.ai.fake import FakeStructuredModelGateway
    from aieos.platform.ai.infrastructure.persistence.uow import (
        SqlAlchemyAIUnitOfWorkFactory,
    )
    from aieos.platform.api.app import create_app
    from aieos.platform.security.authorization import (
        CurrentPrincipalClassificationAuthority,
        SecurityAuthorityLearnerPrincipalIntegrity,
    )

    runtime_url = os.environ.get("AIEOS360_S03_I04_E2E_RUNTIME_DATABASE_URL")
    if not runtime_url:
        raise SystemExit("AIEOS360_S03_I04_E2E_RUNTIME_DATABASE_URL is required")

    port = int(os.environ.get("AIEOS360_S03_I04_E2E_PARENT_BACKEND_PORT", "8009"))
    host = os.environ.get("AIEOS360_S03_I04_E2E_PARENT_BACKEND_HOST", "127.0.0.1")

    engine = create_engine(runtime_url)
    classification = CurrentPrincipalClassificationAuthority(engine)
    authorization = DevelopmentParentIntelligencePermit()
    parent_access = DevelopmentSchoolContextParentLearnerAccessReader(
        tenant_id=SYNTHETIC_TENANT_ID,
        access={PARENT_OS_HUMAN_ADULT_A_ID: (STUDENT_A_PRINCIPAL_ID,)},
    )
    integrity = SecurityAuthorityLearnerPrincipalIntegrity(engine)
    parent_learner_access_service = CurrentParentLearnerAccessService(
        classification=classification,
        authorization=authorization,
        reader=parent_access,
        integrity=integrity,
    )
    membership = DevelopmentSchoolContextLearnerMembershipReader(
        tenant_id=SYNTHETIC_TENANT_ID,
    )

    # Intentionally omit school_context_class_reader and learner_membership_reader.
    # Parent Intelligence must not reuse Teacher assignability or Student OS
    # membership as Parent Learner Access authority. Membership is composed
    # only inside the Parent facts reader after access has already been
    # evaluated by CurrentParentLearnerAccessService.
    app = create_app(
        uow_factory=SqlAlchemyContentUnitOfWorkFactory(engine),
        teaching_uow_factory=SqlAlchemyTeachingUnitOfWorkFactory(engine),
        assessment_uow_factory=SqlAlchemyAssessmentUnitOfWorkFactory(engine),
        assessment_authorization=DevelopmentClassroomAssessmentPermit(),
        request_identity_authenticator=DevelopmentPrincipalAuthenticator(
            PARENT_OS_HUMAN_ADULT_A_ID
        ),
        security_resolver=DevelopmentTenantSecurityResolver(
            SYNTHETIC_TENANT_ID, PARENT_OS_HUMAN_ADULT_A_ID
        ),
        content_types=StaticContentTypeCatalog(development_content_type_names()),
        cursor_signing_key=b"aieos360-s03-i04-e2e-parent-cursor",
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
        teaching_authorization=DevelopmentTeachingWorkPermit(),
        principal_classification_authority=classification,
        parent_intelligence_authorization=authorization,
        school_context_parent_learner_access_reader=parent_access,
        parent_learner_integrity_authority=integrity,
        parent_learner_access_service=parent_learner_access_service,
        parent_intelligence_facts_reader=SqlAlchemyParentIntelligenceFactsReader(
            engine,
            membership_reader=membership,
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
