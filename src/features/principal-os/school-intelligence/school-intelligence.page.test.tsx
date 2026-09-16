import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  connectDevSession,
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";
import {
  emptyAuthorizedScope,
  GENERATED_AT,
  sampleSchoolIntelligence,
} from "../schoolIntelligence.fixtures";

const SCHOOL_INTELLIGENCE_PATH =
  "/api/v1/principal-os/school-intelligence";

const FORBIDDEN_RENDERED = [
  "learner_principal_id",
  "learner_name",
  "teacher_principal_id",
  "teacher_score",
  "teacher_rank",
  "leaderboard",
  "class_result_level",
  "class_result_note",
  "mastery",
  "competency",
  "prediction",
  "best teacher",
  "worst teacher",
];

function stubSchoolIntelligence(
  body: unknown = sampleSchoolIntelligence(),
  init?: { status?: number },
) {
  return stubFetch((call) => {
    if (call.url.split("?")[0] === SCHOOL_INTELLIGENCE_PATH) {
      return mockJsonResponse(body, init);
    }
    return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
  });
}

describe("Principal OS School Intelligence page", () => {
  it("renders Principal OS shell and School Intelligence index", async () => {
    stubSchoolIntelligence();
    renderApp("/principal-os");
    expect(screen.getByText("Principal OS")).toBeInTheDocument();
    expect(screen.getByText("EduVijna")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "School Intelligence" }),
    ).toHaveAttribute("href", "/principal-os");
    expect(
      await screen.findByRole("heading", { level: 1, name: "School Intelligence" }),
    ).toBeInTheDocument();
  });

  it("keeps Teacher OS and Student OS routes", async () => {
    stubFetch((call) => {
      if (call.url.startsWith("/api/v1/student-os/home")) {
        return mockJsonResponse({ current_assignment_count: 0, items: [] });
      }
      return mockJsonResponse({
        mission_date: "2026-01-15",
        review: { pending_count: 0 },
        preparation: { active_work_count: 0, continue_work: null },
        hero_action: { kind: "prepare_tomorrow", work_id: null },
      });
    });
    const teacher = renderApp("/teacher-os/today");
    expect(
      await screen.findByRole("heading", { level: 1, name: /Today's Mission/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Teacher OS")).toBeInTheDocument();
    teacher.unmount();
    renderApp("/student-os/home");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your work" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Student OS")).toBeInTheDocument();
  });

  it("does not call the API without a development session", async () => {
    const calls = stubSchoolIntelligence();
    renderApp("/principal-os", null);
    expect(
      await screen.findByRole("heading", {
        name: "Connect a development session",
      }),
    ).toBeInTheDocument();
    expect(
      calls.filter((call) => call.url.includes("school-intelligence")),
    ).toHaveLength(0);
  });

  it("GETs School Intelligence when a session is available and on reconnect", async () => {
    const calls = stubSchoolIntelligence();
    renderApp("/principal-os", null);
    expect(
      await screen.findByRole("heading", {
        name: "Connect a development session",
      }),
    ).toBeInTheDocument();
    connectDevSession();
    expect(
      await screen.findByText(`Current facts as of ${GENERATED_AT}`),
    ).toBeInTheDocument();
    expect(
      calls.filter((call) => call.url === SCHOOL_INTELLIGENCE_PATH),
    ).toHaveLength(1);
    expect(calls[0]?.method).toBe("GET");
  });

  it("renders returned summary and class cards in server order", async () => {
    const data = sampleSchoolIntelligence();
    stubSchoolIntelligence(data);
    renderApp("/principal-os");

    expect(
      await screen.findByText(`Current facts as of ${GENERATED_AT}`),
    ).toBeInTheDocument();
    expect(screen.getByText(/In-scope classes: 2/)).toBeInTheDocument();
    expect(
      screen.getByText(/aieos\.learner_assessment\.deterministic/),
    ).toBeInTheDocument();
    expect(screen.getByText(/DERIVED_ON_REQUEST/)).toBeInTheDocument();

    const summary = screen
      .getByRole("heading", { name: "School summary" })
      .closest("section");
    expect(summary).not.toBeNull();
    const summaryScope = within(summary as HTMLElement);
    expect(
      summaryScope.getByRole("heading", { name: "Teaching assignments" }).closest("li"),
    ).toHaveTextContent("5");
    expect(
      summaryScope.getByRole("heading", { name: "Active assignments" }).closest("li"),
    ).toHaveTextContent("3");
    expect(
      summaryScope.getByRole("heading", { name: "Closed assignments" }).closest("li"),
    ).toHaveTextContent("1");
    expect(
      summaryScope.getByRole("heading", { name: "Cancelled assignments" }).closest("li"),
    ).toHaveTextContent("1");
    expect(
      summaryScope.getByRole("heading", { name: "Learner submissions" }).closest("li"),
    ).toHaveTextContent("10");
    expect(
      summaryScope
        .getByRole("heading", { name: "Current-policy evaluations" })
        .closest("li"),
    ).toHaveTextContent("8");
    expect(
      summaryScope.getByText(
        "Current-policy evaluations: 8 of 10 submitted evidence records",
      ),
    ).toBeInTheDocument();
    expect(summaryScope.getByText(/Submitted: 10/)).toBeInTheDocument();
    expect(summaryScope.getByText(/Current-policy evaluated: 8/)).toBeInTheDocument();

    const classHeadings = screen.getAllByRole("heading", {
      level: 3,
      name: /Grade 6/,
    });
    expect(classHeadings.map((node) => node.textContent)).toEqual([
      "Grade 6A",
      "Grade 6B",
    ]);
    expect(screen.getByText("class-6a")).toBeInTheDocument();
    expect(screen.getByText("class-6b")).toBeInTheDocument();
    expect(screen.getByTestId("class-card-class-6a")).toHaveTextContent("Grade 6A");
    expect(screen.getByTestId("class-card-class-6b")).toHaveTextContent("Grade 6B");
    const order = [...screen.getAllByTestId(/class-card-/)].map((node) =>
      node.getAttribute("data-testid"),
    );
    expect(order).toEqual(["class-card-class-6a", "class-card-class-6b"]);
    expect(screen.getByTestId("class-card-class-6a")).toHaveTextContent(
      "Current-policy evaluations: 5 of 7 submitted evidence records",
    );
  });

  it("does not calculate a percentage or rate from coverage counts", async () => {
    stubSchoolIntelligence();
    const { container } = renderApp("/principal-os");
    await screen.findByText(/8 of 10 submitted evidence records/);
    expect(container.textContent).not.toContain("%");
    expect(container.textContent?.toLowerCase()).not.toContain("evaluation rate");
    expect(container.textContent?.toLowerCase()).not.toContain("submission rate");
    expect(container.querySelector("[role=progressbar]")).toBeNull();
    expect(container.textContent).not.toContain("80%");
  });

  it("shows a truthful empty authorized-scope state", async () => {
    stubSchoolIntelligence(emptyAuthorizedScope());
    renderApp("/principal-os");
    expect(
      await screen.findByText(
        "No classes are currently in your authorized School Intelligence scope.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Could not/i)).not.toBeInTheDocument();
  });

  it("treats 401 as an unaccepted session, without leftover facts", async () => {
    stubFetch(() => mockProblemResponse(401, "unauthorized"));
    renderApp("/principal-os");
    expect(
      await screen.findByRole("heading", {
        name: "Session is not currently accepted",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your session is not currently accepted/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Grade 6A")).not.toBeInTheDocument();
    expect(screen.queryByText(/In-scope classes: 0/)).not.toBeInTheDocument();
  });

  it("treats 403 as missing School Intelligence access with no fallback data", async () => {
    stubFetch(() => mockProblemResponse(403, "forbidden"));
    renderApp("/principal-os");
    expect(
      await screen.findByRole("heading", {
        name: "School Intelligence access is not available",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The current Principal does not have School Intelligence access.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Grade 6A")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Mission")).not.toBeInTheDocument();
    expect(screen.queryByText(/In-scope classes/)).not.toBeInTheDocument();
  });

  it("treats 503 as unavailable and does not synthesize zeros", async () => {
    stubFetch(() =>
      mockProblemResponse(503, "school_intelligence_unavailable"),
    );
    renderApp("/principal-os");
    expect(
      await screen.findByRole("heading", {
        name: "School Intelligence is temporarily unavailable",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /current authority or a required source could not be resolved/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("school_intelligence_unavailable")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "No classes are currently in your authorized School Intelligence scope.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/In-scope classes: 0/)).not.toBeInTheDocument();
    expect(screen.queryByText("Teaching assignments")).not.toBeInTheDocument();
  });

  it("treats network and 5xx failures as a generic unavailable state", async () => {
    stubFetch(() => mockJsonResponse({ title: "boom" }, { status: 500 }));
    renderApp("/principal-os");
    expect(
      await screen.findByText("School Intelligence is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/current authority or a required source/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("treats a network failure as a generic unavailable state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    renderApp("/principal-os");
    expect(
      await screen.findByText("School Intelligence is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
    expect(screen.queryByText(/In-scope classes: 0/)).not.toBeInTheDocument();
  });

  it("Refresh and retry only repeat the School Intelligence GET", async () => {
    const calls = stubSchoolIntelligence();
    renderApp("/principal-os");
    await screen.findByText(`Current facts as of ${GENERATED_AT}`);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(
        calls.filter((call) => call.url === SCHOOL_INTELLIGENCE_PATH),
      ).toHaveLength(2);
    });
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(calls.every((call) => call.body === undefined)).toBe(true);
    expect(
      calls.every((call) => call.url === SCHOOL_INTELLIGENCE_PATH),
    ).toBe(true);
  });

  it("does not persist Principal facts or session material", async () => {
    const localSet = vi.spyOn(Storage.prototype, "setItem");
    stubSchoolIntelligence();
    renderApp("/principal-os");
    await screen.findByText(`Current facts as of ${GENERATED_AT}`);
    expect(localSet).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("rendered Principal output contains none of the forbidden identity or outcome concepts", async () => {
    stubSchoolIntelligence();
    const { container } = renderApp("/principal-os");
    await screen.findByText("Grade 6A");
    const text = container.textContent?.toLowerCase() ?? "";
    for (const token of FORBIDDEN_RENDERED) {
      expect(text).not.toContain(token);
    }
  });
});
