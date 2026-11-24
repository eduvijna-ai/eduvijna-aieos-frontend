"""Governed CI-external PostgreSQL classification for pk-v1-hint harness."""

from __future__ import annotations

import json
import os
import sys

from dsn_contract import (
    validate_external_ci_database_targets,
    validate_probe_ci_database_targets,
)


def is_governed_ci_external_pg(env: dict[str, str] | None = None) -> bool:
    source = dict(os.environ) if env is None else env
    if source.get("PK_V1_HINT_E2E_CI_EXTERNAL_PG") != "1":
        return False
    validate_external_ci_database_targets(source)
    if source.get("PK_V1_HINT_E2E_PROBE_CI_EXTERNAL_PG") == "1":
        validate_probe_ci_database_targets(source)
    return True


def main() -> int:
    try:
        ok = is_governed_ci_external_pg()
    except ValueError as exc:
        print(json.dumps({"ci_external_guard_ok": False, "code": str(exc)}))
        return 1
    print(json.dumps({"ci_external_guard_ok": ok}))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())