"""Fail-closed safety fence for CX01-I01 destructive rehearsal reset.

Ensures destructive bootstrap only targets the dedicated CX01 showcase substrate.
NON_PRODUCTION only.
"""

from __future__ import annotations

import os
import re
import sys

CX01_SHOWCASE_CONTAINER = "aieos-aieos360-cx01-i01-showcase-pg"
DEDICATED_PG_HOST_PORT = 55448

_ALLOWED_CONTAINER = CX01_SHOWCASE_CONTAINER
_DEDICATED_PORT_PATTERN = re.compile(
    rf"@127\.0\.0\.1:{DEDICATED_PG_HOST_PORT}/"
)


def _fail(message: str) -> None:
    raise SystemExit(f"AIEOS360-CX01-I01 RESET BLOCKED — {message}")


def assert_reset_target_safe() -> None:
    external = os.environ.get("AIEOS_TEST_DATABASE_URL")
    if external:
        if os.environ.get("AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG") != "1":
            _fail(
                "external PostgreSQL URLs require "
                "AIEOS360_CX01_I01_SHOWCASE_CI_EXTERNAL_PG=1 (CI lane only)"
            )
        runtime = os.environ.get("AIEOS_TEST_RUNTIME_DATABASE_URL", external)
        if "aieos_test" not in runtime and "aieos_bootstrap" not in runtime:
            _fail("external runtime URL does not match governed CI test identity")
        return

    container = os.environ.get(
        "AIEOS360_CX01_I01_SHOWCASE_PG_CONTAINER", _ALLOWED_CONTAINER
    )
    if container != _ALLOWED_CONTAINER:
        _fail(
            f"container name must be exactly {_ALLOWED_CONTAINER}; got {container}"
        )

    port = os.environ.get("AIEOS_TEST_PG_PORT", str(DEDICATED_PG_HOST_PORT))
    if str(port) != str(DEDICATED_PG_HOST_PORT):
        _fail(
            f"dedicated rehearsal port must be {DEDICATED_PG_HOST_PORT}; got {port}"
        )

    for key in (
        "AIEOS360_CX01_I01_SHOWCASE_RUNTIME_DATABASE_URL",
        "AIEOS360_CX01_I01_SHOWCASE_BOOTSTRAP_DATABASE_URL",
    ):
        url = os.environ.get(key)
        if url and not _DEDICATED_PORT_PATTERN.search(url):
            _fail(f"{key} must use dedicated port {DEDICATED_PG_HOST_PORT}")


def main() -> int:
    assert_reset_target_safe()
    print("CX01-I01 reset safety fence: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
