"""Discriminating tests for post-teardown sanitized evidence verification."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from export_sanitize import EVIDENCE_CONTRACT_VERSION
from sp02a_ledger import parse_sp02a_ledger_doc, repo_ledger_doc
from verify_sanitized_evidence import (
    EXPECTED_BACKEND_PIN_SHA,
    EXPECTED_MIGRATION_HEAD,
    EXPECTED_OPENAPI_AUTHORITY_SHA,
    evaluate_require_e2e_evidence,
)


class VerifySanitizedEvidenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.script_dir = Path(__file__).resolve().parent
        self.repo_root = self.script_dir.parents[1]
        self.verifier = self.script_dir / "verify_sanitized_evidence.py"
        self._repo_attempt = self.repo_root / "tmp" / "pk-v1-hint-e2e-attempt-status.json"
        self._repo_attempt_backup: bytes | None = None
        if self._repo_attempt.is_file():
            self._repo_attempt_backup = self._repo_attempt.read_bytes()

    def tearDown(self) -> None:
        if self._repo_attempt_backup is None:
            self._repo_attempt.unlink(missing_ok=True)
        else:
            self._repo_attempt.write_bytes(self._repo_attempt_backup)

    def _committed_tiers(self) -> dict[str, int]:
        _, tiers = parse_sp02a_ledger_doc(repo_ledger_doc(self.repo_root))
        return tiers

    def _run(self, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        run_env = os.environ.copy()
        run_env["PK_V1_HINT_E2E_VERIFIER_TEST_INJECT"] = "1"
        if env:
            run_env.update(env)
        return subprocess.run(
            [sys.executable, str(self.verifier), *args],
            cwd=self.repo_root,
            env=run_env,
            capture_output=True,
            text=True,
        )

    def _write_bundle(
        self,
        root: Path,
        *,
        has_fixture: bool = True,
        has_db: bool = True,
        has_probe: bool = True,
        ledger_row_count: int = 67,
        tier_counts: dict[str, int] | None = None,
        extra_summary: dict[str, object] | None = None,
    ) -> Path:
        out_dir = root / "sanitized"
        out_dir.mkdir(parents=True, exist_ok=True)
        tiers = tier_counts if tier_counts is not None else self._committed_tiers()
        summary = {
            "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
            "sanitized_evidence_ok": True,
            "ledger_row_count": ledger_row_count,
            "tier_counts": tiers,
            "has_fixture": has_fixture,
            "has_db_report": has_db,
            "has_probe_db_report": has_probe,
            "evidence_contract_version": EVIDENCE_CONTRACT_VERSION,
            "generated_at_ms": 9_000_000_000_000,
            "attempt_run_id": "test-run-1",
            "github_sha": "abc123",
            "backend_pin_sha": EXPECTED_BACKEND_PIN_SHA,
            "openapi_authority_sha": EXPECTED_OPENAPI_AUTHORITY_SHA,
            "migration_head": EXPECTED_MIGRATION_HEAD,
        }
        if extra_summary:
            summary.update(extra_summary)
        (out_dir / "evidence-summary.json").write_text(
            json.dumps(summary), encoding="utf-8"
        )
        if has_fixture:
            (out_dir / "fixture-sanitized.json").write_text(
                json.dumps(
                    {
                        "package_scenario_id": summary["package_scenario_id"],
                        "scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
                        "backend_pin_sha": EXPECTED_BACKEND_PIN_SHA,
                        "openapi_authority_sha": EXPECTED_OPENAPI_AUTHORITY_SHA,
                        "migration_head": EXPECTED_MIGRATION_HEAD,
                        "seed_ok": True,
                    }
                ),
                encoding="utf-8",
            )
        if has_db:
            (out_dir / "db-report-sanitized.json").write_text(
                json.dumps(
                    {
                        "package_scenario_id": summary["package_scenario_id"],
                        "role": "primary",
                        "postgres_major": 18,
                        "migration_head": EXPECTED_MIGRATION_HEAD,
                        "backend_pin_sha": EXPECTED_BACKEND_PIN_SHA,
                        "bootstrap_ok": True,
                    }
                ),
                encoding="utf-8",
            )
        if has_probe:
            (out_dir / "probe-db-report-sanitized.json").write_text(
                json.dumps(
                    {
                        "package_scenario_id": summary["package_scenario_id"],
                        "role": "probe",
                        "postgres_major": 18,
                        "migration_head": EXPECTED_MIGRATION_HEAD,
                        "backend_pin_sha": EXPECTED_BACKEND_PIN_SHA,
                        "bootstrap_ok": True,
                    }
                ),
                encoding="utf-8",
            )
        return out_dir

    def test_preflight_schema_ok(self) -> None:
        proc = self._run("--preflight-schema")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        payload = json.loads(proc.stdout.strip())
        self.assertTrue(payload.get("preflight_ok"))
        self.assertEqual(payload.get("ledger_row_count"), 67)

    def test_require_e2e_evidence_without_attempt_is_not_executed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(Path(tmp) / "sanitized"),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(Path(tmp) / "missing.json"),
                },
            )
            self.assertEqual(proc.returncode, 0)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "E2E_NOT_EXECUTED")

    def test_require_e2e_rejects_empty_success_claim(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(
                tmp_path,
                has_fixture=False,
                has_db=False,
                has_probe=False,
                ledger_row_count=0,
                tier_counts={},
            )
            attempt = tmp_path / "attempt.json"
            attempt.write_text(
                json.dumps(
                    {
                        "attempted": True,
                        "finished": True,
                        "child_exit": 0,
                        "sanitized_export_ok": True,
                        "lifecycle_teardown_ok": True,
                        "attempt_run_id": "test-run-1",
                        "started_at_ms": 8_000_000_000_000,
                    }
                ),
                encoding="utf-8",
            )
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(attempt),
                },
            )
            self.assertEqual(proc.returncode, 1, proc.stdout)
            payload = json.loads(proc.stdout.strip())
            self.assertFalse(payload.get("sanitized_verify_ok"))

    def test_forged_has_fixture_without_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = tmp_path / "sanitized"
            out_dir.mkdir()
            tiers = self._committed_tiers()
            (out_dir / "evidence-summary.json").write_text(
                json.dumps(
                    {
                        "package_scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
                        "sanitized_evidence_ok": True,
                        "ledger_row_count": 67,
                        "tier_counts": tiers,
                        "has_fixture": True,
                        "has_db_report": False,
                        "has_probe_db_report": False,
                        "evidence_contract_version": EVIDENCE_CONTRACT_VERSION,
                        "generated_at_ms": 9_000_000_000_000,
                        "attempt_run_id": "test-run-1",
                    }
                ),
                encoding="utf-8",
            )
            attempt = tmp_path / "attempt.json"
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
            ok, code, _ = evaluate_require_e2e_evidence(
                json.loads(attempt.read_text(encoding="utf-8")),
                out_dir,
            )
            self.assertFalse(ok)
            self.assertEqual(code, "FORGED_ARTIFACT_FLAG:has_fixture")

    def test_green_complete_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            attempt = {
                "attempted": True,
                "finished": True,
                "child_exit": 0,
                "sanitized_export_ok": True,
                "lifecycle_teardown_ok": True,
                "attempt_run_id": "test-run-1",
                "started_at_ms": 8_000_000_000_000,
                "github_sha": "abc123",
            }
            (tmp_path / "attempt.json").write_text(json.dumps(attempt), encoding="utf-8")
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(
                        tmp_path / "attempt.json"
                    ),
                },
            )
            self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "E2E_PASS")

    def test_child_nonzero_exit_fails_even_with_summary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            attempt = tmp_path / "attempt.json"
            attempt.write_text(
                json.dumps(
                    {
                        "attempted": True,
                        "finished": True,
                        "child_exit": 1,
                        "sanitized_export_ok": True,
                    }
                ),
                encoding="utf-8",
            )
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(attempt),
                },
            )
            self.assertEqual(proc.returncode, 1)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "E2E_FAILED")

    def test_rejects_credential_marker(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            (out_dir / "unsafe.json").write_text(
                json.dumps({"dsn": "postgresql://aieos_bootstrap:aieos_test@127.0.0.1/aieos"}),
                encoding="utf-8",
            )
            attempt = tmp_path / "attempt.json"
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
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(attempt),
                },
            )
            self.assertEqual(proc.returncode, 1)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "CREDENTIAL_MARKER_IN_SANITIZED")

    def test_rejects_wrong_backend_pin(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(
                tmp_path,
                extra_summary={"backend_pin_sha": "deadbeef" * 5},
            )
            attempt = tmp_path / "attempt.json"
            attempt.write_text(
                json.dumps(
                    {
                        "attempted": True,
                        "finished": True,
                        "child_exit": 0,
                        "sanitized_export_ok": True,
                        "attempt_run_id": "test-run-1",
                        "started_at_ms": 8_000_000_000_000,
                    }
                ),
                encoding="utf-8",
            )
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(attempt),
                },
            )
            self.assertEqual(proc.returncode, 1)

    def test_repo_tmp_attempt_unchanged_after_suite(self) -> None:
        before = self._repo_attempt_backup
        after = self._repo_attempt.read_bytes() if self._repo_attempt.is_file() else None
        self.assertEqual(before, after)


if __name__ == "__main__":
    raise SystemExit(unittest.main())