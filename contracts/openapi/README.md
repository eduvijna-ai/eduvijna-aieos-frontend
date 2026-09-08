# Consumer OpenAPI snapshot (NON-AUTHORITATIVE)

This directory holds a **consumer snapshot** of the AIEOS HTTP contract for frontend development and type generation.

## Authority

- **Authoritative OpenAPI** lives in the backend repository:
  - Repo: `eduvijna-aieos-backend`
  - Path: `contracts/openapi/aieos-v1.json`
- The file `aieos-v1.consumer-snapshot.json` in this frontend repo is **NON-AUTHORITATIVE**.
  It must not be treated as the source of truth for API behaviour.

## Snapshot provenance (AIEOS360-S01-I04)

| Field | Value |
|-------|--------|
| Source repo | `eduvijna-aieos-backend` |
| Source path | `contracts/openapi/aieos-v1.json` |
| Source SHA | `921d35eb08890a4e1d86cf95daf9d38cdfc4a13c` |
| Authoritative OpenAPI SHA-256 | `4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330` |
| Consumer file | `contracts/openapi/aieos-v1.consumer-snapshot.json` |
| Consumer file SHA-256 | `4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330` |

Operations consumed by this frontend at this SHA (Student OS / Learning):

| Operation ID | Method | Path |
|--------------|--------|------|
| `student_os_home` | GET | `/api/v1/student-os/home` |
| `student_os_assignment_list` | GET | `/api/v1/student-os/assignments` |
| `student_os_assignment_get` | GET | `/api/v1/student-os/assignments/{assignment_id}` |
| `learning_attempt_start` | POST | `/api/v1/learning/assignments/{assignment_id}/attempts` |
| `learning_attempt_get` | GET | `/api/v1/learning/attempts/{attempt_id}` |
| `learning_attempt_save_responses` | PUT | `/api/v1/learning/attempts/{attempt_id}/responses` |
| `learning_attempt_submit` | POST | `/api/v1/learning/attempts/{attempt_id}/actions/submit` |

Also retained from prior slices (Provider Aggregator):

| Operation ID | Method | Path |
|--------------|--------|------|
| `platform_ai_providers_get` | GET | `/api/v1/platform/ai/providers` |

Also retained from prior slices (Contextual AI Assistant):

| Operation ID | Method | Path |
|--------------|--------|------|
| `teacher_os_assistant_respond` | POST | `/api/v1/teacher-os/assistant` |

Also retained from prior slices (Teacher Memory / Settings preferences):

| Operation ID | Method | Path |
|--------------|--------|------|
| `teacher_os_memory_get` | GET | `/api/v1/teacher-os/memory` |
| `teacher_os_memory_create` | POST | `/api/v1/teacher-os/memory` |
| `teacher_os_memory_update` | PUT | `/api/v1/teacher-os/memory` |

Also retained from prior slices (Library):

| Operation ID | Method | Path |
|--------------|--------|------|
| `teacher_os_library_list` | GET | `/api/v1/teacher-os/library` |
| `teacher_os_library_get` | GET | `/api/v1/teacher-os/library/{content_id}` |
| `teacher_os_library_version_get` | GET | `/api/v1/teacher-os/library/{content_id}/versions/{version_id}` |

Also retained from prior slices (Improve / remediation create):

| Operation ID | Method | Path |
|--------------|--------|------|
| `teaching_work_from_classroom_assessment_create` | POST | `/api/v1/teaching/works/from-classroom-assessment` |

Also retained from prior slices (ClassroomAssessment / Assess UX):

| Operation ID | Method | Path |
|--------------|--------|------|
| `assessment_classroom_list` | GET | `/api/v1/assessment/classroom-assessments` |
| `assessment_classroom_record` | POST | `/api/v1/assessment/classroom-assessments` |
| `assessment_classroom_get` | GET | `/api/v1/assessment/classroom-assessments/{assessment_id}` |
| `assessment_classroom_correct` | POST | `/api/v1/assessment/classroom-assessments/{assessment_id}/actions/correct` |
| `assessment_classroom_void` | POST | `/api/v1/assessment/classroom-assessments/{assessment_id}/actions/void` |

Also retained from prior slices (TeachingExecution / Teach UX):

| Operation ID | Method | Path |
|--------------|--------|------|
| `teacher_os_teach_context_get` | GET | `/api/v1/teacher-os/teach/context` |
| `teaching_execution_list` | GET | `/api/v1/teaching/executions` |
| `teaching_execution_start` | POST | `/api/v1/teaching/executions` |
| `teaching_execution_get` | GET | `/api/v1/teaching/executions/{execution_id}` |
| `teaching_execution_complete` | POST | `/api/v1/teaching/executions/{execution_id}/actions/complete` |
| `teaching_execution_cancel` | POST | `/api/v1/teaching/executions/{execution_id}/actions/cancel` |
| `teaching_execution_observation_create` | POST | `/api/v1/teaching/executions/{execution_id}/observations` |
| `teaching_execution_observation_correct` | PATCH | `/api/v1/teaching/executions/{execution_id}/observations/{observation_id}` |

Also retained from prior slices (Assignment UX):

| Operation ID | Method | Path |
|--------------|--------|------|
| `teacher_os_school_context_classes_list` | GET | `/api/v1/teacher-os/school-context/classes` |
| `teaching_assignment_create` | POST | `/api/v1/teaching/assignments` |
| `teaching_assignment_list` | GET | `/api/v1/teaching/assignments` |
| `teaching_assignment_get` | GET | `/api/v1/teaching/assignments/{assignment_id}` |
| `teaching_assignment_due_update` | PATCH | `/api/v1/teaching/assignments/{assignment_id}` |
| `teaching_assignment_close` | POST | `/api/v1/teaching/assignments/{assignment_id}/actions/close` |
| `teaching_assignment_cancel` | POST | `/api/v1/teaching/assignments/{assignment_id}/actions/cancel` |

Also retained from earlier slices:

| Operation ID | Method | Path |
|--------------|--------|------|
| `teacher_os_today_mission` | GET | `/api/v1/teacher-os/today/mission` |
| `teaching_work_create` | POST | `/api/v1/teaching/works` |
| `teaching_work_list` | GET | `/api/v1/teaching/works` |
| `teaching_work_get` | GET | `/api/v1/teaching/works/{work_id}` |
| `teaching_work_refine` | PATCH | `/api/v1/teaching/works/{work_id}` |
| `teaching_work_generate` | POST | `/api/v1/teaching/works/{work_id}/actions/generate` |
| `teaching_work_prepare` | POST | `/api/v1/teaching/works/{work_id}/actions/prepare` |
| `teaching_work_artifacts_list` | GET | `/api/v1/teaching/works/{work_id}/artifacts` |
| `teacher_os_review_queue_list` | GET | `/api/v1/teacher-os/review-queue` |
| `teacher_os_review_queue_get` | GET | `/api/v1/teacher-os/review-queue/{content_id}/versions/{version_id}` |

### Previous snapshots

| Slice | Source SHA |
|-------|------------|
| TOS-CX01-I03 | `ac19985b6da3ac98569f0c39cf661b99002fa748` |
| TOS-DEV10-I03R3 pre-CI-fix | `85b3aee257ebfbf70ca1954aa20ae320b150ec47` |
| TOS-DEV10-I03R1 | `2f034cfe3073db3b7da42f67bf778ea7da5eda4c` |
| TOS-DEV10-I03 | `79d50f04773ceeb1eca91f7b6561cee2ef2f3151` |
| TOS-DEV10-I02 | `01c2c54a43d95427aaa3e9a81ceaafe033581743` |
| TOS-DEV09-I03 | `62733e3ad0d48887f3cd1e1a4486839170a5d651` |
| TOS-DEV08-I03 | `1fe28f4fd1a2a2070aa69d67daa49cd53ba5820d` |
| TOS-DEV07-I03 | `551e46e004233421746e4df2789c07367702528b` |
| TOS-DEV06-I04 | `06e05277e73e0c71172cae4904efb37d771c3fad` |
| TOS-DEV04-I09 | `a461e8ac20e556469a9517b54b6dd6d17f48ee90` |
| TOS-DEV03R4 Lane A | `3001722e400daca757e22828c8ac843aad6e962f` |
| TOS-DEV02 Lane A | `f62da1f461957cb443ee422d3a343d15c9ca6640` |
| TOS-DEV03R1 Lane A | `164e49577bdddef021a2fdee24f983962b4e87b8` |
| TOS-DEV03R2 Lane A | `b3f69972e6e981eaa57f1f6539467d8b1c61817e` |
| TOS-DEV03R3 Lane A | `e03101dde1703adf9698c5f5fb8b87137a176599` |
| TOS-DEV01 Lane A | `bcfd5eb054ef07c30219cfae0ca9ccd7279ea8c0` |

## Sync

Use:

```bash
pnpm sync:openapi
```

Point it at a sibling backend checkout and pin the expected SHA with environment
overrides when the default location or pinned SHA is not current:

```bash
AIEOS_BACKEND_ROOT=../eduvijna-aieos-backend \
AIEOS_BACKEND_OPENAPI_SHA=921d35eb08890a4e1d86cf95daf9d38cdfc4a13c \
  pnpm sync:openapi
```

Verify the consumer file hash after sync:

```bash
# Expected: 4691D6BADA2157D436435BB5CCDD6797EA670D1A87543D42CA39A478F940F330
```

See `scripts/sync-openapi-snapshot.mjs` for how to refresh from a known backend checkout/SHA.
Then regenerate types:

```bash
pnpm generate:api-types
```
