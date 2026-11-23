"""Execute pinned Backend PK-V1-HINT pytest suites against shared disposable PG."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    backend = Path(os.environ["AIEOS_BACKEND_ROOT"]).resolve()
    db_report = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_DB_REPORT",
            backend.parent / "tmp" / "pk-v1-hint-e2e-db.json",
        )
    )
    runtime_url = db_report.read_text(encoding="utf-8")
    runtime_url = json.loads(runtime_url)["runtime_database_url"]

    env = os.environ.copy()
    env["AIEOS_DATABASE_URL"] = runtime_url
    env["AIEOS_TEST_DATABASE_URL"] = runtime_url
    env["AIEOS_TEST_RUNTIME_DATABASE_URL"] = runtime_url

    suites = [
        "tests/domains/learning/test_aieos_v1_hint_b.py",
        "tests/domains/education/test_aieos_v1_hint_t0_b_http.py",
    ]
    passed = 0
    failed = 0
    for suite in suites:
        proc = subprocess.run(
            ["uv", "run", "pytest", suite, "-q", "--tb=no"],
            cwd=backend,
            env=env,
            capture_output=True,
            text=True,
        )
        if proc.returncode == 0:
            passed += 1
        else:
            failed += 1
    out = {"passed": passed, "failed": failed, "suites": len(suites)}
    print(json.dumps(out))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())