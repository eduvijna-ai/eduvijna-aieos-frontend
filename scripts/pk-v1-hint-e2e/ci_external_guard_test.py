"""Governed CI-external classification self-tests (no Docker)."""

from __future__ import annotations

import os
import sys
import unittest


def _import_mod():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    import ci_external_guard as mod

    return mod


class CiExternalGuardTest(unittest.TestCase):
    def setUp(self) -> None:
        self.mod = _import_mod()
        self.base = {
            "PK_V1_HINT_E2E_CI_EXTERNAL_PG": "1",
            "PK_V1_HINT_E2E_PROBE_CI_EXTERNAL_PG": "1",
            "AIEOS_TEST_BOOTSTRAP_DATABASE_URL": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos",
            "AIEOS_TEST_DATABASE_URL": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos",
            "AIEOS_TEST_RUNTIME_DATABASE_URL": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos",
            "PK_V1_HINT_E2E_PROBE_BOOTSTRAP_DATABASE_URL": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "PK_V1_HINT_E2E_PROBE_DATABASE_URL": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "PK_V1_HINT_E2E_PROBE_RUNTIME_DATABASE_URL": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos_hint_probe",
        }

    def test_rejects_dsn_without_explicit_marker(self) -> None:
        env = dict(self.base)
        del env["PK_V1_HINT_E2E_CI_EXTERNAL_PG"]
        self.assertFalse(self.mod.is_governed_ci_external_pg(env))

    def test_accepts_governed_ci_loopback_targets(self) -> None:
        self.assertTrue(self.mod.is_governed_ci_external_pg(self.base))

    def test_rejects_arbitrary_host(self) -> None:
        env = dict(self.base)
        env["AIEOS_TEST_DATABASE_URL"] = (
            "postgresql+psycopg://aieos_migrator:aieos_test@203.0.113.1:5432/aieos"
        )
        with self.assertRaises(ValueError):
            self.mod.is_governed_ci_external_pg(env)


if __name__ == "__main__":
    raise SystemExit(unittest.main())