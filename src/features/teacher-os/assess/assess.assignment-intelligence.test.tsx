import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  CONTENT_ID,
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
  VERSION_ID,
  WORK_ID,
  type FetchCall,
} from "@/test/test-utils";

const ASSIGNMENT_ID = "aaaaaaaa-aaaa-7aaa-aaaa-aaaaaaaaaaaa";
const ASSESSMENT_ID = "99999999-9999-7999-8999-999999999999";
const LEARNER_A = "bbbbbbbb-bbbb-7bbb-bbbb-bbbbbbbbbbbb";
const LEARNER_B = "cccccccc-cccc-7ccc-cccc-cccccccccccc";

function sampleAssignment(overrides?: Record<string, unknown>) {
  return {
    assignment_id: ASSIGNMENT_ID,
    teacher_principal_id: "dddddddd-dddd-7ddd-dddd-dddddddddddd",
    content_id: CONTENT_ID,
    content_version_id: VERSION_ID,
    audience_type: "class",
    class_ref: "class-5a",
    audience_display_label: "Grade 5A",
    source_work_id: WORK_ID,
    lifecycle_state: "ACTIVE",
    assigned_at: "2026-09-01T10:00:00Z",
    available_from: "2026-09-01T10:00:00Z",
    due_at: "2026-09-08T10:00:00Z",
    closed_at: null,
    cancelled_at: null,
    aggregate_revision: 0,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function sampleIntelligence(overrides?: Record<string, unknown>) {
  return {
    teaching_assignment_id: ASSIGNMENT_ID,
    class_ref: "class-5a",
    content_id: CONTENT_ID,
    content_version_id: VERSION_ID,
    evaluation_policy_id: "aieos.learner_assessment.deterministic",
    evaluation_policy_version: 1,
    submitted_learner_count: 2,
    evaluated_learner_count: 1,
    learners: [
      {
        learner_principal_id: LEARNER_A,
        submission_id: "11111111-1111-7111-8111-111111111101",
        evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
        evaluation_id: "22222222-2222-7222-8222-222222222201",
        evaluated_at: "2026-09-09T10:00:00Z",
        evaluation_policy_id: "aieos.learner_assessment.deterministic",
        evaluation_policy_version: 1,
        items: [],
        objective_evidence: [],
      },
      {
        learner_principal_id: LEARNER_B,
        submission_id: "11111111-1111-7111-8111-111111111102",
        evaluation_state: "NOT_EVALUATED",
        evaluation_id: null,
        evaluated_at: null,
        evaluation_policy_id: null,
        evaluation_policy_version: null,
        items: [],
        objective_evidence: [],
      },
    ],
    question_distributions: [
      {
        question_id: "q-miss",
        correct: 0,
        incorrect: 1,
        unanswered: 1,
        open_response_unevaluated: 0,
        unevaluated_policy_reject: 0,
      },
    ],
    frequently_missed_questions: [
      { question_id: "q-miss", incorrect_count: 1 },
    ],
    objective_evidence_rollups: [
      {
        objective_id: "obj-1",
        insufficient_evidence: 1,
        demonstrated_on_submitted_items: 0,
        mixed_on_submitted_items: 0,
        not_yet_demonstrated_on_submitted_items: 0,
      },
    ],
    ...overrides,
  };
}

function sampleAssessment(overrides?: Record<string, unknown>) {
  return {
    assessment_id: ASSESSMENT_ID,
    teacher_principal_id: "dddddddd-dddd-7ddd-dddd-dddddddddddd",
    class_ref: "class-5a",
    content_id: CONTENT_ID,
    content_version_id: VERSION_ID,
    class_result_level: "MIXED",
    class_result_note: null,
    lifecycle_state: "RECORDED",
    work_id: WORK_ID,
    execution_id: null,
    assignment_id: ASSIGNMENT_ID,
    aggregate_revision: 0,
    recorded_at: "2026-09-09T11:00:00Z",
    voided_at: null,
    created_at: "2026-09-09T11:00:00Z",
    updated_at: "2026-09-09T11:00:00Z",
    ...overrides,
  };
}

describe("AIEOS360-S01-I05-F1 assignment Assess intelligence", () => {
  it("loads assignment intelligence with GET only (no auto ensure/evaluate)", async () => {
    const calls: FetchCall[] = [];
    stubFetch((call) => {
      calls.push(call);
      if (call.url.endsWith(`/api/v1/teaching/assignments/${ASSIGNMENT_ID}`)) {
        return mockJsonResponse(sampleAssignment());
      }
      if (
        call.url.endsWith(
          `/api/v1/assessment/assignments/${ASSIGNMENT_ID}/intelligence`,
        )
      ) {
        return mockJsonResponse(sampleIntelligence());
      }
      if (call.url.includes("/api/v1/assessment/classroom-assessments")) {
        return mockJsonResponse({ items: [] });
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp(`/teacher-os/assess?assignment_id=${ASSIGNMENT_ID}`);

    expect(
      await screen.findByTestId("assignment-intelligence-panel"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("intelligence-submitted-count")).toHaveTextContent(
      "2",
    );
    expect(screen.getByTestId("intelligence-evaluated-count")).toHaveTextContent(
      "1",
    );
    expect(screen.getByTestId("intelligence-unanswered-count")).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByRole("heading", {
        name: /Frequently missed \(deterministic incorrect only\)/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("frequently-missed-item")).toHaveTextContent(
      "q-miss",
    );
    expect(screen.getByText(/Insufficient evidence/i)).toBeInTheDocument();

    expect(screen.queryByText(/not-submitted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not submitted count/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mastery percentage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/class score:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/average grade/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not a class score, not mastery/i)).toBeInTheDocument();

    const ensureCalls = calls.filter((c) =>
      c.url.includes("/actions/ensure-evaluations"),
    );
    const evaluateCalls = calls.filter((c) =>
      c.url.includes("/actions/evaluate"),
    );
    expect(ensureCalls).toHaveLength(0);
    expect(evaluateCalls).toHaveLength(0);

    const intelligenceGets = calls.filter(
      (c) =>
        c.method === "GET" &&
        c.url.includes(`/assignments/${ASSIGNMENT_ID}/intelligence`),
    );
    expect(intelligenceGets.length).toBeGreaterThanOrEqual(1);
  });

  it("requires explicit Evaluate submitted work before ensure POST", async () => {
    const user = userEvent.setup();
    const calls: FetchCall[] = [];
    let intelligence = sampleIntelligence();
    stubFetch((call) => {
      calls.push(call);
      if (call.url.endsWith(`/api/v1/teaching/assignments/${ASSIGNMENT_ID}`)) {
        return mockJsonResponse(sampleAssignment());
      }
      if (
        call.method === "GET" &&
        call.url.endsWith(
          `/api/v1/assessment/assignments/${ASSIGNMENT_ID}/intelligence`,
        )
      ) {
        return mockJsonResponse(intelligence);
      }
      if (
        call.method === "POST" &&
        call.url.endsWith(
          `/api/v1/assessment/assignments/${ASSIGNMENT_ID}/actions/ensure-evaluations`,
        )
      ) {
        expect(call.headers?.get("Idempotency-Key")).toBeTruthy();
        intelligence = sampleIntelligence({
          evaluated_learner_count: 2,
          learners: [
            {
              ...sampleIntelligence().learners[0],
              evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
            },
            {
              ...sampleIntelligence().learners[1],
              evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
              evaluation_id: "33333333-3333-7333-8333-333333333301",
              evaluated_at: "2026-09-09T10:05:00Z",
              evaluation_policy_id: "aieos.learner_assessment.deterministic",
              evaluation_policy_version: 1,
            },
          ],
        });
        return new Response(null, { status: 204 });
      }
      if (call.url.includes("/api/v1/assessment/classroom-assessments")) {
        return mockJsonResponse({ items: [] });
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp(`/teacher-os/assess?assignment_id=${ASSIGNMENT_ID}`);
    const button = await screen.findByTestId("evaluate-submitted-work");
    expect(
      calls.filter((c) => c.url.includes("ensure-evaluations")),
    ).toHaveLength(0);

    await user.click(button);

    await waitFor(() => {
      expect(
        calls.filter((c) => c.url.includes("ensure-evaluations")),
      ).toHaveLength(1);
    });
    await waitFor(() => {
      expect(
        screen.getByTestId("intelligence-evaluated-count"),
      ).toHaveTextContent("2");
    });
  });

  it("does not auto-select class judgment and records assignment-origin facts", async () => {
    const user = userEvent.setup();
    let recorded: Record<string, unknown> | null = null;
    const calls = stubFetch((call) => {
      if (call.url.endsWith(`/api/v1/teaching/assignments/${ASSIGNMENT_ID}`)) {
        return mockJsonResponse(sampleAssignment());
      }
      if (call.url.includes(`/assignments/${ASSIGNMENT_ID}/intelligence`)) {
        return mockJsonResponse(
          sampleIntelligence({
            evaluated_learner_count: 2,
            learners: [
              {
                ...sampleIntelligence().learners[0],
                evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
              },
              {
                ...sampleIntelligence().learners[1],
                evaluation_state: "EVALUATED_UNDER_CURRENT_POLICY",
                evaluation_id: "33333333-3333-7333-8333-333333333301",
              },
            ],
          }),
        );
      }
      if (
        call.method === "GET" &&
        call.url.includes("/api/v1/assessment/classroom-assessments?")
      ) {
        return mockJsonResponse({
          items: recorded ? [recorded] : [],
        });
      }
      if (
        call.method === "GET" &&
        call.url.endsWith(
          `/api/v1/assessment/classroom-assessments/${ASSESSMENT_ID}`,
        )
      ) {
        return mockJsonResponse(recorded ?? sampleAssessment(), {
          etag: '"r0"',
        });
      }
      if (
        call.method === "POST" &&
        call.url.endsWith("/api/v1/assessment/classroom-assessments")
      ) {
        const body = call.body as Record<string, unknown>;
        expect(body.assignment_id).toBe(ASSIGNMENT_ID);
        expect(body.execution_id).toBeNull();
        expect(body.class_ref).toBe("class-5a");
        expect(body.content_id).toBe(CONTENT_ID);
        expect(body.content_version_id).toBe(VERSION_ID);
        expect(body.work_id).toBe(WORK_ID);
        expect(body.class_result_level).toBe("MIXED");
        expect(call.headers.get("Idempotency-Key")).toBeTruthy();
        recorded = sampleAssessment();
        return mockJsonResponse(recorded, { etag: '"r0"' });
      }
      if (call.url.includes("/api/v1/teaching/works/from-classroom-assessment")) {
        throw new Error("Improve must not be auto-created from intelligence");
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp(`/teacher-os/assess?assignment_id=${ASSIGNMENT_ID}`);
    expect(
      await screen.findByTestId("assignment-record-panel"),
    ).toBeInTheDocument();

    const recordButton = screen.getByTestId("record-assignment-assessment");
    expect(recordButton).toBeDisabled();

    expect(
      calls.filter(
        (c) =>
          c.method === "POST" &&
          c.url.endsWith("/api/v1/assessment/classroom-assessments"),
      ),
    ).toHaveLength(0);

    await user.click(screen.getByRole("radio", { name: /Mixed/i }));
    expect(recordButton).toBeEnabled();
    await user.click(recordButton);

    await waitFor(() => {
      expect(
        calls.filter(
          (c) =>
            c.method === "POST" &&
            c.url.endsWith("/api/v1/assessment/classroom-assessments"),
        ),
      ).toHaveLength(1);
    });
    expect(
      await screen.findByRole("link", { name: /Improve this class/i }),
    ).toHaveAttribute(
      "href",
      `/teacher-os/improve?assessment_id=${ASSESSMENT_ID}`,
    );
  });

  it("shows fail-closed authorization errors for intelligence load", async () => {
    stubFetch((call) => {
      if (call.url.endsWith(`/api/v1/teaching/assignments/${ASSIGNMENT_ID}`)) {
        return mockJsonResponse(sampleAssignment());
      }
      if (call.url.includes(`/assignments/${ASSIGNMENT_ID}/intelligence`)) {
        return mockProblemResponse(403, "forbidden");
      }
      return mockJsonResponse({ items: [] });
    });

    renderApp(`/teacher-os/assess?assignment_id=${ASSIGNMENT_ID}`);
    expect(
      await screen.findByText(/Could not load Assess/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Server authority denied/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("assignment-intelligence-panel"),
    ).not.toBeInTheDocument();
  });

  it("does not offer Improve for VOIDED ClassroomAssessment", async () => {
    stubFetch((call) => {
      if (call.url.endsWith(`/api/v1/teaching/assignments/${ASSIGNMENT_ID}`)) {
        return mockJsonResponse(sampleAssignment());
      }
      if (call.url.includes(`/assignments/${ASSIGNMENT_ID}/intelligence`)) {
        return mockJsonResponse(
          sampleIntelligence({
            submitted_learner_count: 0,
            evaluated_learner_count: 0,
            learners: [],
            question_distributions: [],
            frequently_missed_questions: [],
            objective_evidence_rollups: [],
          }),
        );
      }
      if (
        call.method === "GET" &&
        call.url.includes("/api/v1/assessment/classroom-assessments?")
      ) {
        return mockJsonResponse({
          items: [
            sampleAssessment({
              lifecycle_state: "VOIDED",
              voided_at: "2026-09-09T12:00:00Z",
            }),
          ],
        });
      }
      if (call.url.endsWith(`/api/v1/assessment/classroom-assessments/${ASSESSMENT_ID}`)) {
        return mockJsonResponse(
          sampleAssessment({
            lifecycle_state: "VOIDED",
            voided_at: "2026-09-09T12:00:00Z",
          }),
          { etag: '"r1"' },
        );
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp(
      `/teacher-os/assess?assignment_id=${ASSIGNMENT_ID}&assessment_id=${ASSESSMENT_ID}`,
    );
    expect(
      await screen.findByText(/VOIDED is terminal/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Improve this class/i }),
    ).not.toBeInTheDocument();
  });

  it("marks historical not-current-policy learners as not currently evaluated", async () => {
    stubFetch((call) => {
      if (call.url.endsWith(`/api/v1/teaching/assignments/${ASSIGNMENT_ID}`)) {
        return mockJsonResponse(sampleAssignment());
      }
      if (call.url.includes(`/assignments/${ASSIGNMENT_ID}/intelligence`)) {
        return mockJsonResponse(
          sampleIntelligence({
            evaluated_learner_count: 0,
            learners: [
              {
                learner_principal_id: LEARNER_A,
                submission_id: "11111111-1111-7111-8111-111111111101",
                evaluation_state: "NOT_EVALUATED_UNDER_CURRENT_POLICY",
                evaluation_id: "22222222-2222-7222-8222-222222222201",
                evaluated_at: "2026-09-01T10:00:00Z",
                evaluation_policy_id: "obsolete.policy",
                evaluation_policy_version: 1,
                items: [],
                objective_evidence: [],
              },
            ],
          }),
        );
      }
      if (call.url.includes("/api/v1/assessment/classroom-assessments")) {
        return mockJsonResponse({ items: [] });
      }
      return mockJsonResponse({ title: "x", status: 404 }, { status: 404 });
    });

    renderApp(`/teacher-os/assess?assignment_id=${ASSIGNMENT_ID}`);
    const state = await screen.findByTestId(
      "learner-state-NOT_EVALUATED_UNDER_CURRENT_POLICY",
    );
    expect(state).toHaveAttribute("data-currently-evaluated", "false");
    expect(state).toHaveTextContent(/Not evaluated under current policy/i);
  });
});
