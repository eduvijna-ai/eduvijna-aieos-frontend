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
  FIRST_LEARNER,
  sampleParentChild,
  SECOND_LEARNER,
} from "../parentIntelligence.fixtures";
import { parentOsChildPath } from "@/services/api/parentIntelligenceApi";

const HOME_PATH = "/api/v1/parent-os/home";
const CHILD_PATH = parentOsChildPath(SECOND_LEARNER);

function stubChild(
  body: unknown = sampleParentChild(),
  init?: { problem?: { status: number; code: string } },
) {
  return stubFetch((call) => {
    const path = call.url.split("?")[0];
    if (path === CHILD_PATH) {
      if (init?.problem) {
        return mockProblemResponse(init.problem.status, init.problem.code);
      }
      return mockJsonResponse(body);
    }
    return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
  });
}

describe("Parent OS child detail page", () => {
  it("loads authorized child facts with a fresh GET", async () => {
    const calls = stubChild();
    renderApp(`/parent-os/children/${SECOND_LEARNER}`);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Child facts" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reading homework")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(calls.filter((call) => call.url === CHILD_PATH)).toHaveLength(1);
    expect(calls[0]?.method).toBe("GET");
    expect(calls.some((call) => call.url === HOME_PATH)).toBe(false);
  });

  it("shows generic concealment on 404 and does not probe other sources", async () => {
    const calls = stubChild(undefined, {
      problem: { status: 404, code: "parent_learner_not_found" },
    });
    renderApp(`/parent-os/children/${SECOND_LEARNER}`);
    expect(
      await screen.findByRole("heading", { name: "This child is not available." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("unauthorized")).not.toBeInTheDocument();
    expect(screen.queryByText("other tenant")).not.toBeInTheDocument();
    expect(screen.queryByText("revoked")).not.toBeInTheDocument();
    expect(screen.queryByText("not your child")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(calls.filter((call) => call.url === CHILD_PATH)).toHaveLength(1);
    });
    expect(calls.some((call) => call.url === HOME_PATH)).toBe(false);
    expect(calls.some((call) => call.url.includes(FIRST_LEARNER))).toBe(false);
  });

  it("503 is unavailable, not an empty child", async () => {
    stubChild(undefined, {
      problem: { status: 503, code: "parent_intelligence_unavailable" },
    });
    renderApp(`/parent-os/children/${SECOND_LEARNER}`);
    expect(
      await screen.findByText("Parent information is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Reading homework")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No children are currently available in your Parent view."),
    ).not.toBeInTheDocument();
  });

  it("retry on 503 repeats the child GET only", async () => {
    let fail = true;
    const calls = stubFetch((call) => {
      const path = call.url.split("?")[0];
      if (path !== CHILD_PATH) {
        return mockJsonResponse({ title: "unexpected", status: 404 }, { status: 404 });
      }
      if (fail) {
        return mockProblemResponse(503, "parent_intelligence_unavailable");
      }
      return mockJsonResponse(sampleParentChild());
    });
    renderApp(`/parent-os/children/${SECOND_LEARNER}`);
    expect(
      await screen.findByText("Parent information is temporarily unavailable."),
    ).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Reading homework")).toBeInTheDocument();
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(calls.every((call) => call.url === CHILD_PATH)).toBe(true);
  });
});
