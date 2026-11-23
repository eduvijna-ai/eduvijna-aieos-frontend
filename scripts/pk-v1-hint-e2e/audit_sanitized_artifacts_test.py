"""Tests for sanitized artifact upload audit."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from export_sanitize import EVIDENCE_CONTRACT_VERSION


class AuditSanitizedArtifactsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.script_dir = Path(__file__).resolve().parent
        self.audit = self.script_dir / "audit_sanitized_artifacts.py"

    def test_rejects_forbidden_filename(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "trace.zip").write_text("{}", encoding="utf-8")
            proc = subprocess.run(
                [sys.executable, str(self.audit), "--upload-audit"],
                env={
                    **dict(__import__("os").environ),
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(root),
                },
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 1)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "FORBIDDEN_ARTIFACT_TYPE")

    def test_accepts_allowlisted_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(
                    {
                        "evidence_contract_version": EVIDENCE_CONTRACT_VERSION,
                        "sanitized_evidence_ok": True,
                    }
                ),
                encoding="utf-8",
            )
            proc = subprocess.run(
                [sys.executable, str(self.audit), "--upload-audit"],
                env={
                    **dict(__import__("os").environ),
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(root),
                },
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            payload = json.loads(proc.stdout.strip())
            self.assertTrue(payload.get("audit_ok"))


if __name__ == "__main__":
    raise SystemExit(unittest.main())