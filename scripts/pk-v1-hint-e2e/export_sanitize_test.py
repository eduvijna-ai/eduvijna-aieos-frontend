"""Allowlisted export self-tests — must not emit secrets."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


def _import_sanitize():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    import export_sanitize as mod

    return mod


class ExportSanitizeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.mod = _import_sanitize()

    def test_fixture_export_drops_bearers_and_urls(self) -> None:
        raw = {
            "author_bearer_token": "pk-v1-hint-e2e-author",
            "runtime_database_url": (
                "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:55439/aieos"
            ),
            "content_id": "00000000-0000-0000-0000-000000000001",
            "scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
            "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
        }
        exported = self.mod.build_fixture_export(raw)
        text = json.dumps(exported)
        self.assertNotIn("author_bearer_token", exported)
        self.assertNotIn("aieos_test", text)
        self.assertNotIn("pk-v1-hint-e2e-author", text)
        self.assertEqual(exported["content_id"], raw["content_id"])

    def test_unknown_key_dropped_from_db_report(self) -> None:
        raw = {
            "postgres_major": 18,
            "migration_head": "a360s010005",
            "started_container": False,
            "host_port": "5432",
            "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
            "runtime_database_url": "postgresql+psycopg://aieos_runtime:secret@127.0.0.1:55439/aieos",
            "surprise_secret": "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos",
        }
        exported = self.mod.build_db_report_export(raw)
        self.assertNotIn("surprise_secret", exported)
        self.assertNotIn("runtime_database_url", exported)
        text = json.dumps(exported)
        self.assertNotIn("aieos_test", text)

    def test_secret_marker_scan_rejects_bearer_alias(self) -> None:
        with self.assertRaises(ValueError):
            self.mod.assert_export_has_no_secrets(
                '{"scenario_id":"pk-v1-hint-e2e-author"}'
            )

    def test_malformed_tier_counts_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.mod.build_summary_export(
                {
                    "sanitized_evidence_ok": True,
                    "tier_counts": {"x": {"nested": 1}},
                }
            )

    def test_unknown_tier_key_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.mod.build_summary_export(
                {
                    "sanitized_evidence_ok": True,
                    "tier_counts": {"SECRET_BEARER_TIER": 1},
                }
            )

    def test_allowlisted_tier_counts_accepted(self) -> None:
        exported = self.mod.build_summary_export(
            {
                "sanitized_evidence_ok": True,
                "tier_counts": {"NOT_TESTED": 65, "DEFERRED_BY_ADR": 2},
            }
        )
        self.assertEqual(exported["tier_counts"]["NOT_TESTED"], 65)

    def test_ci_primary_production_report_export_passes_audit(self) -> None:
        script_dir = Path(__file__).resolve().parent
        raw = {
            "postgres_major": 18,
            "migration_head": "a360s010005",
            "started_container": False,
            "host_port": "5432",
            "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
            "container_name": "aieos-pk-v1-hint-e2e-pg",
            "container_id": None,
            "runtime_database_url": "postgresql+psycopg://aieos_runtime:redacted@127.0.0.1:5432/aieos",
        }
        exported = self.mod.build_db_report_export(raw)
        self.assertEqual(exported["host_port"], 5432)
        self.assertNotIn("container_id_prefix", exported)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root / "db-report-sanitized.json"
            self.mod.write_sanitized_json(str(path), raw)
            body = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(body["host_port"], 5432)
            (root / "evidence-summary.json").write_text(
                json.dumps(
                    {
                        "package_scenario_id": self.mod.PACKAGE_SCENARIO_ID,
                        "evidence_contract_version": self.mod.EVIDENCE_CONTRACT_VERSION,
                        "sanitized_evidence_ok": False,
                        "ledger_row_count": 67,
                        "tier_counts": {"NOT_TESTED": 65, "DEFERRED_BY_ADR": 2},
                    }
                ),
                encoding="utf-8",
            )
            proc = subprocess.run(
                [sys.executable, str(script_dir / "audit_sanitized_artifacts.py"), "--upload-audit"],
                env={**os.environ, "PK_V1_HINT_E2E_SANITIZED_DIR": str(root)},
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)

    def test_local_primary_production_report_shape(self) -> None:
        cid = (
            "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef"
        )
        raw = {
            "postgres_major": 18,
            "migration_head": "a360s010005",
            "started_container": True,
            "host_port": "55439",
            "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
            "container_name": "aieos-pk-v1-hint-e2e-pg",
            "container_id": cid,
        }
        exported = self.mod.build_db_report_export(raw)
        self.assertEqual(exported["host_port"], 55439)
        self.assertEqual(exported["container_id_prefix"], cid[:12].lower())

    def test_rejects_string_port_with_whitespace(self) -> None:
        raw = {
            "postgres_major": 18,
            "migration_head": "a360s010005",
            "started_container": False,
            "host_port": " 5432",
            "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
        }
        with self.assertRaises(ValueError):
            self.mod.build_db_report_export(raw)

    def test_rejects_foreign_host_port(self) -> None:
        raw = {
            "postgres_major": 18,
            "migration_head": "a360s010005",
            "started_container": True,
            "host_port": "55432",
            "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
            "container_id": "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
        }
        with self.assertRaises(ValueError):
            self.mod.build_db_report_export(raw)


if __name__ == "__main__":
    raise SystemExit(unittest.main())