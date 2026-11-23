"""Sanitized export self-test — must not emit secrets."""

from __future__ import annotations

import json
import os
import sys
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

    def test_redacts_fixture_bearers_and_urls(self) -> None:
        raw = {
            "author_bearer_token": "pk-v1-hint-e2e-author",
            "runtime_database_url": (
                "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:55439/aieos"
            ),
            "content_id": "00000000-0000-0000-0000-000000000001",
        }
        sanitized = self.mod.sanitize_object(raw)
        text = json.dumps(sanitized)
        self.assertEqual(sanitized["author_bearer_token"], self.mod.REDACTED)
        self.assertNotIn("aieos_test@", text)
        self.assertNotIn("pk-v1-hint-e2e-author", text)
        self.assertIn("runtime_database_descriptor", sanitized)

    def test_scan_for_leaks_detects_credential_urls(self) -> None:
        leaks = self.mod.scan_for_leaks(
            "postgresql+psycopg://aieos_runtime:aieos_test@127.0.0.1:5432/aieos"
        )
        self.assertTrue(leaks)


if __name__ == "__main__":
    raise SystemExit(unittest.main())