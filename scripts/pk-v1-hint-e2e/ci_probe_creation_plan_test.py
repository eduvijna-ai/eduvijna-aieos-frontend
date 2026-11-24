"""No-Docker CI probe database creation ordering tests."""

from __future__ import annotations

import os
import sys
import unittest


def _import_plan():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    import ci_probe_creation_plan as mod

    return mod


class CiProbeCreationPlanTest(unittest.TestCase):
    def setUp(self) -> None:
        self.mod = _import_plan()

    def _ci_env(self) -> dict[str, str]:
        return {
            "PK_V1_HINT_E2E_PROBE_CI_EXTERNAL_PG": "1",
            "AIEOS_TEST_BOOTSTRAP_DATABASE_URL": (
                "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos"
            ),
            "PK_V1_HINT_E2E_PROBE_BOOTSTRAP_DATABASE_URL": (
                "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe"
            ),
            "PK_V1_HINT_E2E_PROBE_DATABASE_URL": (
                "postgresql+psycopg://aieos_migrator:aieos_test@127.0.0.1:5432/aieos_hint_probe"
            ),
            "PK_V1_HINT_E2E_PROBE_RUNTIME_DATABASE_URL": (
                "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos_hint_probe"
            ),
        }

    def test_admin_targets_journey_db_not_probe(self) -> None:
        plan = self.mod.build_ci_probe_creation_plan(self._ci_env())
        self.assertEqual(plan.probe_database_name, "aieos_hint_probe")
        self.assertIn("/aieos", plan.admin_bootstrap_url)
        self.assertNotIn("aieos_hint_probe", plan.admin_bootstrap_url)

    def test_first_run_orders_admin_before_probe_connect(self) -> None:
        plan = self.mod.build_ci_probe_creation_plan(self._ci_env())
        ops = self.mod.ordered_ci_probe_operations(plan, probe_db_exists=False)
        self.assertEqual(ops[0], "connect_admin_existing_journey_database")
        self.assertEqual(ops[1], "create_probe_database_autocommit")
        self.assertEqual(ops[2], "connect_probe_bootstrap")

    def test_refuses_preexisting_probe_database(self) -> None:
        plan = self.mod.build_ci_probe_creation_plan(self._ci_env())
        with self.assertRaises(self.mod.CiProbeCreationError):
            self.mod.ordered_ci_probe_operations(plan, probe_db_exists=True)

    def test_simulated_bootstrap_never_touches_probe_before_create(self) -> None:
        plan = self.mod.build_ci_probe_creation_plan(self._ci_env())
        seen: list[str] = []

        def record(op: str) -> None:
            seen.append(op)

        self.mod.simulate_ci_probe_bootstrap(plan, probe_db_exists=False, steps=record)
        create_idx = seen.index("create_probe_database_autocommit")
        self.assertNotIn(
            "connect_probe_bootstrap",
            seen[:create_idx],
        )

    def test_refuses_admin_url_pointing_at_probe_db_name(self) -> None:
        env = self._ci_env()
        env["AIEOS_TEST_BOOTSTRAP_DATABASE_URL"] = (
            "postgresql+psycopg://aieos_bootstrap:aieos_test@127.0.0.1:5432/aieos_hint_probe"
        )
        with self.assertRaises(self.mod.CiProbeCreationError):
            self.mod.build_ci_probe_creation_plan(env)


if __name__ == "__main__":
    raise SystemExit(unittest.main())