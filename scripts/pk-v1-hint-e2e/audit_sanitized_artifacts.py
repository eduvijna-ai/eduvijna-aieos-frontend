"""Privacy audit for PK-V1-HINT sanitized CI artifact upload (not an E2E_PASS claim)."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from export_sanitize import EVIDENCE_CONTRACT_VERSION

_ALLOWED_FILES = frozenset(
    {
        "evidence-summary.json",
        "fixture-sanitized.json",
        "db-report-sanitized.json",
        "probe-db-report-sanitized.json",
    }
)

_UNSAFE = re.compile(
    r"(postgresql[^\s\"']*://[^\s\"']+@|aieos_test@|Bearer\s+|dev-student-a|pk-v1-hint-e2e-(author|reviewer|publisher))",
    re.IGNORECASE,
)

_FORBIDDEN_SUFFIXES = (".html", ".zip", ".png", ".webm", ".trace", ".log")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _sanitized_dir() -> Path:
    return Path(
        os.environ.get(
            "PK_V1_HINT_E2E_SANITIZED_DIR",
            _repo_root() / "tmp" / "pk-v1-hint-e2e-sanitized",
        )
    )


def audit_sanitized_dir(out_dir: Path) -> tuple[bool, str, dict]:
    if not out_dir.is_dir():
        return False, "MISSING_SANITIZED_DIR", {"audit_ok": False}

    files = sorted(p.name for p in out_dir.iterdir() if p.is_file())
    if not files:
        return False, "EMPTY_SANITIZED_DIR", {"audit_ok": False}

    for name in files:
        if any(name.endswith(suffix) for suffix in _FORBIDDEN_SUFFIXES):
            return False, "FORBIDDEN_ARTIFACT_TYPE", {"audit_ok": False, "file": name}
        if name not in _ALLOWED_FILES:
            return False, "UNALLOWED_ARTIFACT_FILE", {"audit_ok": False, "file": name}

    summary_path = out_dir / "evidence-summary.json"
    if not summary_path.is_file():
        return False, "MISSING_EVIDENCE_SUMMARY", {"audit_ok": False}

    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False, "MALFORMED_EVIDENCE_SUMMARY", {"audit_ok": False}

    if summary.get("evidence_contract_version") != EVIDENCE_CONTRACT_VERSION:
        return False, "UNSUPPORTED_EVIDENCE_CONTRACT", {"audit_ok": False}

    leaks: list[str] = []
    for path in sorted(out_dir.rglob("*")):
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if _UNSAFE.search(text):
            leaks.append(path.name)

    if leaks:
        return False, "CREDENTIAL_MARKER_IN_ARTIFACT", {
            "audit_ok": False,
            "paths": leaks,
        }

    return True, "UPLOAD_SAFE", {
        "audit_ok": True,
        "files": files,
        "upload_safe": True,
        "e2e_pass_claim": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--upload-audit",
        action="store_true",
        help="Allowlisted privacy audit for CI artifact upload only.",
    )
    args = parser.parse_args()
    if not args.upload_audit:
        print(json.dumps({"audit_ok": False, "code": "MODE_REQUIRED"}))
        return 2

    ok, code, payload = audit_sanitized_dir(_sanitized_dir())
    payload = {"code": code, **payload}
    print(json.dumps(payload))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())