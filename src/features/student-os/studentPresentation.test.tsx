import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  mockJsonResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";
import { ASSIGNMENT_ID, sampleAssignment } from "./studentOs.fixtures";

describe("Student presentation (CX01-I04)", () => {
  it("does not show raw class_ref on assignment detail", async () => {
    stubFetch((call) => {
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(sampleAssignment());
      }
      return mockJsonResponse({});
    });

    renderApp(`/student-os/assignments/${ASSIGNMENT_ID}`);
    await screen.findByRole("heading", {
      level: 1,
      name: "Leaf parts worksheet",
    });
    expect(screen.queryByText("grade-5-science")).not.toBeInTheDocument();
    expect(
      screen.getByText(/copy your teacher assigned/i),
    ).toBeInTheDocument();
  });

  it("uses state-based card actions without engineering count copy on home", async () => {
    stubFetch((call) => {
      if (call.url === "/api/v1/student-os/home") {
        return mockJsonResponse({
          current_assignment_count: 3,
          items: [
            sampleAssignment({ attempt_summary: "NOT_STARTED", resource: null }),
          ],
        });
      }
      if (call.url === `/api/v1/student-os/assignments/${ASSIGNMENT_ID}`) {
        return mockJsonResponse(sampleAssignment());
      }
      return mockJsonResponse({ items: [], next_cursor: null, has_more: false });
    });

    renderApp("/student-os/home");
    expect(
      await screen.findByRole("link", { name: /Start: Leaf parts worksheet/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/not the number of cards/i),
    ).not.toBeInTheDocument();
  });
});
