"""Static DSN contract tests — runnable without Docker."""

from __future__ import annotations

import os
import sys
import unittest


def _import_contract():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    import dsn_contract as mod

    return mod


class DsnContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.mod = _import_contract()

    def test_refuses_remote_host(self) -> None:
        env = {
            "PK_V1_HINT_E2E_CI_EXTERNAL_PG": "1",
            "AIEOS_TEST_DATABASE_URL": (
                "postgresql+psycopg://aieos_migrator:aieos_test@203.0.113.1:5432/aieos"
            ),
            "AIEOS_TEST_BOOTSTRAP_DATABASE_URL": (
                "postgresql+psycopg://aieos_bootstrap:aieos_test@203.0.113.1:5432/aieos"
            ),
            "AIEOS_TEST_RUNTIME_DATABASE_URL": (
                "postgresql+psycopg://aieos_runtime:aieos_test@203.0.113.1:5432/aieos"
            ),
        }
        with self.assertRaises(ValueError):
            self.mod.validate_external_ci_database_targets(env)

    def test_refuses_ci_without_marker(self) -> None:
        env = {
            "AIEOS_TEST_DATABASE_URL": (
                "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos"
            ),
        }
        with self.assertRaises(ValueError):
            self.mod.validate_external_ci_database_targets(env)

    def test_accepts_governed_ci_urls(self) -> None:
        env = {
            "PK_V1_HINT_E2E_CI_EXTERNAL_PG": "1",
            "AIEOS_TEST_DATABASE_URL": (
                "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos"
            ),
            "AIEOS_TEST_BOOTSTRAP_DATABASE_URL": (
                "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos"
            ),
            "AIEOS_TEST_RUNTIME_DATABASE_URL": (
                "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos"
            ),
        }
        self.mod.validate_external_ci_database_targets(env)

    def test_refuses_wrong_local_port(self) -> None:
        env = {"AIEOS_TEST_PG_PORT": "5432"}
        with self.assertRaises(ValueError):
            self.mod.validate_local_dedicated_database_targets(env)

    def test_refuses_foreign_container_name(self) -> None:
        env = {"PK_V1_HINT_E2E_PG_CONTAINER": "foreign-pg"}
        with self.assertRaises(ValueError):
            self.mod.validate_local_dedicated_database_targets(env)


if __name__ == "__main__":
    raise SystemExit(unittest.main())