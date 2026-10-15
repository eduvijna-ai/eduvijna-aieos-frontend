import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  ShowcaseBackLink,
  ShowcaseExternalHandoff,
} from "./ShowcaseContinuity";

function renderWithShowcase(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("showcase continuity UI", () => {
  it("hides back link and handoffs without showcase context", () => {
    renderWithShowcase(
      "/teacher-os/today",
      <>
        <ShowcaseBackLink />
        <ShowcaseExternalHandoff href="http://student.example/assignments/a1?showcase=1">
          Continue
        </ShowcaseExternalHandoff>
      </>,
    );

    expect(
      screen.queryByRole("link", { name: /Back to AIEOS360 showcase/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Continue")).not.toBeInTheDocument();
  });

  it("shows back link and external handoff when showcase=1 is active", () => {
    renderWithShowcase(
      "/teacher-os/teach/assignments/a1?showcase=1",
      <>
        <ShowcaseBackLink />
        <ShowcaseExternalHandoff
          href="http://demo.local:5292/student-os/assignments/a1?showcase=1"
          testId="showcase-handoff"
        >
          Continue showcase: Student
        </ShowcaseExternalHandoff>
      </>,
    );

    expect(
      screen.getByRole("link", { name: /Back to AIEOS360 showcase/i }),
    ).toHaveAttribute("href", "/showcase/aieos360?showcase=1");
    const handoff = screen.getByTestId("showcase-handoff");
    expect(handoff).toHaveAttribute("target", "_blank");
    expect(handoff).toHaveAttribute(
      "href",
      "http://demo.local:5292/student-os/assignments/a1?showcase=1",
    );
  });
});
