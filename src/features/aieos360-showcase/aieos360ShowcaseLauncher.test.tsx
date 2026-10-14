import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Aieos360ShowcaseLauncherPage } from "./Aieos360ShowcaseLauncherPage";

function renderLauncher() {
  return render(
    <MemoryRouter initialEntries={["/showcase/aieos360"]}>
      <Routes>
        <Route
          path="/showcase/aieos360"
          element={<Aieos360ShowcaseLauncherPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AIEOS360 showcase launcher page", () => {
  it("renders the NON_PRODUCTION banner and role launch links", () => {
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "presenter.local",
    });

    renderLauncher();

    expect(
      screen.getByRole("heading", {
        name: /AIEOS360 Client Showcase — NON_PRODUCTION \/ SYNTHETIC REHEARSAL/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Open Teacher OS/i }),
    ).toHaveAttribute(
      "href",
      "http://presenter.local:5291/teacher-os/today",
    );
    expect(
      screen.getByRole("link", { name: /Open Student OS/i }),
    ).toHaveAttribute("href", "http://presenter.local:5292/student-os/home");
    expect(
      screen.getByRole("link", { name: /Open Principal OS/i }),
    ).toHaveAttribute("href", "http://presenter.local:5293/principal-os");
    expect(
      screen.getByRole("link", { name: /Open Parent OS/i }),
    ).toHaveAttribute("href", "http://presenter.local:5294/parent-os");

    vi.unstubAllGlobals();
  });

  it("renders the story map in the required order without internal credentials", () => {
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "localhost",
    });

    renderLauncher();

    const storyMap = screen.getByRole("list", { name: "Story map stages" });
    const steps = within(storyMap).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(
      steps.map((step) => within(step).getByRole("link").textContent),
    ).toEqual([
      "Teacher",
      "Student",
      "Assessment",
      "Improve",
      "Principal",
      "Parent",
    ]);

    expect(screen.queryByText(/bearer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/principal_id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/55448/i)).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("opens role destinations in a separate tab for presenter flow", () => {
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "localhost",
    });

    renderLauncher();

    const teacherLink = screen.getByRole("link", { name: /Open Teacher OS/i });
    expect(teacherLink).toHaveAttribute("target", "_blank");
    expect(teacherLink).toHaveAttribute("rel", "noopener noreferrer");

    vi.unstubAllGlobals();
  });
});
