"""Write sanitized fixture/db evidence for CI artifacts only."""

from __future__ import annotations

import json
import os
from pathlib import Path

from export_sanitize import write_sanitized_json


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

    scenario_rows: list[dict[str, object]] = []
    tier_counts: dict[str, int] = {}

    def bump(tier: str) -> None:
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

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

    ledger_path = Path(__file__).resolve().parents[2] / "docs" / "PK-V1-HINT-E2E-I01-REAL-STACK-PROOF.md"
    if ledger_path.is_file():
        for line in ledger_path.read_text(encoding="utf-8").splitlines():
            if not (line.startswith("| S") and len(line) > 4 and line[3].isdigit()):
                continue
            parts = [part.strip() for part in line.strip("|").split("|")]
            if len(parts) < 3:
                continue
            scenario_rows.append(
                {
                    "scenario_id": parts[0],
                    "evidence_tier": parts[2],
                }
            )
            bump(parts[2])

    summary = {
        "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
        "sanitized_evidence_ok": True,
        "ledger_row_count": len(scenario_rows),
        "tier_counts": tier_counts,
        "has_fixture": fixture_path.is_file(),
        "has_db_report": db_path.is_file(),
        "has_probe_db_report": probe_path.is_file(),
    }
    write_sanitized_json(str(out_dir / "evidence-summary.json"), summary)
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())