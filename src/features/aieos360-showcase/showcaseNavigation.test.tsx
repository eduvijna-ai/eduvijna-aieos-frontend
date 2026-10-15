import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AssignmentCard } from "@/features/student-os/assignments/AssignmentCard";
import type { StudentAssignmentResponse } from "@/services/api/studentLearningApi";
import { ShowcaseNavLink } from "./ShowcaseContinuity";
import { withShowcaseQuery } from "./showcaseContext";

const assignmentFixture = {
  assignment_id: "assign-showcase-1",
  class_ref: "class-5a",
  content_id: "content-1",
  content_version_id: "version-1",
  currently_consumable: true,
  attempt_summary: "NOT_STARTED",
  attempt_id: null,
  available_from: "2026-09-18T08:00:00.000Z",
  due_at: null,
  lifecycle_state: "ACTIVE",
  resource: null,
} satisfies StudentAssignmentResponse;

describe("showcase navigation propagation", () => {
  it("keeps showcase=1 on showcase-aware nav links", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: "/teacher-os/today",
          element: (
            <ShowcaseNavLink
              to="/teacher-os/teach"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Teach
            </ShowcaseNavLink>
          ),
        },
        { path: "/teacher-os/teach", element: <p>Teach surface</p> },
      ],
      { initialEntries: ["/teacher-os/today?showcase=1"] },
    );

    render(<RouterProvider router={router} />);
    await user.click(screen.getByRole("link", { name: "Teach" }));

    expect(router.state.location.pathname).toBe("/teacher-os/teach");
    expect(router.state.location.search).toBe("?showcase=1");
  });

  it("keeps showcase=1 on Student assignment card links", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/student-os/home",
          element: (
            <ul>
              <AssignmentCard assignment={assignmentFixture} />
            </ul>
          ),
        },
        {
          path: "/student-os/assignments/:assignmentId",
          element: <p>Assignment detail</p>,
        },
      ],
      { initialEntries: ["/student-os/home?showcase=1"] },
    );

    render(<RouterProvider router={router} />);
    expect(screen.getByRole("link", { name: /Open/i })).toHaveAttribute(
      "href",
      "/student-os/assignments/assign-showcase-1?showcase=1",
    );
  });

  it("does not add showcase query when context is absent", () => {
    expect(withShowcaseQuery("/teacher-os/teach", false)).toBe(
      "/teacher-os/teach",
    );
    expect(withShowcaseQuery("/student-os/home", false)).toBe(
      "/student-os/home",
    );
  });
});
