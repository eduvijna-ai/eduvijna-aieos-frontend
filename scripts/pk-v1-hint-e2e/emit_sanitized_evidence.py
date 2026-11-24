"""Write sanitized fixture/db evidence for CI artifacts only."""

from __future__ import annotations

import json
import os
from pathlib import Path

from artifact_semantic_validation import (
    validate_attempt_run_id,
    validate_backend_pin_sha,
    validate_github_sha,
    validate_migration_head,
    validate_openapi_authority_sha,
)
from export_sanitize import EVIDENCE_CONTRACT_VERSION, PACKAGE_SCENARIO_ID, write_sanitized_json
from sp02a_ledger import parse_sp02a_ledger_doc, repo_ledger_doc


def build_evidence_summary(
    *,
    scenario_rows: list,
    tier_counts: dict[str, int],
    has_fixture: bool,
    has_db_report: bool,
    has_probe_db_report: bool,
    attempt_run_id: str | None,
    github_sha: str | None,
    backend_pin_sha: str | None,
    openapi_authority_sha: str | None,
    migration_head: str | None,
    generated_at_ms: int | None = None,
) -> dict:
    """Privacy-safe summary; omits unverified authority scalars (not an E2E_PASS claim)."""
    summary: dict = {
        "package_scenario_id": PACKAGE_SCENARIO_ID,
        "sanitized_evidence_ok": True,
        "ledger_row_count": len(scenario_rows),
        "tier_counts": tier_counts,
        "has_fixture": has_fixture,
        "has_db_report": has_db_report,
        "has_probe_db_report": has_probe_db_report,
        "evidence_contract_version": EVIDENCE_CONTRACT_VERSION,
        "generated_at_ms": generated_at_ms
        if generated_at_ms is not None
        else int(__import__("time").time() * 1000),
    }
    if attempt_run_id is not None and validate_attempt_run_id(attempt_run_id) is None:
        summary["attempt_run_id"] = attempt_run_id
    if github_sha is not None and validate_github_sha(github_sha) is None:
        summary["github_sha"] = github_sha
    if backend_pin_sha is not None and validate_backend_pin_sha(backend_pin_sha) is None:
        summary["backend_pin_sha"] = backend_pin_sha
    if (
        openapi_authority_sha is not None
        and validate_openapi_authority_sha(openapi_authority_sha) is None
    ):
        summary["openapi_authority_sha"] = openapi_authority_sha
    if migration_head is not None and validate_migration_head(migration_head) is None:
        summary["migration_head"] = migration_head
    return summary


def main() -> int:
    repo_tmp = Path(__file__).resolve().parents[2] / "tmp"
    fixture_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_FIXTURE_PATH",
            repo_tmp / "pk-v1-hint-e2e-fixture.json",
        )
    )
    db_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_DB_REPORT",
            repo_tmp / "pk-v1-hint-e2e-db.json",
        )
    )
    out_dir = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_SANITIZED_DIR",
            repo_tmp / "pk-v1-hint-e2e-sanitized",
        )
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    scenario_rows, tier_counts = parse_sp02a_ledger_doc(
        repo_ledger_doc(Path(__file__).resolve().parents[2])
    )

    probe_path = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_PROBE_DB_REPORT",
            repo_tmp / "pk-v1-hint-e2e-probe-db.json",
        )
    )

    if db_path.is_file():
        write_sanitized_json(
            str(out_dir / "db-report-sanitized.json"),
            json.loads(db_path.read_text(encoding="utf-8")),
        )

    if probe_path.is_file():
        write_sanitized_json(
            str(out_dir / "probe-db-report-sanitized.json"),
            json.loads(probe_path.read_text(encoding="utf-8")),
        )

    if fixture_path.is_file():
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        write_sanitized_json(
            str(out_dir / "fixture-sanitized.json"),
            fixture,
        )

    backend_pin_sha = None
    migration_head = None
    openapi_authority_sha = None
    if db_path.is_file():
        db_raw = json.loads(db_path.read_text(encoding="utf-8"))
        backend_pin_sha = db_raw.get("backend_pin_sha")
        migration_head = db_raw.get("migration_head")
    if fixture_path.is_file():
        fixture_raw = json.loads(fixture_path.read_text(encoding="utf-8"))
        openapi_authority_sha = fixture_raw.get("openapi_authority_sha")
        backend_pin_sha = backend_pin_sha or fixture_raw.get("backend_pin_sha")
        migration_head = migration_head or fixture_raw.get("migration_head")

    attempt_status_path = repo_tmp / "pk-v1-hint-e2e-attempt-status.json"
    attempt_run_id = None
    github_sha = os.environ.get("GITHUB_SHA")
    if attempt_status_path.is_file():
        try:
            attempt = json.loads(attempt_status_path.read_text(encoding="utf-8"))
            attempt_run_id = attempt.get("attempt_run_id")
            github_sha = github_sha or attempt.get("github_sha")
        except json.JSONDecodeError:
            attempt_run_id = None

    summary = build_evidence_summary(
        scenario_rows=scenario_rows,
        tier_counts=tier_counts,
        has_fixture=fixture_path.is_file(),
        has_db_report=db_path.is_file(),
        has_probe_db_report=probe_path.is_file(),
        attempt_run_id=attempt_run_id,
        github_sha=github_sha,
        backend_pin_sha=backend_pin_sha,
        openapi_authority_sha=openapi_authority_sha,
        migration_head=migration_head,
    )
    write_sanitized_json(str(out_dir / "evidence-summary.json"), summary)
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())