"""Prove four CX01 role compositions share one DB contract and deterministic fakes."""

from __future__ import annotations

import json
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]


def main() -> int:
    tmp = REPO_ROOT / "tmp"
    db_report_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_DB_REPORT",
            tmp / "aieos360-cx01-i01-showcase-db.json",
        )
    )
    fixture_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH",
            tmp / "aieos360-cx01-i01-showcase-fixture.json",
        )
    )
    if not db_report_path.is_file() or not fixture_path.is_file():
        raise SystemExit("db report and fixture required")

    db_report = json.loads(db_report_path.read_text(encoding="utf-8"))
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    runtime = db_report["runtime_database_url"]

    for role in ("teacher", "student", "principal", "parent"):
        serve = (SCRIPT_DIR / f"serve_{role}_app.py").read_text(encoding="utf-8")
        if "DevelopmentCoherentSchoolContextProvider()" not in serve:
            raise SystemExit(f"{role} serve must use coherent school context defaults")
        if "FakeStructuredModelGateway" not in serve and role == "teacher":
            raise SystemExit("teacher serve must use FakeStructuredModelGateway")
        if "openai" in serve.lower() or "groq" in serve.lower():
            raise SystemExit(f"{role} serve must not reference external AI providers")

    proof = {
        "shared_runtime_database_host": runtime.split("@")[-1],
        "roles": ["teacher", "student", "principal", "parent"],
        "school_context_provider": fixture.get("school_context_provider"),
        "deterministic_mode": fixture.get("deterministic_mode", True),
        "scenario_id": fixture.get("scenario_id"),
        "teacher_principal_id": fixture.get("teacher_principal_id"),
        "student_principal_id": fixture.get("student_principal_id"),
        "principal_principal_id": fixture.get("principal_principal_id"),
        "parent_principal_id": fixture.get("parent_principal_id"),
        "work_id": fixture.get("work_id"),
        "content_id": fixture.get("content_id"),
        "version_id": fixture.get("version_id"),
    }
    out = tmp / "aieos360-cx01-i01-showcase-four-role-proof.json"
    out.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(proof, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
