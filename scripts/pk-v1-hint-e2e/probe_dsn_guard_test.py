"""No-Docker probe/journey DSN isolation self-tests."""

from __future__ import annotations

import os
import sys
import unittest


def _import_guard():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    import probe_dsn_guard as mod

    return mod


class ProbeDsnGuardTest(unittest.TestCase):
    def setUp(self) -> None:
        self.mod = _import_guard()
        self.journey = {
            "bootstrap": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos",
            "migrator": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos",
            "runtime": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos",
        }

    def test_refuses_identical_active_and_probe_dsn(self) -> None:
        url = "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos"
        with self.assertRaises(ValueError) as ctx:
            self.mod.assert_forbidden_identical_dsn_pair(url, url)
        self.assertIn("PROBE_DSN_FORBIDDEN", str(ctx.exception))
        self.mod.assert_safe_error_message(str(ctx.exception))

    def test_localhost_and_127_0_0_1_same_physical_target(self) -> None:
        a = "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos"
        b = "postgresql+psycopg://aieos_migrator:aieos_test@localhost:5432/aieos"
        with self.assertRaises(ValueError):
            self.mod.assert_forbidden_identical_dsn_pair(a, b)

    def test_allows_distinct_probe_database_on_same_host(self) -> None:
        probe = {
            "bootstrap": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:55440/aieos",
            "migrator": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:55440/aieos",
            "runtime": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:55440/aieos",
            "database": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:55440/aieos",
        }
        self.mod.assert_probe_urls_isolated_from_journey(
            journey_urls=self.journey, probe_urls=probe
        )

    def test_refuses_same_physical_db_with_different_users(self) -> None:
        probe = {
            "bootstrap": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "migrator": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos",
            "runtime": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "database": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos_hint_probe",
        }
        with self.assertRaises(ValueError):
            self.mod.assert_probe_urls_isolated_from_journey(
                journey_urls=self.journey, probe_urls=probe
            )

    def test_refuses_probe_runtime_matching_journey_runtime(self) -> None:
        probe = {
            "bootstrap": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "migrator": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos",
            "runtime": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "database": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos",
        }
        with self.assertRaises(ValueError):
            self.mod.assert_probe_urls_isolated_from_journey(
                journey_urls=self.journey, probe_urls=probe
            )

    def test_refuses_hostile_query_routing(self) -> None:
        probe = {
            "bootstrap": (
                "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe?host=203.0.113.1"
            ),
            "migrator": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "runtime": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "database": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos_hint_probe",
        }
        with self.assertRaises(ValueError):
            self.mod.assert_probe_urls_isolated_from_journey(
                journey_urls=self.journey, probe_urls=probe
            )

    def test_build_safe_probe_env_strips_inherited_journey_dsns(self) -> None:
        probe = {
            "bootstrap": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "migrator": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "runtime": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos_hint_probe",
        }
        inherited = {
            "PATH": "/usr/bin",
            "AIEOS_TEST_DATABASE_URL": self.journey["migrator"],
            "AIEOS_TEST_MIGRATION_RUNTIME_DATABASE_URL": self.journey["migrator"],
            "AIEOS_TEST_WORKFLOW_DISPATCHER_DATABASE_URL": self.journey["runtime"],
            "AIEOS_TEST_EVENT_DISPATCHER_DATABASE_URL": self.journey["bootstrap"],
            "DATABASE_URL": self.journey["migrator"],
            "PK_V1_HINT_E2E_RUNTIME_DATABASE_URL": self.journey["runtime"],
        }
        scrubbed = self.mod.build_safe_probe_subprocess_env(inherited, probe, self.journey)
        self.assertEqual(scrubbed["AIEOS_TEST_DATABASE_URL"], probe["migrator"])
        self.assertNotIn("DATABASE_URL", scrubbed)
        self.assertNotIn("AIEOS_TEST_MIGRATION_RUNTIME_DATABASE_URL", scrubbed)
        self.assertNotIn("AIEOS_TEST_WORKFLOW_DISPATCHER_DATABASE_URL", scrubbed)
        self.assertNotIn("AIEOS_TEST_EVENT_DISPATCHER_DATABASE_URL", scrubbed)
        self.assertNotIn("PK_V1_HINT_E2E_RUNTIME_DATABASE_URL", scrubbed)
        self.assertEqual(scrubbed["PATH"], "/usr/bin")

    def test_scrub_pytest_env_uses_probe_only(self) -> None:
        probe = {
            "bootstrap": "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "migrator": "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos_hint_probe",
            "runtime": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos_hint_probe",
        }
        inherited = {
            "AIEOS_TEST_DATABASE_URL": self.journey["migrator"],
        }
        scrubbed = self.mod.build_safe_probe_subprocess_env(inherited, probe, self.journey)
        self.assertEqual(scrubbed["AIEOS_TEST_DATABASE_URL"], probe["migrator"])
        self.assertIn("aieos_hint_probe", scrubbed["AIEOS_TEST_DATABASE_URL"])


if __name__ == "__main__":
    raise SystemExit(unittest.main())