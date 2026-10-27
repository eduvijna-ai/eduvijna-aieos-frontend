#!/usr/bin/env python3
"""NON_PRODUCTION contract: showcase Teacher fake gateway supports PreparationKitV1."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from pydantic import BaseModel


def _fail(message: str) -> int:
    print(f"fake_gateway_preparation_kit.proof: FAIL — {message}", file=sys.stderr)
    return 1


class _UnsupportedProofOutput(BaseModel):
    marker: str = "unsupported"


def main() -> int:
    backend = Path(os.environ.get("AIEOS_BACKEND_ROOT", ""))
    if not backend.is_dir():
        return _fail("AIEOS_BACKEND_ROOT must point at pinned Backend checkout")

    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))
    script_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_dir))

    from aieos.domains.education.preparation_kit_v1 import PreparationKitV1
    from aieos.domains.education.worksheet_v1 import WorksheetV1
    from aieos.platform.ai.gateway import (
        ModelGenerationFailed,
        StructuredGenerationRequest,
    )
    from serve_teacher_app import _compose_model_gateway

    gateway, provider_id, _, _ = _compose_model_gateway("DETERMINISTIC")
    if provider_id != "fake":
        return _fail(f"expected fake provider, got {provider_id}")

    kit_request = StructuredGenerationRequest(
        capability_id="generate_preparation_kit",
        instructions="proof",
        input_text="proof",
        output_type=PreparationKitV1,
        max_output_tokens=4096,
    )
    kit_result = gateway.generate_structured(kit_request)
    if not isinstance(kit_result.parsed_output, PreparationKitV1):
        return _fail("PreparationKitV1 generation returned unexpected type")
    worksheet_questions = kit_result.parsed_output.worksheet.questions
    if len(worksheet_questions) < 6:
        return _fail("expected at least six worksheet questions")
    if worksheet_questions[0].id != "ws-1":
        return _fail("expected ws-1 as first worksheet question")
    if worksheet_questions[0].question_type != "multiple_choice":
        return _fail("ws-1 must be multiple_choice")

    worksheet_request = StructuredGenerationRequest(
        capability_id="worksheet",
        instructions="proof",
        input_text="proof",
        output_type=WorksheetV1,
        max_output_tokens=4096,
    )
    worksheet_result = gateway.generate_structured(worksheet_request)
    if not isinstance(worksheet_result.parsed_output, WorksheetV1):
        return _fail("WorksheetV1 generation returned unexpected type")

    unsupported_request = StructuredGenerationRequest(
        capability_id="unsupported-proof",
        instructions="proof",
        input_text="proof",
        output_type=_UnsupportedProofOutput,
        max_output_tokens=128,
    )
    try:
        gateway.generate_structured(unsupported_request)
    except ModelGenerationFailed:
        pass
    else:
        return _fail("unsupported output_type must fail closed")

    print("fake_gateway_preparation_kit.proof: pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
