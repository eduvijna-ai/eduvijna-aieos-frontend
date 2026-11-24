"""Prove sanitized export survives coordinated raw teardown and partial failures."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from emit_sanitized_evidence import build_evidence_summary
from export_sanitize import PACKAGE_SCENARIO_ID
from sp02a_ledger import parse_sp02a_ledger_doc, repo_ledger_doc


class EmitSanitizedTeardownTest(unittest.TestCase):
    def setUp(self) -> None:
        self.script_dir = Path(__file__).resolve().parent
        self.repo_root = self.script_dir.parents[1]

    def _run_emit(self, tmp_path: Path, env_extra: dict | None = None) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["PK_V1_HINT_E2E_FIXTURE_PATH"] = str(tmp_path / "pk-v1-hint-e2e-fixture.json")
        env["PK_V1_HINT_E2E_DB_REPORT"] = str(tmp_path / "pk-v1-hint-e2e-db.json")
        env["PK_V1_HINT_E2E_PROBE_DB_REPORT"] = str(tmp_path / "pk-v1-hint-e2e-probe-db.json")
        env["PK_V1_HINT_E2E_SANITIZED_DIR"] = str(tmp_path / "pk-v1-hint-e2e-sanitized")
        if env_extra:
            env.update(env_extra)
        return subprocess.run(
            [sys.executable, str(self.script_dir / "emit_sanitized_evidence.py")],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
        )

    def _audit(self, sanitized_dir: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(self.script_dir / "audit_sanitized_artifacts.py"), "--upload-audit"],
            env={**os.environ, "PK_V1_HINT_E2E_SANITIZED_DIR": str(sanitized_dir)},
            capture_output=True,
            text=True,
        )

    def test_sanitized_survives_raw_cleanup(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            fixture = {
                "package_scenario_id": PACKAGE_SCENARIO_ID,
                "scenario_id": PACKAGE_SCENARIO_ID,
                "teacher_class_ref": "class-test",
                "question_count": 6,
            }
            db_report = {
                "postgres_major": 18,
                "migration_head": "a360s010005",
                "started_container": False,
                "host_port": "5432",
                "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
                "container_name": "aieos-pk-v1-hint-e2e-pg",
                "container_id": None,
                "bootstrap_database_url": "postgresql+psycopg://aieos_bootstrap:***@127.0.0.1:5432/aieos",
            }
            (tmp_path / "pk-v1-hint-e2e-fixture.json").write_text(
                json.dumps(fixture), encoding="utf-8"
            )
            (tmp_path / "pk-v1-hint-e2e-db.json").write_text(
                json.dumps(db_report), encoding="utf-8"
            )

            proc = self._run_emit(tmp_path)
            self.assertEqual(proc.returncode, 0, proc.stderr)

            summary_path = tmp_path / "pk-v1-hint-e2e-sanitized" / "evidence-summary.json"
            self.assertTrue(summary_path.is_file())
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            self.assertTrue(summary.get("has_fixture"))
            self.assertTrue(summary.get("sanitized_evidence_ok"))

            for name in ("pk-v1-hint-e2e-fixture.json", "pk-v1-hint-e2e-db.json"):
                (tmp_path / name).unlink(missing_ok=True)

            self.assertTrue(summary_path.is_file())

    def test_partial_failure_summary_only_passes_upload_audit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            proc = self._run_emit(tmp_path)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            sanitized = tmp_path / "pk-v1-hint-e2e-sanitized"
            summary = json.loads(
                (sanitized / "evidence-summary.json").read_text(encoding="utf-8")
            )
            self.assertFalse(summary.get("has_fixture"))
            self.assertFalse(summary.get("has_db_report"))
            self.assertNotIn("backend_pin_sha", summary)
            self.assertNotIn("attempt_run_id", summary)
            audit = self._audit(sanitized)
            self.assertEqual(audit.returncode, 0, audit.stdout + audit.stderr)
            payload = json.loads(audit.stdout.strip())
            self.assertTrue(payload.get("partial_bundle"))

    def test_build_evidence_summary_omits_invalid_pins(self) -> None:
        rows, counts = parse_sp02a_ledger_doc(repo_ledger_doc(self.repo_root))
        summary = build_evidence_summary(
            scenario_rows=rows,
            tier_counts=counts,
            has_fixture=False,
            has_db_report=False,
            has_probe_db_report=False,
            attempt_run_id="The student wrote an answer",
            github_sha="not-a-git-sha",
            backend_pin_sha=None,
            openapi_authority_sha=None,
            migration_head=None,
            generated_at_ms=1_700_000_000_000,
        )
        self.assertNotIn("attempt_run_id", summary)
        self.assertNotIn("github_sha", summary)
        self.assertNotIn("backend_pin_sha", summary)


if __name__ == "__main__":
    raise SystemExit(unittest.main())