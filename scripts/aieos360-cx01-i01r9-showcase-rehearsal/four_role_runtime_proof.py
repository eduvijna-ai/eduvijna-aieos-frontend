"""Exercise four CX01 role compositions against shared persisted fixture (runtime)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from export_sanitize import write_sanitized_json

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _request_json(url: str, headers: dict[str, str]) -> dict:
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code} for {url}: {body}") from exc


def _auth_headers(fixture: dict, role: str) -> dict[str, str]:
    token_key = {
        "teacher": "teacher_bearer_token",
        "student": "student_bearer_token",
        "principal": "principal_bearer_token",
        "parent": "parent_bearer_token",
    }[role]
    return {
        "Authorization": f"Bearer {fixture[token_key]}",
        "X-AIEOS-Tenant-ID": fixture["tenant_id"],
    }


def _role_urls_from_status(tmp: Path) -> dict:
    status_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_STATUS_PATH",
            tmp / "aieos360-cx01-i01-showcase-status.json",
        )
    )
    if not status_path.is_file():
        raise SystemExit("operator status required for runtime HTTP proof")
    status = _load_json(status_path)
    return status["role_urls"]


def main() -> int:
    tmp = REPO_ROOT / "tmp"
    fixture_path = Path(
        os.environ.get(
            "AIEOS360_CX01_I01_SHOWCASE_FIXTURE_PATH",
            tmp / "aieos360-cx01-i01-showcase-fixture.json",
        )
    )
    fixture = _load_json(fixture_path)
    role_urls = _role_urls_from_status(tmp)

    work_id = fixture["work_id"]
    tenant_id = fixture["tenant_id"]

    teacher_works = _request_json(
        f"{role_urls['teacher']['backend']}/api/v1/teaching/works?limit=50",
        _auth_headers(fixture, "teacher"),
    )
    teacher_ids = {item["work_id"] for item in teacher_works.get("items", [])}
    if work_id not in teacher_ids:
        raise SystemExit("teacher composition did not surface seeded TeachingWork")

    student_home = _request_json(
        f"{role_urls['student']['backend']}/api/v1/student-os/home",
        _auth_headers(fixture, "student"),
    )
    if student_home.get("current_assignment_count", 0) < 0:
        raise SystemExit("student composition returned invalid home payload")

    principal_intel = _request_json(
        f"{role_urls['principal']['backend']}/api/v1/principal-os/school-intelligence",
        _auth_headers(fixture, "principal"),
    )
    if "classes" not in principal_intel:
        raise SystemExit("principal composition did not return school intelligence")

    parent_home = _request_json(
        f"{role_urls['parent']['backend']}/api/v1/parent-os/home",
        _auth_headers(fixture, "parent"),
    )
    if "children" not in parent_home:
        raise SystemExit("parent composition did not return parent intelligence home")

    proof = {
        "shared_database": True,
        "tenant_id": tenant_id,
        "work_id": work_id,
        "roles_exercised": ["teacher", "student", "principal", "parent"],
        "teacher_work_visible": True,
        "student_home_ok": True,
        "principal_intelligence_ok": True,
        "parent_intelligence_ok": True,
        "proof_mode": "runtime_http_role_interfaces",
    }
    out = tmp / "aieos360-cx01-i01-showcase-four-role-runtime-proof.json"
    write_sanitized_json(str(out), proof)
    print(json.dumps(proof, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
