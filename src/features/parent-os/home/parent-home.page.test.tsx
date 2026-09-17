import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";
import {
  emptyParentHome,
  FIRST_LEARNER,
  sampleParentHome,
} from "../parentIntelligence.fixtures";

const HOME_PATH = "/api/v1/parent-os/home";

const FORBIDDEN_RENDERED = [
  "class_ref",
  "content_id",
  "content_version_id",
  "attempt_id",
  "submission_id",
  "evaluation_id",
  "teacher_principal_id",
  "mastery",
  "competency",
  "behind peers",
  "at risk",
  "on track",
  "passed",
  "failed",
  "leaderboard",
];

function stubParentHome(
  body: unknown = sampleParentHome(),
  init?: { status?: number; problem?: { status: number; code: string } },
) {
  return stubFetch((call) => {
    if (call.url.split("?")[0] === HOME_PATH) {
      if (init?.problem) {
        return mockProblemResponse(init.problem.status, init.problem.code);
      }
      return mockJsonResponse(body, init);
    }
    return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
  });
}

function renderedText(): string {
  return document.body.textContent?.toLowerCase() ?? "";
}

describe("Parent OS home page", () => {
  it("renders Parent OS shell and home", async () => {
    stubParentHome();
    renderApp("/parent-os");
    expect(screen.getByText("Parent OS")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/parent-os",
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Parent home" }),
    ).toBeInTheDocument();
  });

  it("does not call Parent API without a development session", async () => {
    const calls = stubParentHome();
    renderApp("/parent-os", null);
    expect(
      await screen.findByRole("heading", {
        name: "Connect a development session",
      }),
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.url.includes("parent-os"))).toHaveLength(0);
  });

  it("preserves backend child order and assignment statuses", async () => {
    stubParentHome();
    renderApp("/parent-os");
    expect(
      await screen.findByText("Current facts as of this request"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Child 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Child 2" })).toBeInTheDocument();
    const cards = screen.getAllByTestId(/parent-child-card-/);
    expect(cards.map((node) => node.getAttribute("data-testid"))).toEqual([
      "parent-child-card-0",
      "parent-child-card-1",
    ]);
    expect(screen.getByText("Fractions worksheet")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("No due date")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View current facts for Child 1" }),
    ).toHaveAttribute("href", `/parent-os/children/${FIRST_LEARNER}`);
    for (const token of FORBIDDEN_RENDERED) {
      expect(renderedText()).not.toContain(token);
    }
  });

  it("renders a calm empty state for zero authorized children", async () => {
    stubParentHome(emptyParentHome());
    renderApp("/parent-os");
    expect(
      await screen.findByRole("heading", {
        name: "No children are currently available in your Parent view.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("system error")).not.toBeInTheDocument();
    expect(screen.queryByText("no children exist")).not.toBeInTheDocument();
  });

  it("retry performs GET only and 401 clears facts", async () => {
    let fail = true;
    const calls = stubFetch((call) => {
      if (call.url.split("?")[0] !== HOME_PATH) {
        return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
      }
      if (fail) {
        return mockProblemResponse(401, "unauthenticated");
      }
      return mockJsonResponse(sampleParentHome());
    });
    renderApp("/parent-os");
    expect(
      await screen.findByRole("heading", {
        name: "Session is not currently accepted",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Fractions worksheet")).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Fractions worksheet")).toBeInTheDocument();
    expect(calls.filter((call) => call.url === HOME_PATH).every((call) => call.method === "GET")).toBe(
      true,
    );
    expect(calls.filter((call) => call.url === HOME_PATH)).toHaveLength(2);
  });

  it("403 does not fall back to another OS and clears facts", async () => {
    stubParentHome(undefined, {
      problem: { status: 403, code: "parent_intelligence_capability_forbidden" },
    });
    renderApp("/parent-os");
    expect(
      await screen.findByText(
        "The current adult does not have Parent Intelligence access.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Teacher OS")).not.toBeInTheDocument();
    expect(screen.queryByText("Principal OS")).not.toBeInTheDocument();
    expect(screen.queryByText("Student OS")).not.toBeInTheDocument();
    expect(screen.queryByText("Fractions worksheet")).not.toBeInTheDocument();
  });

  it("503 does not convert to empty children", async () => {
    stubParentHome(undefined, {
      problem: { status: 503, code: "parent_intelligence_unavailable" },
    });
    renderApp("/parent-os");
    expect(
      await screen.findByText("Parent information is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No children are currently available in your Parent view."),
    ).not.toBeInTheDocument();
  });

  it("stale successful facts leave the screen after a later failure", async () => {
    let succeed = true;
    stubFetch((call) => {
      if (call.url.split("?")[0] !== HOME_PATH) {
        return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
      }
      if (succeed) return mockJsonResponse(sampleParentHome());
      return mockProblemResponse(503, "parent_intelligence_unavailable");
    });
    renderApp("/parent-os");
    expect(await screen.findByText("Fractions worksheet")).toBeInTheDocument();
    succeed = false;
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(screen.queryByText("Fractions worksheet")).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("Parent information is temporarily unavailable."),
    ).toBeInTheDocument();
  });
});
