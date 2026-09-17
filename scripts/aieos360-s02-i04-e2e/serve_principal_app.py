"""Serve NON_PRODUCTION Principal OS API for AIEOS360-S02-I04-E2E.

Dedicated Principal FastAPI surface against the shared disposable PostgreSQL
runtime. Composes server-side Principal School Intelligence only.

Does NOT compose:
  - school_context_class_reader (Teacher assignability)
  - learner_membership_reader (Student membership)
  - Teacher assignment/ensure mutation authority for Principal convenience

Canonical Backend Principal development adapter is not imported or used.
I04 uses a harness-local reader for class-5a/class-5b only.
"""

from __future__ import annotations

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


class I04HarnessPrincipalSchoolScopeReader:
    """NON_PRODUCTION test/harness-only server-side Principal School Context.

    I04-only. Not browser data, query input, request body, Principal
    selection, frontend state, ERP/SIS, or production School Context.
    Returns class-5a then class-5b only for the exact synthetic tenant and
    canonical Principal OS HUMAN Principal.
    """

    NON_PRODUCTION = True

    def __init__(self, *, tenant_id: UUID, principal_id: UUID) -> None:
        self._tenant_id = tenant_id
        self._principal_id = principal_id

    def list_current_authorized_classes(
        self,
        tenant_id: UUID,
        principal_id: UUID,
    ):
        from aieos.domains.school_intelligence.application.school_scope import (
            AuthorizedSchoolClassRef,
        )

        if tenant_id != self._tenant_id or principal_id != self._principal_id:
            return ()
        return (
            AuthorizedSchoolClassRef(
                class_ref="class-5a", display_label="Grade 5A"
            ),
            AuthorizedSchoolClassRef(
                class_ref="class-5b", display_label="Grade 5B"
            ),
        )


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
    from aieos.development.principal_school_context import (
        PRINCIPAL_OS_HUMAN_PRINCIPAL_ID,
        SYNTHETIC_TENANT_ID,
        DevelopmentSchoolIntelligencePermit,
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
    from aieos.domains.school_intelligence.infrastructure.read_projection import (
        SqlAlchemySchoolIntelligenceFactsReader,
    )
    from aieos.domains.teaching.infrastructure.persistence.uow import (
        SqlAlchemyTeachingUnitOfWorkFactory,
    )
    from aieos.platform.ai.fake import FakeStructuredModelGateway
    from aieos.platform.ai.infrastructure.persistence.uow import (
        SqlAlchemyAIUnitOfWorkFactory,
    )
    from aieos.platform.api.app import create_app

    runtime_url = os.environ.get("AIEOS360_S02_I04_E2E_RUNTIME_DATABASE_URL")
    if not runtime_url:
        raise SystemExit("AIEOS360_S02_I04_E2E_RUNTIME_DATABASE_URL is required")

    port = int(os.environ.get("AIEOS360_S02_I04_E2E_PRINCIPAL_BACKEND_PORT", "8006"))
    host = os.environ.get("AIEOS360_S02_I04_E2E_PRINCIPAL_BACKEND_HOST", "127.0.0.1")

    engine = create_engine(runtime_url)
    principal_scope = I04HarnessPrincipalSchoolScopeReader(
        tenant_id=SYNTHETIC_TENANT_ID,
        principal_id=PRINCIPAL_OS_HUMAN_PRINCIPAL_ID,
    )

    # Intentionally omit school_context_class_reader and learner_membership_reader.
    # Principal School Intelligence must not reuse Teacher assignability or
    # Student membership as school-scope authority.
    app = create_app(
        uow_factory=SqlAlchemyContentUnitOfWorkFactory(engine),
        teaching_uow_factory=SqlAlchemyTeachingUnitOfWorkFactory(engine),
        assessment_uow_factory=SqlAlchemyAssessmentUnitOfWorkFactory(engine),
        assessment_authorization=DevelopmentClassroomAssessmentPermit(),
        request_identity_authenticator=DevelopmentPrincipalAuthenticator(
            PRINCIPAL_OS_HUMAN_PRINCIPAL_ID
        ),
        security_resolver=DevelopmentTenantSecurityResolver(
            SYNTHETIC_TENANT_ID, PRINCIPAL_OS_HUMAN_PRINCIPAL_ID
        ),
        content_types=StaticContentTypeCatalog(development_content_type_names()),
        cursor_signing_key=b"aieos360-s02-i04-e2e-principal-cursor",
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
        school_intelligence_authorization=DevelopmentSchoolIntelligencePermit(),
        school_context_principal_scope_reader=principal_scope,
        school_intelligence_facts_reader=SqlAlchemySchoolIntelligenceFactsReader(
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
