import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  mockJsonResponse,
  mockProblemResponse,
  renderApp,
  stubFetch,
} from "@/test/test-utils";
import { sampleAssignment, sampleHome } from "./studentOs.fixtures";

describe("Student Home", () => {
  it("uses the exact backend current_assignment_count, not the item slice length", async () => {
    stubFetch((call) => {
      if (call.url === "/api/v1/student-os/home") {
        return mockJsonResponse(
          sampleHome({
            current_assignment_count: 12,
            items: [sampleAssignment()],
          }),
        );
      }
      return mockJsonResponse({ items: [], next_cursor: null, has_more: false });
    });

    renderApp("/student-os/home");

    expect(
      await screen.findByText((_, node) =>
        Boolean(
          node?.tagName === "P" &&
            /You have 12 current assignments/.test(node.textContent ?? ""),
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Leaf parts worksheet" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /See all 12 assignments/i }),
    ).toHaveAttribute("href", "/student-os/assignments");
  });

  it("shows an empty assignment state", async () => {
    stubFetch(() =>
      mockJsonResponse(sampleHome({ current_assignment_count: 0, items: [] })),
    );
    renderApp("/student-os/home");
    expect(await screen.findByText(/No assignments yet/i)).toBeInTheDocument();
    expect(
      await screen.findByText((_, node) =>
        Boolean(
          node?.tagName === "P" &&
            /You have 0 current assignments/.test(node.textContent ?? ""),
        ),
      ),
    ).toBeInTheDocument();
  });

  it("shows authorization denial without treating it as success", async () => {
    stubFetch(() => mockProblemResponse(401, "unauthorized", "unauthorized"));
    renderApp("/student-os/home");
    expect(
      await screen.findByText(/You do not have access to this student work/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You have/i)).not.toBeInTheDocument();
  });
});

describe("Student assignment list pagination", () => {
  it("renders a populated list and forwards the opaque next_cursor", async () => {
    const calls = stubFetch((call) => {
      if (call.url.includes("cursor=opaque-server-cursor")) {
        return mockJsonResponse({
          items: [
            sampleAssignment({
              assignment_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              resource: {
                ...sampleAssignment().resource!,
                title: "Second page worksheet",
              },
            }),
          ],
          next_cursor: null,
          has_more: false,
        });
      }
      return mockJsonResponse({
        items: [sampleAssignment()],
        next_cursor: "opaque-server-cursor",
        has_more: true,
      });
    });

    renderApp("/student-os/assignments");
    expect(
      await screen.findByRole("heading", { name: "Leaf parts worksheet" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Load more/i }));
    expect(
      await screen.findByRole("heading", { name: "Second page worksheet" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        calls.some((call) => call.url.includes("cursor=opaque-server-cursor")),
      ).toBe(true);
    });
    expect(calls.every((call) => !call.url.includes("offset="))).toBe(true);
    expect(calls.every((call) => !call.url.includes("page="))).toBe(true);
  });

  it("fails closed on a rejected cursor", async () => {
    stubFetch((call) => {
      if (call.url.includes("cursor=")) {
        return mockProblemResponse(400, "invalid_cursor", "invalid_cursor");
      }
      return mockJsonResponse({
        items: [sampleAssignment()],
        next_cursor: "tampered",
        has_more: true,
      });
    });
    renderApp("/student-os/assignments");
    await screen.findByRole("heading", { name: "Leaf parts worksheet" });
    await userEvent.click(screen.getByRole("button", { name: /Load more/i }));
    expect(
      await screen.findByText(/That page link is not valid/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Leaf parts worksheet" })).toBeInTheDocument();
  });
});
