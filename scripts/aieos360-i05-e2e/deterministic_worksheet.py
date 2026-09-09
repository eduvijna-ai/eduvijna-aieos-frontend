"""Deterministic learner-facing worksheet for AIEOS360-S01-I05-E2E.

Exact outcomes expected after deliberate student responses + teacher ensure:

  q-correct     → CORRECT
  q-incorrect   → INCORRECT
  q-unanswered  → UNANSWERED
  q-open        → OPEN_RESPONSE_UNEVALUATED

Objective rollups (exact-version completeness):

  obj-demonstrated  → DEMONSTRATED_ON_SUBMITTED_ITEMS (q-correct only)
  obj-not-yet       → NOT_YET_DEMONSTRATED_ON_SUBMITTED_ITEMS (q-incorrect only)
  obj-insufficient  → INSUFFICIENT_EVIDENCE (unanswered + open response)
"""

from __future__ import annotations

from aieos.domains.education.worksheet_v1 import WorksheetV1

WORKSHEET_TITLE = "I05 Deterministic Evidence Worksheet"

Q_CORRECT_ID = "q-correct"
Q_INCORRECT_ID = "q-incorrect"
Q_UNANSWERED_ID = "q-unanswered"
Q_OPEN_ID = "q-open"

OBJ_DEMONSTRATED_ID = "obj-demonstrated"
OBJ_NOT_YET_ID = "obj-not-yet"
OBJ_INSUFFICIENT_ID = "obj-insufficient"


def deterministic_i05_worksheet_payload() -> dict[str, object]:
    return {
        "title": WORKSHEET_TITLE,
        "teacher_summary": "Deterministic I05 evidence worksheet for cross-role E2E.",
        "learning_objectives": [
            {
                "id": OBJ_DEMONSTRATED_ID,
                "text": "Identify one-half correctly on submitted items",
            },
            {
                "id": OBJ_NOT_YET_ID,
                "text": "Compare fractions carefully on submitted items",
            },
            {
                "id": OBJ_INSUFFICIENT_ID,
                "text": "Explain fraction reasoning with complete evidence",
            },
        ],
        "instructions": "Answer Q-CORRECT and Q-INCORRECT. Leave Q-UNANSWERED blank. Write a short answer for Q-OPEN.",
        "questions": [
            {
                "id": Q_CORRECT_ID,
                "prompt": "Q-CORRECT: Which fraction equals one half?",
                "question_type": "multiple_choice",
                "difficulty": "easy",
                "bloom_level": "remember",
                "objective_ids": [OBJ_DEMONSTRATED_ID],
                "options": ["1/2", "1/3", "1/4", "2/3"],
                "answer": "1/2",
                "explanation": "One half is written 1/2.",
                "visual_description": None,
            },
            {
                "id": Q_INCORRECT_ID,
                "prompt": "Q-INCORRECT: True or false — 1/2 is greater than 3/4?",
                "question_type": "true_false",
                "difficulty": "medium",
                "bloom_level": "understand",
                "objective_ids": [OBJ_NOT_YET_ID],
                "options": [],
                "answer": "false",
                "explanation": "1/2 is less than 3/4.",
                "visual_description": None,
            },
            {
                "id": Q_UNANSWERED_ID,
                "prompt": "Q-UNANSWERED: Which fraction equals one third?",
                "question_type": "multiple_choice",
                "difficulty": "easy",
                "bloom_level": "remember",
                "objective_ids": [OBJ_INSUFFICIENT_ID],
                "options": ["1/2", "1/3", "1/4", "2/3"],
                "answer": "1/3",
                "explanation": "One third is written 1/3.",
                "visual_description": None,
            },
            {
                "id": Q_OPEN_ID,
                "prompt": "Q-OPEN: In your own words, explain why 1/2 equals 2/4.",
                "question_type": "short_answer",
                "difficulty": "medium",
                "bloom_level": "understand",
                "objective_ids": [OBJ_INSUFFICIENT_ID],
                "options": [],
                "answer": "same size parts",
                "explanation": "Open response remains unevaluated under current policy.",
                "visual_description": None,
            },
            {
                "id": "q-filler-a",
                "prompt": "Q-FILLER-A: Which fraction equals one quarter?",
                "question_type": "multiple_choice",
                "difficulty": "easy",
                "bloom_level": "remember",
                "objective_ids": [OBJ_DEMONSTRATED_ID],
                "options": ["1/2", "1/3", "1/4", "2/3"],
                "answer": "1/4",
                "explanation": "WorksheetV1 requires at least six questions.",
                "visual_description": None,
            },
            {
                "id": "q-filler-b",
                "prompt": "Q-FILLER-B: True or false — 2/4 equals 1/2?",
                "question_type": "true_false",
                "difficulty": "easy",
                "bloom_level": "remember",
                "objective_ids": [OBJ_DEMONSTRATED_ID],
                "options": [],
                "answer": "true",
                "explanation": "WorksheetV1 requires at least six questions.",
                "visual_description": None,
            },
        ],
        "teacher_notes": "I05 E2E deterministic fixture — do not alter question ids.",
    }


def deterministic_i05_worksheet_model() -> WorksheetV1:
    return WorksheetV1.model_validate(deterministic_i05_worksheet_payload())
