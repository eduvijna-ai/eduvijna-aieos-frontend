"""Execute pinned Backend PK-V1-HINT pytest suites against shared disposable PG."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

LOCK_SCENARIOS = (
    (
        "S22",
        "tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency::test_hint_b_get_then_submit_second_get_denied",
    ),
    (
        "S51",
        "tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency::test_hint_b_submit_wins_assignment_lock_hint_denied",
    ),
    (
        "S52",
        "tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency::test_hint_b_hint_wins_lock_commits_before_submit",
    ),
    (
        "S53",
        "tests/domains/learning/test_aieos_v1_hint_b.py::TestLearnerHintsConcurrency::test_hint_b_close_wins_assignment_lock_hint_denied",
    ),
)


def main() -> int:
    backend = Path(os.environ["AIEOS_BACKEND_ROOT"]).resolve()
    db_report = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_DB_REPORT",
            backend.parent / "tmp" / "pk-v1-hint-e2e-db.json",
        )
    )
    runtime_url = json.loads(db_report.read_text(encoding="utf-8"))["runtime_database_url"]

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
    lock_results: list[dict[str, object]] = []
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

    for scenario_id, nodeid in LOCK_SCENARIOS:
        proc = subprocess.run(
            ["uv", "run", "pytest", nodeid, "-q", "--tb=line"],
            cwd=backend,
            env=env,
            capture_output=True,
            text=True,
        )
        ok = proc.returncode == 0
        lock_results.append({"scenario_id": scenario_id, "ok": ok})
        if ok:
            passed += 1
        else:
            failed += 1

    out = {
        "passed": passed,
        "failed": failed,
        "suites": len(suites),
        "lock_scenarios": lock_results,
    }
    print(json.dumps(out))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())