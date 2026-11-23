"""Parse committed SP02A S01–S67 ledger from the governed proof document."""

from __future__ import annotations

import re
from pathlib import Path

_LEDGER_ROW = re.compile(r"^\| (S\d{2}) \|")


def repo_ledger_doc(repo_root: Path) -> Path:
    return repo_root / "docs" / "PK-V1-HINT-E2E-I01-REAL-STACK-PROOF.md"


def expected_scenario_ids() -> list[str]:
    return [f"S{i:02d}" for i in range(1, 68)]


def parse_sp02a_ledger_doc(ledger_path: Path) -> tuple[list[dict[str, str]], dict[str, int]]:
    if not ledger_path.is_file():
        raise FileNotFoundError("MISSING_LEDGER_DOC")

    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    for line in ledger_path.read_text(encoding="utf-8").splitlines():
        match = _LEDGER_ROW.match(line.strip())
        if not match:
            continue
        parts = [part.strip() for part in line.strip().strip("|").split("|")]
        if len(parts) < 3:
            continue
        scenario_id = parts[0]
        if scenario_id in seen:
            raise ValueError(f"DUPLICATE_LEDGER_SCENARIO:{scenario_id}")
        seen.add(scenario_id)
        rows.append({"scenario_id": scenario_id, "evidence_tier": parts[2]})

    expected = set(expected_scenario_ids())
    found = {row["scenario_id"] for row in rows}
    missing = sorted(expected - found)
    extra = sorted(found - expected)
    if missing or extra:
        raise ValueError(f"LEDGER_SCENARIO_MISMATCH:missing={missing}:extra={extra}")

    tier_counts: dict[str, int] = {}
    for row in rows:
        tier = row["evidence_tier"]
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    rows.sort(key=lambda item: item["scenario_id"])
    return rows, tier_counts