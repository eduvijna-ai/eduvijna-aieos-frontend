"""Discriminating tests for post-teardown sanitized evidence verification."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class VerifySanitizedEvidenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.script_dir = Path(__file__).resolve().parent
        self.repo_root = self.script_dir.parents[1]
        self.verifier = self.script_dir / "verify_sanitized_evidence.py"

    def _run(self, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        run_env = os.environ.copy()
        if env:
            run_env.update(env)
        return subprocess.run(
            [sys.executable, str(self.verifier), *args],
            cwd=self.repo_root,
            env=run_env,
            capture_output=True,
            text=True,
        )

    def test_preflight_schema_ok(self) -> None:
        proc = self._run("--preflight-schema")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        payload = json.loads(proc.stdout.strip())
        self.assertTrue(payload.get("preflight_ok"))

    def test_require_e2e_evidence_without_attempt_is_not_executed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(Path(tmp) / "sanitized"),
                },
            )
            self.assertEqual(proc.returncode, 0)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "E2E_NOT_EXECUTED")
            self.assertIsNone(payload.get("sanitized_verify_ok"))

    def test_require_e2e_evidence_rejects_missing_summary_after_attempt(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            status = tmp_path / "pk-v1-hint-e2e-attempt-status.json"
            status.write_text(
                json.dumps({"attempted": True, "finished": True, "child_exit": 0}),
                encoding="utf-8",
            )
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(tmp_path / "sanitized"),
                },
            )
            # Attempt status is under repo tmp; copy approach — write to repo tmp
            repo_tmp = self.repo_root / "tmp"
            repo_tmp.mkdir(exist_ok=True)
            attempt = repo_tmp / "pk-v1-hint-e2e-attempt-status.json"
            attempt.write_text(status.read_text(encoding="utf-8"), encoding="utf-8")
            try:
                proc = self._run(
                    "--require-e2e-evidence",
                    env={
                        "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                        "PK_V1_HINT_E2E_SANITIZED_DIR": str(tmp_path / "sanitized"),
                    },
                )
                self.assertEqual(proc.returncode, 1, proc.stdout)
                payload = json.loads(proc.stdout.strip())
                self.assertEqual(payload.get("code"), "MISSING_EVIDENCE_SUMMARY")
            finally:
                attempt.unlink(missing_ok=True)

    def test_require_e2e_evidence_accepts_complete_summary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = tmp_path / "sanitized"
            out_dir.mkdir()
            summary = {
                "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
                "sanitized_evidence_ok": True,
                "ledger_row_count": 67,
                "tier_counts": {"NOT_TESTED": 65, "DEFERRED_BY_ADR": 2},
                "has_fixture": True,
                "has_db_report": True,
                "has_probe_db_report": True,
            }
            (out_dir / "evidence-summary.json").write_text(
                json.dumps(summary), encoding="utf-8"
            )
            repo_tmp = self.repo_root / "tmp"
            repo_tmp.mkdir(exist_ok=True)
            attempt = repo_tmp / "pk-v1-hint-e2e-attempt-status.json"
            attempt.write_text(
                json.dumps(
                    {
                        "attempted": True,
                        "finished": True,
                        "child_exit": 0,
                        "sanitized_export_ok": True,
                    }
                ),
                encoding="utf-8",
            )
            try:
                proc = self._run(
                    "--require-e2e-evidence",
                    env={
                        "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                        "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    },
                )
                self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
                payload = json.loads(proc.stdout.strip())
                self.assertTrue(payload.get("sanitized_verify_ok"))
            finally:
                attempt.unlink(missing_ok=True)

    def test_require_e2e_evidence_rejects_credential_marker(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = tmp_path / "sanitized"
            out_dir.mkdir()
            summary = {
                "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
                "sanitized_evidence_ok": True,
                "ledger_row_count": 67,
                "tier_counts": {},
                "has_fixture": True,
                "has_db_report": True,
                "has_probe_db_report": False,
            }
            (out_dir / "evidence-summary.json").write_text(
                json.dumps(summary), encoding="utf-8"
            )
            (out_dir / "unsafe.json").write_text(
                json.dumps({"dsn": "postgresql://aieos_bootstrap:aieos_test@127.0.0.1/aieos"}),
                encoding="utf-8",
            )
            repo_tmp = self.repo_root / "tmp"
            repo_tmp.mkdir(exist_ok=True)
            attempt = repo_tmp / "pk-v1-hint-e2e-attempt-status.json"
            attempt.write_text(
                json.dumps({"attempted": True, "finished": True, "child_exit": 0}),
                encoding="utf-8",
            )
            try:
                proc = self._run(
                    "--require-e2e-evidence",
                    env={
                        "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                        "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    },
                )
                self.assertEqual(proc.returncode, 1)
                payload = json.loads(proc.stdout.strip())
                self.assertEqual(payload.get("code"), "CREDENTIAL_MARKER_IN_SANITIZED")
            finally:
                attempt.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(unittest.main())