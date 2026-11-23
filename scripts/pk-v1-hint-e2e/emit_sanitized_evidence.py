"""Write sanitized fixture/db evidence for CI artifacts only."""

from __future__ import annotations

import json
import os
from pathlib import Path

from export_sanitize import EVIDENCE_CONTRACT_VERSION, write_sanitized_json
from sp02a_ledger import parse_sp02a_ledger_doc, repo_ledger_doc


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

    summary = {
        "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
        "sanitized_evidence_ok": True,
        "ledger_row_count": len(scenario_rows),
        "tier_counts": tier_counts,
        "has_fixture": fixture_path.is_file(),
        "has_db_report": db_path.is_file(),
        "has_probe_db_report": probe_path.is_file(),
        "evidence_contract_version": EVIDENCE_CONTRACT_VERSION,
        "generated_at_ms": int(__import__("time").time() * 1000),
        "attempt_run_id": attempt_run_id,
        "github_sha": github_sha,
        "backend_pin_sha": backend_pin_sha,
        "openapi_authority_sha": openapi_authority_sha,
        "migration_head": migration_head,
    }
    write_sanitized_json(str(out_dir / "evidence-summary.json"), summary)
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())