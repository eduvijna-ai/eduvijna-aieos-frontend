"""Allowlisted export self-tests — must not emit secrets."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest


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


if __name__ == "__main__":
    raise SystemExit(unittest.main())