"""Prove sanitized export survives coordinated raw teardown."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class EmitSanitizedTeardownTest(unittest.TestCase):
    def test_sanitized_survives_raw_cleanup(self) -> None:
        script_dir = Path(__file__).resolve().parent
        repo_root = script_dir.parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            fixture = {
                "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
                "teacher_class_ref": "class-test",
                "question_count": 6,
            }
            db_report = {
                "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
                "bootstrap_database_url": "postgresql+psycopg://aieos_bootstrap:***@127.0.0.1:5432/aieos",
                "runtime_database_url": "postgresql+psycopg://aieos_runtime:***@127.0.0.1:5432/aieos",
            }
            (tmp_path / "pk-v1-hint-e2e-fixture.json").write_text(
                json.dumps(fixture), encoding="utf-8"
            )
            (tmp_path / "pk-v1-hint-e2e-db.json").write_text(
                json.dumps(db_report), encoding="utf-8"
            )

            env = os.environ.copy()
            env["PK_V1_HINT_E2E_FIXTURE_PATH"] = str(tmp_path / "pk-v1-hint-e2e-fixture.json")
            env["PK_V1_HINT_E2E_DB_REPORT"] = str(tmp_path / "pk-v1-hint-e2e-db.json")
            env["PK_V1_HINT_E2E_SANITIZED_DIR"] = str(tmp_path / "pk-v1-hint-e2e-sanitized")

            proc = subprocess.run(
                [sys.executable, str(script_dir / "emit_sanitized_evidence.py")],
                cwd=repo_root,
                env=env,
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)

            summary_path = tmp_path / "pk-v1-hint-e2e-sanitized" / "evidence-summary.json"
            self.assertTrue(summary_path.is_file())
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            self.assertTrue(summary.get("has_fixture"))
            self.assertTrue(summary.get("sanitized_evidence_ok"))

            for name in ("pk-v1-hint-e2e-fixture.json", "pk-v1-hint-e2e-db.json"):
                (tmp_path / name).unlink(missing_ok=True)

            self.assertFalse((tmp_path / "pk-v1-hint-e2e-fixture.json").exists())
            self.assertTrue(summary_path.is_file())


if __name__ == "__main__":
    raise SystemExit(unittest.main())