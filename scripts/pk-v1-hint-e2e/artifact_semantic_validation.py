"""Structured semantic grammars for pk-v1-hint sanitized artifact fields."""

from __future__ import annotations

import re
import uuid
from typing import Any

from export_sanitize import (
    ALLOWED_EVIDENCE_TIERS,
    CI_PG_HOST_PORT,
    LOCAL_PRIMARY_PG_HOST_PORT,
    LOCAL_PROBE_PG_HOST_PORT,
    PACKAGE_SCENARIO_ID,
)

EXPECTED_BACKEND_PIN_SHA = "5bbc09bc895407b71a61f9ba86a7209ff9c10ffa"
EXPECTED_OPENAPI_AUTHORITY_SHA = (
    "0061BCF6065FAFA184F196829A87AF98ADEDFCE6B633D45704141A5B48045D22"
)
EXPECTED_MIGRATION_HEAD = "a360s010005"

_RE_SHA40 = re.compile(r"^[0-9a-f]{40}$")
_RE_SHA64 = re.compile(r"^[0-9A-F]{64}$")
_RE_OPAQUE_ID = re.compile(r"^[a-zA-Z0-9._:-]{1,96}$")
_RE_CONTAINER_ID_PREFIX = re.compile(r"^[0-9a-fA-F]{12}$")
_RE_CONTAINER_NAME = re.compile(
    r"^(aieos-pk-v1-hint-e2e-pg(-probe)?|pk-v1-hint-(primary|probe))$"
)
_RE_QUESTION_OR_OBJ_ID = re.compile(
    r"^(q-[a-z0-9-]+|q[a-z0-9-]*|obj-[a-z0-9-]+|o[0-9]+)$",
    re.IGNORECASE,
)
_RE_EVAL_POLICY_ID = re.compile(r"^aieos\.[a-z0-9_.-]+$", re.IGNORECASE)
_RE_ATTEMPT_RUN_ID = re.compile(
    r"^(?:[0-9]+-[0-9]+|local-[0-9]{10,20}|[a-zA-Z0-9._:-]{1,64})$"
)

_STEWARDSHIP_STATES = frozenset(
    {
        "DRAFT",
        "IN_REVIEW",
        "APPROVED",
        "CHANGES_REQUESTED",
        "REJECTED",
    }
)

_HOST_PORT_MIN = 1024
_HOST_PORT_MAX = 65535

EXPECTED_CLASS_REF = "class-5a"
EXPECTED_EVALUATION_POLICY_ID = "aieos.learner_assessment.deterministic"
EXPECTED_EVALUATION_POLICY_VERSION = 1

_FIXTURE_QUESTION_IDS = {
    "q_correct_id": "q-correct",
    "q_incorrect_id": "q-incorrect",
    "q_unanswered_id": "q-unanswered",
    "q_open_id": "q-open",
}
_FIXTURE_OBJECTIVE_IDS = {
    "obj_demonstrated_id": "obj-demonstrated",
    "obj_not_yet_id": "obj-not-yet",
    "obj_insufficient_id": "obj-insufficient",
}


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def _validate_opaque_id(value: Any, code: str) -> str | None:
    if not isinstance(value, str):
        return f"{code}_TYPE"
    if not _RE_OPAQUE_ID.fullmatch(value):
        return code
    return None


def _validate_uuid_only(value: Any, code: str) -> str | None:
    if not isinstance(value, str):
        return f"{code}_TYPE"
    if not _is_uuid(value):
        return code
    return None


def validate_backend_pin_sha(value: Any) -> str | None:
    if not isinstance(value, str) or not _RE_SHA40.fullmatch(value):
        return "BACKEND_PIN_SHA_GRAMMAR"
    if value != EXPECTED_BACKEND_PIN_SHA:
        return "BACKEND_PIN_SHA_MISMATCH"
    return None


def validate_openapi_authority_sha(value: Any) -> str | None:
    if not isinstance(value, str) or not _RE_SHA64.fullmatch(value):
        return "OPENAPI_SHA_GRAMMAR"
    if value != EXPECTED_OPENAPI_AUTHORITY_SHA:
        return "OPENAPI_SHA_MISMATCH"
    return None


def validate_migration_head(value: Any) -> str | None:
    if value != EXPECTED_MIGRATION_HEAD:
        return "MIGRATION_HEAD_MISMATCH"
    return None


def validate_package_scenario_id(value: Any) -> str | None:
    if value != PACKAGE_SCENARIO_ID:
        return "PACKAGE_SCENARIO_MISMATCH"
    return None


def validate_github_sha(value: Any) -> str | None:
    if not isinstance(value, str) or not _RE_SHA40.fullmatch(value):
        return "GITHUB_SHA_GRAMMAR"
    return None


def validate_attempt_run_id(value: Any) -> str | None:
    if not isinstance(value, str) or not _RE_ATTEMPT_RUN_ID.fullmatch(value):
        return "ATTEMPT_RUN_ID_GRAMMAR"
    return None


def validate_role(value: Any) -> str | None:
    if value not in ("primary", "probe"):
        return "DB_ROLE_GRAMMAR"
    return None


def validate_postgres_major(value: Any) -> str | None:
    if value != 18:
        return "POSTGRES_MAJOR_MISMATCH"
    return None


def validate_strict_bool(value: Any, code: str) -> str | None:
    if value is not True and value is not False:
        return f"{code}_TYPE"
    return None


def validate_host_port(value: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return "HOST_PORT_TYPE"
    if value < _HOST_PORT_MIN or value > _HOST_PORT_MAX:
        return "HOST_PORT_RANGE"
    return None


def validate_container_name(value: Any) -> str | None:
    if not isinstance(value, str) or not _RE_CONTAINER_NAME.fullmatch(value):
        return "CONTAINER_NAME_GRAMMAR"
    return None


def validate_container_id_prefix(value: Any) -> str | None:
    if not isinstance(value, str) or not _RE_CONTAINER_ID_PREFIX.fullmatch(value):
        return "CONTAINER_ID_PREFIX_GRAMMAR"
    return None


def validate_scenario_id(value: Any) -> str | None:
    if value != PACKAGE_SCENARIO_ID:
        return "SCENARIO_ID_MISMATCH"
    return None


def validate_stewardship_state(value: Any) -> str | None:
    if value not in _STEWARDSHIP_STATES:
        return "STEWARDSHIP_STATE_GRAMMAR"
    return None


def validate_evaluation_policy_version(value: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return "EVALUATION_POLICY_VERSION_TYPE"
    if value < 0:
        return "EVALUATION_POLICY_VERSION_RANGE"
    return None


def validate_bound_question_id(field_key: str, value: Any) -> str | None:
    expected = _FIXTURE_QUESTION_IDS.get(field_key)
    code = field_key.upper()
    if expected is None:
        return f"{code}_UNKNOWN"
    if not isinstance(value, str):
        return f"{code}_TYPE"
    if value != expected:
        return f"{code}_MISMATCH"
    return None


def validate_bound_objective_id(field_key: str, value: Any) -> str | None:
    expected = _FIXTURE_OBJECTIVE_IDS.get(field_key)
    code = field_key.upper()
    if expected is None:
        return f"{code}_UNKNOWN"
    if not isinstance(value, str):
        return f"{code}_TYPE"
    if value != expected:
        return f"{code}_MISMATCH"
    return None


def validate_class_ref(value: Any) -> str | None:
    if not isinstance(value, str):
        return "CLASS_REF_TYPE"
    if value != EXPECTED_CLASS_REF:
        return "CLASS_REF_MISMATCH"
    return None


def validate_summary_fields(obj: dict[str, Any], *, require_authority_pins: bool) -> str | None:
    err = validate_package_scenario_id(obj.get("package_scenario_id"))
    if err:
        return err
    if not isinstance(obj.get("sanitized_evidence_ok"), bool):
        return "SANITIZED_EVIDENCE_OK_TYPE"
    tier_counts = obj.get("tier_counts")
    if tier_counts is not None:
        if not isinstance(tier_counts, dict):
            return "TIER_COUNTS_TYPE"
        total = 0
        for key, value in tier_counts.items():
            if not isinstance(key, str) or key not in ALLOWED_EVIDENCE_TIERS:
                return "TIER_COUNTS_KEY"
            if not isinstance(value, int) or value < 0:
                return "TIER_COUNTS_VALUE"
            total += value
        if require_authority_pins and total != 67:
            return "TIER_COUNTS_SUM"
    for key in ("ledger_row_count", "generated_at_ms"):
        if key in obj:
            if not isinstance(obj[key], int):
                return f"{key}_TYPE"
            if obj[key] < 0:
                return f"{key}_RANGE"
    for key in ("has_fixture", "has_db_report", "has_probe_db_report"):
        if key in obj and not isinstance(obj[key], bool):
            return f"{key}_TYPE"
    optional_pin_keys = (
        "attempt_run_id",
        "github_sha",
        "backend_pin_sha",
        "openapi_authority_sha",
        "migration_head",
    )
    for key in optional_pin_keys:
        if key not in obj:
            continue
        value = obj[key]
        if key == "attempt_run_id":
            err = validate_attempt_run_id(value)
        elif key == "github_sha":
            err = validate_github_sha(value)
        elif key == "backend_pin_sha":
            err = validate_backend_pin_sha(value)
        elif key == "openapi_authority_sha":
            err = validate_openapi_authority_sha(value)
        else:
            err = validate_migration_head(value)
        if err:
            return err
    if obj.get("evidence_contract_version") != 1:
        return "EVIDENCE_CONTRACT_VERSION"
    return None


def validate_db_fields(obj: dict[str, Any], *, role: str) -> str | None:
    checks = [
        validate_package_scenario_id(obj.get("package_scenario_id")),
        validate_role(obj.get("role")),
        validate_postgres_major(obj.get("postgres_major")),
        validate_migration_head(obj.get("migration_head")),
        validate_backend_pin_sha(obj.get("backend_pin_sha")),
        validate_strict_bool(obj.get("bootstrap_ok"), "BOOTSTRAP_OK"),
    ]
    for err in checks:
        if err:
            return err
    if obj.get("role") != role:
        return "DB_ROLE_MISMATCH"
    if obj.get("bootstrap_ok") is not True:
        return "BOOTSTRAP_NOT_OK"
    if "started_container" in obj:
        err = validate_strict_bool(obj.get("started_container"), "STARTED_CONTAINER")
        if err:
            return err
    if "host_port" in obj:
        err = validate_host_port(obj.get("host_port"))
        if err:
            return err
        port = obj.get("host_port")
        started = obj.get("started_container")
        if started is False and port != CI_PG_HOST_PORT:
            return "HOST_PORT_CI_MISMATCH"
        if started is True:
            expected = (
                LOCAL_PROBE_PG_HOST_PORT if role == "probe" else LOCAL_PRIMARY_PG_HOST_PORT
            )
            if port != expected:
                return "HOST_PORT_OWNED_MISMATCH"
    started = obj.get("started_container")
    if started is False and "container_id_prefix" in obj:
        return "CONTAINER_PREFIX_WHEN_NOT_STARTED"
    if started is True and "container_id_prefix" not in obj:
        return "MISSING_CONTAINER_PREFIX"
    if "container_name" in obj:
        err = validate_container_name(obj.get("container_name"))
        if err:
            return err
    if "container_id_prefix" in obj:
        err = validate_container_id_prefix(obj.get("container_id_prefix"))
        if err:
            return err
    return None


def validate_fixture_fields(obj: dict[str, Any]) -> str | None:
    checks = [
        validate_package_scenario_id(obj.get("package_scenario_id")),
        validate_scenario_id(obj.get("scenario_id")),
        validate_backend_pin_sha(obj.get("backend_pin_sha")),
        validate_migration_head(obj.get("migration_head")),
        validate_openapi_authority_sha(obj.get("openapi_authority_sha")),
        validate_strict_bool(obj.get("seed_ok"), "SEED_OK"),
    ]
    for err in checks:
        if err:
            return err
    if obj.get("seed_ok") is not True:
        return "SEED_NOT_OK"
    for key in ("tenant_id", "content_id", "version_id", "work_id"):
        if key in obj:
            err = _validate_uuid_only(obj.get(key), f"{key.upper()}_GRAMMAR")
            if err:
                return err
    if "class_ref" in obj:
        err = validate_class_ref(obj.get("class_ref"))
        if err:
            return err
    for key in _FIXTURE_QUESTION_IDS:
        if key in obj:
            err = validate_bound_question_id(key, obj.get(key))
            if err:
                return err
    for key in _FIXTURE_OBJECTIVE_IDS:
        if key in obj:
            err = validate_bound_objective_id(key, obj.get(key))
            if err:
                return err
    if "evaluation_policy_id" in obj:
        if obj.get("evaluation_policy_id") != EXPECTED_EVALUATION_POLICY_ID:
            return "EVALUATION_POLICY_ID_MISMATCH"
    if "evaluation_policy_version" in obj:
        if obj.get("evaluation_policy_version") != EXPECTED_EVALUATION_POLICY_VERSION:
            return "EVALUATION_POLICY_VERSION_MISMATCH"
        err = validate_evaluation_policy_version(obj.get("evaluation_policy_version"))
        if err:
            return err
    if "stewardship_state" in obj:
        err = validate_stewardship_state(obj.get("stewardship_state"))
        if err:
            return err
    if "shared_database" in obj:
        err = validate_strict_bool(obj.get("shared_database"), "SHARED_DATABASE")
        if err:
            return err
    return None