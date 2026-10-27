#!/usr/bin/env python3
"""NON_PRODUCTION contract: showcase Teacher fake gateway supports PreparationKitV1."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    backend = Path(os.environ.get("AIEOS_BACKEND_ROOT", ""))
    if not backend.is_dir():
        print("fake_gateway_preparation_kit.proof: SKIP (AIEOS_BACKEND_ROOT unset)")
        return 0

    sys.path.insert(0, str(backend / "src"))
    sys.path.insert(0, str(backend))
    script_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(script_dir))

    from aieos.domains.education.preparation_kit_v1 import PreparationKitV1
    from aieos.domains.education.worksheet_v1 import WorksheetV1
    from aieos.platform.ai.gateway import StructuredGenerationRequest
    from serve_teacher_app import _compose_model_gateway

    gateway, provider_id, model_id, _ = _compose_model_gateway("DETERMINISTIC")
    assert provider_id == "fake"

    kit_request = StructuredGenerationRequest(
        capability_id="generate_preparation_kit",
        instructions="proof",
        input_text="proof",
        output_type=PreparationKitV1,
        max_output_tokens=4096,
    )
    kit_result = gateway.generate_structured(kit_request)
    assert isinstance(kit_result.parsed_output, PreparationKitV1)
    worksheet_questions = kit_result.parsed_output.worksheet.questions
    assert len(worksheet_questions) >= 4
    assert worksheet_questions[0].id == "ws-1"
    assert worksheet_questions[0].question_type == "multiple_choice"

    worksheet_request = StructuredGenerationRequest(
        capability_id="worksheet",
        instructions="proof",
        input_text="proof",
        output_type=WorksheetV1,
        max_output_tokens=4096,
    )
    worksheet_result = gateway.generate_structured(worksheet_request)
    assert isinstance(worksheet_result.parsed_output, WorksheetV1)

    print("fake_gateway_preparation_kit.proof: pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
