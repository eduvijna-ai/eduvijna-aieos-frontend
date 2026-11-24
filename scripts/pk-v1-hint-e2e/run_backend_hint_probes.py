"""Execute pinned Backend PK-V1-HINT pytest suites on an isolated probe substrate only."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from probe_dsn_guard import (
    assert_env_before_backend_pytest,
    build_safe_probe_subprocess_env,
    load_journey_urls_from_report,
    load_probe_urls_from_report,
)

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


def _bootstrap_probe() -> Path:
    script_dir = Path(__file__).resolve().parent
    backend = Path(os.environ["AIEOS_BACKEND_ROOT"]).resolve()
    proc = subprocess.run(
        [sys.executable, str(script_dir / "bootstrap_probe_database.py")],
        cwd=backend,
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "AIEOS_BACKEND_ROOT": str(backend),
            "PYTHONPATH": os.pathsep.join(
                [str(backend / "src"), str(backend), str(script_dir)]
            ),
        },
    )
    if proc.returncode != 0:
        raise RuntimeError("PROBE_BOOTSTRAP_FAILED")
    return Path(
        os.environ.get(
            "PK_V1_HINT_E2E_PROBE_DB_REPORT",
            script_dir.parents[1] / "tmp" / "pk-v1-hint-e2e-probe-db.json",
        )
    )


def main() -> int:
    backend = Path(os.environ["AIEOS_BACKEND_ROOT"]).resolve()
    script_dir = Path(__file__).resolve().parent
    journey_report = Path(
        os.environ.get(
            "PK_V1_HINT_E2E_DB_REPORT",
            backend.parent / "tmp" / "pk-v1-hint-e2e-db.json",
        )
    )
    probe_report = _bootstrap_probe()
    journey = load_journey_urls_from_report(journey_report)
    probe = load_probe_urls_from_report(probe_report)
    env = build_safe_probe_subprocess_env(dict(os.environ), probe, journey)
    assert_env_before_backend_pytest(
        journey_report_path=journey_report,
        probe_report_path=probe_report,
        inherited=env,
    )

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
        "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
        "probe_substrate_isolated": True,
        "passed": passed,
        "failed": failed,
        "suites": len(suites),
        "lock_scenario_count": len(lock_results),
    }
    print(json.dumps(out))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())