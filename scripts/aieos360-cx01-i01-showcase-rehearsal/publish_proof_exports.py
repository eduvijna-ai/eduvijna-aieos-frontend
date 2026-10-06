"""Write sanitized CI-uploadable proof exports and scan for credential leaks."""

from __future__ import annotations

import json
import os
from pathlib import Path

from export_sanitize import scan_for_leaks, write_sanitized_json

REPO_TMP = Path(__file__).resolve().parents[2] / "tmp"


def main() -> int:
    tmp = Path(os.environ.get("AIEOS360_CX01_I01_SHOWCASE_TMP", REPO_TMP))
    export_dir = tmp / "cx01-proof-exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    patterns = (
        "aieos360-cx01-i01-showcase-repeatability-proof.json",
        "aieos360-cx01-i01-showcase-shared-db-proof.json",
        "aieos360-cx01-i01-showcase-four-role-runtime-proof.json",
        "aieos360-cx01-i01-showcase-lifecycle-proof.json",
        "aieos360-cx01-i01-showcase-operator-failure-proof.json",
        "aieos360-cx01-i01-showcase-injected-failure-proof.json",
        "aieos360-cx01-i01-showcase-interactive-shutdown-proof.json",
        "aieos360-cx01-i01-showcase-manifest.json",
    )
    merged: dict = {
        "bundle_kind": "cx01_i01_sanitized_proof_exports",
        "not_single_snapshot": True,
        "approved_client_scenario_id": "AIEOS360-CX-SCENARIO-01",
        "package_scenario_id": "aieos360-cx01-i01-showcase-rehearsal",
        "exports": [],
    }
    for name in patterns:
        src = tmp / name
        if not src.is_file():
            continue
        payload = json.loads(src.read_text(encoding="utf-8"))
        dest = export_dir / name
        write_sanitized_json(str(dest), payload)
        merged["exports"].append(name)

    report_path = export_dir / "aieos360-cx01-i01-showcase-proof-bundle.json"
    write_sanitized_json(str(report_path), merged)

    for path in export_dir.glob("*.json"):
        text = path.read_text(encoding="utf-8")
        leaks = scan_for_leaks(text)
        if leaks:
            raise SystemExit(f"export leak scan failed for {path.name}: {leaks}")

    print(json.dumps({"export_dir": str(export_dir), "files": merged["exports"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
