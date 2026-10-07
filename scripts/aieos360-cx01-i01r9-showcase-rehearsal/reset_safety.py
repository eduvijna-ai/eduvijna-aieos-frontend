"""Fail-closed safety fence for CX01-I01 destructive rehearsal reset."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from reset_target_contract import validate_reset_environment


def _fail(message: str) -> None:
    raise SystemExit(f"AIEOS360-CX01-I01 RESET BLOCKED — {message}")


def assert_reset_target_safe() -> None:
    try:
        validate_reset_environment()
    except ValueError as exc:
        _fail(str(exc))
    if not os.environ.get("AIEOS_TEST_DATABASE_URL"):
        script_dir = Path(__file__).resolve().parent
        result = subprocess.run(
            ["node", str(script_dir / "assert_docker_safe.mjs")],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            _fail(result.stderr.strip() or result.stdout.strip() or "docker safety check failed")


def main() -> int:
    assert_reset_target_safe()
    print("CX01-I01 reset safety fence: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
