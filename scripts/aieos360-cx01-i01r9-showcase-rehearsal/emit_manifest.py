"""Emit machine-readable CX01-I01 rehearsal manifest (no secrets)."""

from __future__ import annotations

import json
import os
import subprocess
from datetime import UTC, datetime
from pathlib import Path

ARCHITECTURE_PIN_SHA = "491295c3cf0a151f31686a6a2e1a2176cd92c782"
PRODUCT_PIN_SHA = "b4b3048fb7a6a1c50ae8619dc490743714f2e3e2"
INFRASTRUCTURE_PIN_SHA = "a8654e5bc680eac1fa93cf8308d7cad904f4d7b9"
FRONTEND_BASE_SHA = "80125be6cf172afb5137e845752c5b4505e5a97f"
BACKEND_PIN_SHA = "637583f42b7c475ef83f6f99bca7e65e665a253d"
OPENAPI_AUTHORITY_SHA = (
    "4042FB2725DA70A02A70EE09563B7698AE2E5DA82927614CAF1B5F7E6AA7C1D0"
)
EXPECTED_MIGRATION_HEAD = "a360s010004"
SCENARIO_ID = "aieos360-cx01-i01-showcase-rehearsal"
APPROVED_CLIENT_SCENARIO_ID = "AIEOS360-CX-SCENARIO-01"
SCENARIO_VERSION = "1"
CLASSIFICATION = "NON_PRODUCTION"
CX01_SHOWCASE_CONTAINER = "aieos-aieos360-cx01-i01-showcase-pg"


def _repo_tmp() -> Path:
    return Path(__file__).resolve().parents[2] / "tmp"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _git_head(repo: Path) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            text=True,
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def _verify_backend_pin() -> str:
    backend_root = os.environ.get("AIEOS_BACKEND_ROOT")
    if not backend_root:
        return BACKEND_PIN_SHA
    head = _git_head(Path(backend_root))
    if head != BACKEND_PIN_SHA:
        raise SystemExit(
            f"backend pin drift: HEAD {head} != governed {BACKEND_PIN_SHA}"
        )
    return head


def main() -> int:
    db_report_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_DB_REPORT",
            _repo_tmp() / "aieos360-cx01-i01-showcase-db.json",
        )
    )
    fixture_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH",
            _repo_tmp() / "aieos360-cx01-i01-showcase-fixture.json",
        )
    )
    manifest_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_MANIFEST_PATH",
            _repo_tmp() / "aieos360-cx01-i01-showcase-manifest.json",
        )
    )

    db_report = json.loads(db_report_path.read_text(encoding="utf-8"))
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))

    teacher_be = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_TEACHER_BACKEND_PORT", "8020")
    )
    student_be = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_STUDENT_BACKEND_PORT", "8021")
    )
    principal_be = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_PRINCIPAL_BACKEND_PORT", "8022")
    )
    parent_be = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_PARENT_BACKEND_PORT", "8023")
    )
    teacher_fe = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_TEACHER_FRONTEND_PORT", "5291")
    )
    student_fe = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_STUDENT_FRONTEND_PORT", "5292")
    )
    principal_fe = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_PRINCIPAL_FRONTEND_PORT", "5293")
    )
    parent_fe = int(
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_PARENT_FRONTEND_PORT", "5294")
    )

    backend_verified_sha = _verify_backend_pin()
    frontend_execution_sha = (
        os.environ.get("AIEOS360_CX01_I01_SHOWCASE_FRONTEND_EXECUTION_SHA")
        or _git_head(_repo_root())
        or FRONTEND_BASE_SHA
    )

    merge_note = (
        "frontend_execution_sha is the CI/agent synthetic merge commit; "
        "frontend_governed_base_sha is the approved W01/I01 frontend pin parent."
    )
    manifest = {
        "package_scenario_id": SCENARIO_ID,
        "approved_client_scenario_id": APPROVED_CLIENT_SCENARIO_ID,
        "scenario_id": SCENARIO_ID,
        "scenario_version": SCENARIO_VERSION,
        "frontend_execution_synthetic_merge_note": merge_note,
        "classification": CLASSIFICATION,
        "architecture_sha": ARCHITECTURE_PIN_SHA,
        "product_sha": PRODUCT_PIN_SHA,
        "infrastructure_sha": INFRASTRUCTURE_PIN_SHA,
        "backend_sha": backend_verified_sha,
        "frontend_governed_base_sha": FRONTEND_BASE_SHA,
        "frontend_execution_sha": frontend_execution_sha,
        "frontend_sha": FRONTEND_BASE_SHA,
        "openapi_sha256": OPENAPI_AUTHORITY_SHA,
        "migration_head": EXPECTED_MIGRATION_HEAD,
        "postgres_major": db_report.get("postgres_major", 18),
        "shared_database": True,
        "school_context_provider": fixture.get(
            "school_context_provider",
            "DevelopmentCoherentSchoolContextProvider",
        ),
        "deterministic_mode": True,
        "dedicated_container": db_report.get("container_name")
        or CX01_SHOWCASE_CONTAINER,
        "tenant_id": fixture.get("tenant_id"),
        "teacher_principal_id": fixture.get("teacher_principal_id"),
        "student_principal_id": fixture.get("student_principal_id"),
        "student_b_principal_id": fixture.get("student_b_principal_id"),
        "principal_principal_id": fixture.get("principal_principal_id"),
        "parent_principal_id": fixture.get("parent_principal_id"),
        "class_ref_5a": fixture.get("class_ref"),
        "class_ref_5b": fixture.get("class_ref_5b"),
        "work_id": fixture.get("work_id"),
        "content_id": fixture.get("content_id"),
        "version_id": fixture.get("version_id"),
        "role_urls": {
            "teacher": {
                "frontend": f"http://127.0.0.1:{teacher_fe}",
                "backend": f"http://127.0.0.1:{teacher_be}",
            },
            "student": {
                "frontend": f"http://127.0.0.1:{student_fe}",
                "backend": f"http://127.0.0.1:{student_be}",
            },
            "principal": {
                "frontend": f"http://127.0.0.1:{principal_fe}",
                "backend": f"http://127.0.0.1:{principal_be}",
            },
            "parent": {
                "frontend": f"http://127.0.0.1:{parent_fe}",
                "backend": f"http://127.0.0.1:{parent_be}",
            },
        },
        "fixture_path": str(fixture_path),
        "db_report_path": str(db_report_path),
        "emitted_at": datetime.now(UTC).isoformat(),
    }

    from export_sanitize import write_sanitized_json

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    write_sanitized_json(str(manifest_path), manifest)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
