"""CX01-I06R1 Provider Aggregator tenant header contract (NON_PRODUCTION).

Uses DevelopmentTenantSecurityResolver with the governed synthetic tenant id.
No network provider calls — composition-only TestClient GET.
"""

from __future__ import annotations

import os
import sys
from datetime import timedelta
from pathlib import Path
from uuid import UUID

GOVERNED_SYNTHETIC_TENANT_ID = "71b5fb49-2bdb-56c3-ab7c-3b33e92a89f0"
PATH = "/api/v1/platform/ai/providers"


def _backend_root() -> Path:
    root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not root:
        raise SystemExit("AIEOS_BACKEND_ROOT is required")
    return Path(root).resolve()


class _UnusedUow:
    def __call__(self, tenant_id):
        raise AssertionError("Provider Aggregator must not open UoW")


def main() -> int:
    backend = _backend_root()
    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))

    from fastapi.testclient import TestClient

    from aieos.development.auth_adapters import (
        DevelopmentPrincipalAuthenticator,
        DevelopmentTenantSecurityResolver,
    )
    from aieos.development.coherent_school_context import SYNTHETIC_TENANT_ID
    from aieos.domains.content.application.catalog import StaticContentTypeCatalog
    from aieos.platform.ai.composition import compose_configured_model_provider
    from aieos.platform.api.app import create_app
    from tests.fakes import (
        AllowAssetCurrentGovernance,
        AllowAssetReferenceValidation,
        AllowClassroomAssessmentAuthorization,
        AllowPublicationAuthorization,
        AllowPublicationGovernance,
        AllowReviewAuthorization,
        AllowReviewCommentPolicy,
        make_test_schema_registry,
    )

    if str(SYNTHETIC_TENANT_ID) != GOVERNED_SYNTHETIC_TENANT_ID:
        raise SystemExit("governed synthetic tenant id drift")

    configured = compose_configured_model_provider(
        environ={
            "AIEOS_AI_PROVIDER": "groq",
            "AIEOS_GROQ_API_KEY": "synthetic-offline-proof-key",
        }
    )
    principal_id = UUID("f85329ab-f05b-564e-a67b-318f3e1f3cf3")
    app = create_app(
        uow_factory=_UnusedUow(),
        teaching_uow_factory=_UnusedUow(),
        assessment_uow_factory=_UnusedUow(),
        assessment_authorization=AllowClassroomAssessmentAuthorization(),
        request_identity_authenticator=DevelopmentPrincipalAuthenticator(principal_id),
        security_resolver=DevelopmentTenantSecurityResolver(
            SYNTHETIC_TENANT_ID, principal_id
        ),
        content_types=StaticContentTypeCatalog({"test.generic"}),
        cursor_signing_key=b"cx01-i06r1-provider-aggregator-contract",
        schema_registry=make_test_schema_registry(),
        idempotency_retention=timedelta(hours=24),
        review_authorization=AllowReviewAuthorization(),
        review_comment_policy=AllowReviewCommentPolicy(),
        publication_authorization=AllowPublicationAuthorization(),
        publication_governance=AllowPublicationGovernance(),
        asset_reference_validation=AllowAssetReferenceValidation(),
        asset_current_governance=AllowAssetCurrentGovernance(),
        model_gateway=configured.gateway,
        ai_provider_id=configured.provider_id,
        ai_model_id=configured.model_id,
        provider_runtime=configured.projection,
    )

    client = TestClient(app, raise_server_exceptions=False)
    missing = client.get(PATH, headers={"Accept": "application/json"})
    if missing.status_code not in (401, 403):
        raise SystemExit(
            f"expected missing tenant header to fail closed, got {missing.status_code}"
        )

    ok = client.get(
        PATH,
        headers={
            "Accept": "application/json",
            "X-AIEOS-Tenant-ID": GOVERNED_SYNTHETIC_TENANT_ID,
        },
    )
    if ok.status_code != 200:
        raise SystemExit(f"expected tenant header success, got {ok.status_code}: {ok.text}")
    body = ok.json()
    if body.get("active_provider_id") != "groq":
        raise SystemExit(f"expected groq active provider, got {body}")
    if body.get("mode") != "REAL":
        raise SystemExit(f"expected REAL composition mode, got {body}")

    print(
        {
            "provider_aggregator_tenant_contract": "ok",
            "tenant_id": GOVERNED_SYNTHETIC_TENANT_ID,
            "active_provider_id": body.get("active_provider_id"),
            "mode": body.get("mode"),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
