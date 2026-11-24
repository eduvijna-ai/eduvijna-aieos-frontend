"""Discriminating tests for post-teardown sanitized evidence verification."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from export_sanitize import EVIDENCE_CONTRACT_VERSION
from sp02a_ledger import parse_sp02a_ledger_doc, repo_ledger_doc
from verify_sanitized_evidence import (
    EXPECTED_BACKEND_PIN_SHA,
    EXPECTED_MIGRATION_HEAD,
    EXPECTED_OPENAPI_AUTHORITY_SHA,
    evaluate_require_e2e_evidence,
)

# Synthetic local tests must not inherit real GitHub Actions run identity from the parent process.
_GITHUB_IDENTITY_ENV_KEYS = (
    "GITHUB_ACTIONS",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_SHA",
    "GITHUB_WORKFLOW",
    "GITHUB_REF",
)

_SYNTHETIC_GITHUB_SHA = "abc123def4567890abcdef1234567890abcd1234"
_SYNTHETIC_ATTEMPT_RUN_ID = "test-run-1"


class VerifySanitizedEvidenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.script_dir = Path(__file__).resolve().parent
        self.repo_root = self.script_dir.parents[1]
        self.verifier = self.script_dir / "verify_sanitized_evidence.py"

    def _committed_tiers(self) -> dict[str, int]:
        _, tiers = parse_sp02a_ledger_doc(repo_ledger_doc(self.repo_root))
        return tiers

    def _run(self, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        run_env = {
            k: v
            for k, v in os.environ.items()
            if k not in _GITHUB_IDENTITY_ENV_KEYS
        }
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

    def _evaluate_isolated(
        self,
        attempt: dict[str, object],
        out_dir: Path,
        *,
        ci_env: dict[str, str] | None = None,
    ) -> tuple[bool, str, dict[str, object]]:
        overlay: dict[str, str] = {k: "" for k in _GITHUB_IDENTITY_ENV_KEYS}
        if ci_env:
            overlay.update(ci_env)
        with patch.dict(os.environ, overlay, clear=False):
            return evaluate_require_e2e_evidence(attempt, out_dir)

    def _base_attempt(self, **extra: object) -> dict[str, object]:
        return {
            "attempted": True,
            "finished": True,
            "child_exit": 0,
            "sanitized_export_ok": True,
            "lifecycle_teardown_ok": True,
            "skip_container_teardown": False,
            "attempt_run_id": _SYNTHETIC_ATTEMPT_RUN_ID,
            "started_at_ms": 8_000_000_000_000,
            "github_sha": _SYNTHETIC_GITHUB_SHA,
            **extra,
        }

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
        fixture_extra: dict[str, object] | None = None,
        probe_payload: dict[str, object] | None = None,
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
            "attempt_run_id": _SYNTHETIC_ATTEMPT_RUN_ID,
            "github_sha": _SYNTHETIC_GITHUB_SHA,
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
            fixture = {
                "package_scenario_id": summary["package_scenario_id"],
                "scenario_id": "pk-v1-hint-e2e-learner-hint-vertical",
                "backend_pin_sha": EXPECTED_BACKEND_PIN_SHA,
                "openapi_authority_sha": EXPECTED_OPENAPI_AUTHORITY_SHA,
                "migration_head": EXPECTED_MIGRATION_HEAD,
                "seed_ok": True,
                "content_id": "content-test-1",
                "version_id": "version-test-1",
                "class_ref": "class-test-1",
            }
            if fixture_extra:
                fixture.update(fixture_extra)
            (out_dir / "fixture-sanitized.json").write_text(
                json.dumps(fixture), encoding="utf-8"
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
            probe = probe_payload or {
                "package_scenario_id": summary["package_scenario_id"],
                "role": "probe",
                "postgres_major": 18,
                "migration_head": EXPECTED_MIGRATION_HEAD,
                "backend_pin_sha": EXPECTED_BACKEND_PIN_SHA,
                "bootstrap_ok": True,
            }
            (out_dir / "probe-db-report-sanitized.json").write_text(
                json.dumps(probe), encoding="utf-8"
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

    def test_ci_missing_attempt_after_e2e_step_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "GITHUB_ACTIONS": "true",
                    "PK_V1_HINT_E2E_E2E_STEP_INVOKED": "1",
                    "PK_V1_HINT_E2E_REQUIRE_EVIDENCE": "1",
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(Path(tmp) / "sanitized"),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(Path(tmp) / "missing.json"),
                },
            )
            self.assertEqual(proc.returncode, 1)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "E2E_ATTEMPT_MISSING")

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
            attempt.write_text(json.dumps(self._base_attempt()), encoding="utf-8")
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
                        "attempt_run_id": _SYNTHETIC_ATTEMPT_RUN_ID,
                        "github_sha": _SYNTHETIC_GITHUB_SHA,
                        "backend_pin_sha": EXPECTED_BACKEND_PIN_SHA,
                        "openapi_authority_sha": EXPECTED_OPENAPI_AUTHORITY_SHA,
                        "migration_head": EXPECTED_MIGRATION_HEAD,
                    }
                ),
                encoding="utf-8",
            )
            attempt = self._base_attempt()
            ok, code, _ = self._evaluate_isolated(attempt, out_dir)
            self.assertFalse(ok)
            self.assertEqual(code, "FORGED_ARTIFACT_FLAG:has_fixture")

    def test_green_complete_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            attempt = self._base_attempt()
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

    def test_null_child_exit_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            attempt = self._base_attempt(child_exit=None)
            ok, code, _ = self._evaluate_isolated(attempt, out_dir)
            self.assertFalse(ok)
            self.assertEqual(code, "CHILD_EXIT_NOT_ZERO")

    def test_empty_probe_json_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            (out_dir / "probe-db-report-sanitized.json").write_text("{}", encoding="utf-8")
            attempt = self._base_attempt()
            ok, code, _ = self._evaluate_isolated(attempt, out_dir)
            self.assertFalse(ok)
            self.assertEqual(code, "EMPTY_ARTIFACT:probe-db-report-sanitized.json")

    def test_missing_backend_pin_in_summary_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            summary_path = out_dir / "evidence-summary.json"
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            del summary["backend_pin_sha"]
            summary_path.write_text(json.dumps(summary), encoding="utf-8")
            attempt = self._base_attempt()
            ok, code, _ = self._evaluate_isolated(attempt, out_dir)
            self.assertFalse(ok)
            self.assertIn("INCOMPLETE_EVIDENCE_SUMMARY", code)

    def test_s30_non_deferred_tiers_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bad_tiers = self._committed_tiers()
            bad_tiers["NOT_TESTED"] = bad_tiers.get("NOT_TESTED", 0) + 1
            bad_tiers["DEFERRED_BY_ADR"] = bad_tiers.get("DEFERRED_BY_ADR", 0) - 1
            out_dir = self._write_bundle(tmp_path, tier_counts=bad_tiers)
            attempt = self._base_attempt()
            ok, code, _ = self._evaluate_isolated(attempt, out_dir)
            self.assertFalse(ok)
            self.assertEqual(code, "LEDGER_TIER_COUNTS_MISMATCH_COMMITTED_DOC")

    def test_ci_mode_green_complete_bundle_matching_run_binding(self) -> None:
        ci_sha = "7280bd9fd1e1c8daaba1bb31698871c518b229a4"
        ci_attempt_id = "123456-2"
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(
                tmp_path,
                extra_summary={
                    "attempt_run_id": ci_attempt_id,
                    "github_sha": ci_sha,
                },
            )
            attempt = self._base_attempt(
                attempt_run_id=ci_attempt_id,
                github_sha=ci_sha,
            )
            (tmp_path / "attempt.json").write_text(json.dumps(attempt), encoding="utf-8")
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "GITHUB_ACTIONS": "true",
                    "GITHUB_RUN_ID": "123456",
                    "GITHUB_RUN_ATTEMPT": "2",
                    "GITHUB_SHA": ci_sha,
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

    def test_ci_mode_stale_github_run_attempt_rejected(self) -> None:
        ci_sha = "7280bd9fd1e1c8daaba1bb31698871c518b229a4"
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            attempt = self._base_attempt(github_sha=ci_sha)
            ok, code, _ = self._evaluate_isolated(
                attempt,
                out_dir,
                ci_env={
                    "GITHUB_ACTIONS": "true",
                    "GITHUB_RUN_ID": "123456",
                    "GITHUB_RUN_ATTEMPT": "2",
                    "GITHUB_SHA": ci_sha,
                },
            )
            self.assertFalse(ok)
            self.assertEqual(code, "STALE_GITHUB_RUN_ATTEMPT")

    def test_ci_mode_github_sha_env_mismatch_rejected(self) -> None:
        ci_sha = "7280bd9fd1e1c8daaba1bb31698871c518b229a4"
        other_sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        ci_attempt_id = "123456-2"
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(
                tmp_path,
                extra_summary={
                    "attempt_run_id": ci_attempt_id,
                    "github_sha": ci_sha,
                },
            )
            attempt = self._base_attempt(
                attempt_run_id=ci_attempt_id,
                github_sha=ci_sha,
            )
            ok, code, _ = self._evaluate_isolated(
                attempt,
                out_dir,
                ci_env={
                    "GITHUB_ACTIONS": "true",
                    "GITHUB_RUN_ID": "123456",
                    "GITHUB_RUN_ATTEMPT": "2",
                    "GITHUB_SHA": other_sha,
                },
            )
            self.assertFalse(ok)
            self.assertEqual(code, "GITHUB_SHA_ENV_MISMATCH")

    def test_child_nonzero_exit_fails_even_with_summary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = self._write_bundle(tmp_path)
            attempt = tmp_path / "attempt.json"
            attempt.write_text(json.dumps(self._base_attempt(child_exit=1)), encoding="utf-8")
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
            attempt.write_text(json.dumps(self._base_attempt()), encoding="utf-8")
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
            attempt.write_text(json.dumps(self._base_attempt()), encoding="utf-8")
            proc = self._run(
                "--require-e2e-evidence",
                env={
                    "PK_V1_HINT_E2E_SANITIZED_DIR": str(out_dir),
                    "PK_V1_HINT_E2E_ATTEMPT_STATUS_PATH": str(attempt),
                },
            )
            self.assertEqual(proc.returncode, 1)


if __name__ == "__main__":
    raise SystemExit(unittest.main())