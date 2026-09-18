"""Serve the NON_PRODUCTION Parent OS API for AIEOS360-S04-I03-E2E.

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
        PARENT_OS_HUMAN_ADULT_A_ID,
        SYNTHETIC_TENANT_ID,
        DevelopmentCoherentSchoolContextProvider,
    )
    from aieos.development.parent_learner_access import (
        DevelopmentParentIntelligencePermit,
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

    runtime_url = os.environ.get("AIEOS360_S04_I03_E2E_RUNTIME_DATABASE_URL")
    if not runtime_url:
        raise SystemExit("AIEOS360_S04_I03_E2E_RUNTIME_DATABASE_URL is required")

    port = int(os.environ.get("AIEOS360_S04_I03_E2E_PARENT_BACKEND_PORT", "8013"))
    host = os.environ.get(
        "AIEOS360_S04_I03_E2E_PARENT_BACKEND_HOST", "127.0.0.1"
    )

    engine = create_engine(runtime_url)
    classification = CurrentPrincipalClassificationAuthority(engine)
    authorization = DevelopmentParentIntelligencePermit()
    school_context = DevelopmentCoherentSchoolContextProvider()
    integrity = SecurityAuthorityLearnerPrincipalIntegrity(engine)
    parent_learner_access_service = CurrentParentLearnerAccessService(
        classification=classification,
        authorization=authorization,
        reader=school_context,
        integrity=integrity,
    )

    # Intentionally omit school_context_class_reader and learner_membership_reader.
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
        cursor_signing_key=b"aieos360-s04-i03-e2e-parent-cursor",
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
        school_context_parent_learner_access_reader=school_context,
        parent_learner_integrity_authority=integrity,
        parent_learner_access_service=parent_learner_access_service,
        parent_intelligence_facts_reader=SqlAlchemyParentIntelligenceFactsReader(
            engine,
            membership_reader=school_context,
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
