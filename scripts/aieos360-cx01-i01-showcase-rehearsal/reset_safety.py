"""Fail-closed safety fence for CX01-I01 destructive rehearsal reset."""

from __future__ import annotations

import sys

from reset_target_contract import validate_reset_environment


def _fail(message: str) -> None:
    raise SystemExit(f"AIEOS360-CX01-I01 RESET BLOCKED — {message}")


def assert_reset_target_safe() -> None:
    try:
        validate_reset_environment()
    except ValueError as exc:
        _fail(str(exc))


def main() -> int:
    assert_reset_target_safe()
    print("CX01-I01 reset safety fence: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
