"""Adversarial tests for sanitized artifact upload audit."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from export_sanitize import EVIDENCE_CONTRACT_VERSION, PACKAGE_SCENARIO_ID


def _minimal_summary(**extra: object) -> dict:
    base = {
        "package_scenario_id": PACKAGE_SCENARIO_ID,
        "evidence_contract_version": EVIDENCE_CONTRACT_VERSION,
        "sanitized_evidence_ok": False,
        "ledger_row_count": 67,
        "tier_counts": {
            "NOT_TESTED": 65,
            "DEFERRED_BY_ADR": 2,
        },
    }
    base.update(extra)
    return base


LOCAL_OWNED_CONTAINER_ID = (
    "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef"
)


def _ci_db_exported(role: str) -> dict:
    name = "aieos-pk-v1-hint-e2e-pg" if role == "primary" else "aieos-pk-v1-hint-e2e-pg-probe"
    return {
        "package_scenario_id": PACKAGE_SCENARIO_ID,
        "role": role,
        "postgres_major": 18,
        "migration_head": "a360s010005",
        "started_container": False,
        "host_port": 5432,
        "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
        "container_name": name,
        "bootstrap_ok": True,
    }


def _local_db_exported(role: str) -> dict:
    port = 55439 if role == "primary" else 55440
    name = "aieos-pk-v1-hint-e2e-pg" if role == "primary" else "aieos-pk-v1-hint-e2e-pg-probe"
    return {
        "package_scenario_id": PACKAGE_SCENARIO_ID,
        "role": role,
        "postgres_major": 18,
        "migration_head": "a360s010005",
        "started_container": True,
        "host_port": port,
        "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
        "container_name": name,
        "container_id_prefix": LOCAL_OWNED_CONTAINER_ID[:12].lower(),
        "bootstrap_ok": True,
    }


def _full_fixture() -> dict:
    return {
        "package_scenario_id": PACKAGE_SCENARIO_ID,
        "scenario_id": PACKAGE_SCENARIO_ID,
        "backend_pin_sha": "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa",
        "migration_head": "a360s010005",
        "openapi_authority_sha": "0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22",
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "content_id": "00000000-0000-0000-0000-000000000002",
        "version_id": "00000000-0000-0000-0000-000000000003",
        "work_id": "00000000-0000-0000-0000-000000000004",
        "class_ref": "class-5a",
        "q_correct_id": "q-correct",
        "q_incorrect_id": "q-incorrect",
        "q_unanswered_id": "q-unanswered",
        "q_open_id": "q-open",
        "obj_demonstrated_id": "obj-demonstrated",
        "obj_not_yet_id": "obj-not-yet",
        "obj_insufficient_id": "obj-insufficient",
        "evaluation_policy_id": "aieos.learner_assessment.deterministic",
        "evaluation_policy_version": 1,
        "stewardship_state": "APPROVED",
        "shared_database": False,
        "seed_ok": True,
    }


class AuditSanitizedArtifactsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.script_dir = Path(__file__).resolve().parent
        self.audit = self.script_dir / "audit_sanitized_artifacts.py"

    def _run_audit(self, root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(self.audit), "--upload-audit"],
            env={
                **os.environ,
                "PK_V1_HINT_E2E_SANITIZED_DIR": str(root),
            },
            capture_output=True,
            text=True,
        )

    def test_rejects_nested_private_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            private = root / "private"
            private.mkdir()
            (private / "answers.txt").write_text("student answer text", encoding="utf-8")
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            payload = json.loads(proc.stdout.strip())
            self.assertEqual(payload.get("code"), "NESTED_DIRECTORY")
            self.assertNotIn("student answer", proc.stdout)

    def test_rejects_marker_free_narrative_in_content_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary(sanitized_evidence_ok=True)), encoding="utf-8"
            )
            fixture = _full_fixture()
            fixture["content_id"] = "The student wrote a paragraph about home"
            (root / "fixture-sanitized.json").write_text(
                json.dumps(fixture), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            code = json.loads(proc.stdout.strip()).get("code")
            self.assertEqual(code, "CONTENT_ID_GRAMMAR")
            self.assertNotIn("student wrote", proc.stdout)

    def test_rejects_narrative_in_github_sha(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            summary = _minimal_summary(github_sha="student answer text without marker")
            (root / "evidence-summary.json").write_text(
                json.dumps(summary), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(
                json.loads(proc.stdout.strip()).get("code"),
                "GITHUB_SHA_GRAMMAR",
            )

    def test_rejects_unknown_key_without_echoing_secret(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            summary = _minimal_summary()
            summary["supersecret_student_answer"] = "hidden"
            (root / "evidence-summary.json").write_text(
                json.dumps(summary), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(json.loads(proc.stdout.strip()).get("code"), "UNKNOWN_KEY")
            self.assertNotIn("supersecret", proc.stdout)
            self.assertNotIn("hidden", proc.stdout)

    def test_rejects_invalid_backend_pin_length(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(
                    _minimal_summary(
                        backend_pin_sha="not-a-valid-40-character-git-sha-value"
                    )
                ),
                encoding="utf-8",
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(
                json.loads(proc.stdout.strip()).get("code"),
                "BACKEND_PIN_SHA_GRAMMAR",
            )

    def test_rejects_bool_as_evaluation_policy_version(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            fixture = _full_fixture()
            fixture["evaluation_policy_version"] = True
            (root / "fixture-sanitized.json").write_text(
                json.dumps(fixture), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(
                json.loads(proc.stdout.strip()).get("code"),
                "EVALUATION_POLICY_VERSION_TYPE",
            )

    def test_rejects_invalid_stewardship_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            fixture = _full_fixture()
            fixture["stewardship_state"] = "published"
            (root / "fixture-sanitized.json").write_text(
                json.dumps(fixture), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(
                json.loads(proc.stdout.strip()).get("code"),
                "STEWARDSHIP_STATE_GRAMMAR",
            )

    def test_rejects_empty_nested_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            (root / "empty-nested").mkdir()
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(json.loads(proc.stdout.strip()).get("code"), "NESTED_DIRECTORY")

    def test_rejects_symlink_to_outside(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            outside = Path(tmp) / "outside-secret.txt"
            outside.write_text("secret", encoding="utf-8")
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            (root / "leak.json").symlink_to(outside)
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            code = json.loads(proc.stdout.strip()).get("code")
            self.assertIn(code, ("SYMLINK_ENTRY", "UNALLOWED_ARTIFACT_FILE"))

    def test_rejects_trace_zip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "trace.zip").write_text("{}", encoding="utf-8")
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(json.loads(proc.stdout.strip()).get("code"), "FORBIDDEN_ARTIFACT_TYPE")

    def test_rejects_malformed_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text("{not-json", encoding="utf-8")
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(json.loads(proc.stdout.strip()).get("code"), "MALFORMED_JSON")

    def test_rejects_secret_marker(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            summary = _minimal_summary(attempt_run_id="dev-student-a")
            (root / "evidence-summary.json").write_text(
                json.dumps(summary), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(
                json.loads(proc.stdout.strip()).get("code"),
                "CREDENTIAL_MARKER_IN_ARTIFACT",
            )

    def test_accepts_early_failure_summary_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            payload = json.loads(proc.stdout.strip())
            self.assertTrue(payload.get("audit_ok"))
            self.assertTrue(payload.get("partial_bundle"))
            self.assertFalse(payload.get("e2e_pass_claim"))

    def test_rejects_marker_free_answer_like_class_ref(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            fixture = _full_fixture()
            fixture["class_ref"] = "Jamie"
            (root / "fixture-sanitized.json").write_text(
                json.dumps(fixture), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(
                json.loads(proc.stdout.strip()).get("code"),
                "CLASS_REF_MISMATCH",
            )

    def test_rejects_ci_db_with_container_prefix(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(_minimal_summary()), encoding="utf-8"
            )
            bad = _ci_db_exported("primary")
            bad["container_id_prefix"] = "a1b2c3d4e5f6"
            (root / "db-report-sanitized.json").write_text(
                json.dumps(bad), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 1)
            self.assertEqual(
                json.loads(proc.stdout.strip()).get("code"),
                "CONTAINER_PREFIX_WHEN_NOT_STARTED",
            )

    def test_accepts_local_owned_db_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(
                    _minimal_summary(
                        sanitized_evidence_ok=True,
                        has_fixture=True,
                        has_db_report=True,
                        has_probe_db_report=True,
                    )
                ),
                encoding="utf-8",
            )
            (root / "fixture-sanitized.json").write_text(
                json.dumps(_full_fixture()), encoding="utf-8"
            )
            (root / "db-report-sanitized.json").write_text(
                json.dumps(_local_db_exported("primary")), encoding="utf-8"
            )
            (root / "probe-db-report-sanitized.json").write_text(
                json.dumps(_local_db_exported("probe")), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)

    def test_accepts_complete_safe_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "sanitized"
            root.mkdir()
            (root / "evidence-summary.json").write_text(
                json.dumps(
                    _minimal_summary(
                        sanitized_evidence_ok=True,
                        has_fixture=True,
                        has_db_report=True,
                        has_probe_db_report=True,
                    )
                ),
                encoding="utf-8",
            )
            (root / "fixture-sanitized.json").write_text(
                json.dumps(_full_fixture()), encoding="utf-8"
            )
            (root / "db-report-sanitized.json").write_text(
                json.dumps(_ci_db_exported("primary")), encoding="utf-8"
            )
            (root / "probe-db-report-sanitized.json").write_text(
                json.dumps(_ci_db_exported("probe")), encoding="utf-8"
            )
            proc = self._run_audit(root)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            payload = json.loads(proc.stdout.strip())
            self.assertTrue(payload.get("audit_ok"))
            self.assertFalse(payload.get("partial_bundle"))


if __name__ == "__main__":
    raise SystemExit(unittest.main())