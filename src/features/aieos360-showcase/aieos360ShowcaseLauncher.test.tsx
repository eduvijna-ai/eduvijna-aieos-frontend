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
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/aieos360-showcase-runtime.json")) {
        return {
          ok: true,
          json: async () => ({
            runtime_surface_valid: true,
            selected_mode: "DETERMINISTIC",
            verified_runtime_mode: "DETERMINISTIC",
            active_provider_id: "fake",
            active_model_id: "fake-model",
            verification_state: "deterministic_fixture_runtime",
            real_provider_generation_verified: false,
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    }));

    renderLauncher();

    expect(
      screen.getByRole("heading", {
        name: /AIEOS360 Client Showcase — NON_PRODUCTION \/ SYNTHETIC REHEARSAL/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Showcase runtime truth/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Open Teacher OS/i }),
    ).toHaveAttribute(
      "href",
      "http://presenter.local:5291/teacher-os/today?showcase=1",
    );
    expect(
      screen.getByRole("link", { name: /Open Student OS/i }),
    ).toHaveAttribute(
      "href",
      "http://presenter.local:5292/student-os/home?showcase=1",
    );
    expect(
      screen.getByRole("link", { name: /Open Principal OS/i }),
    ).toHaveAttribute(
      "href",
      "http://presenter.local:5293/principal-os?showcase=1",
    );
    expect(
      screen.getByRole("link", { name: /Open Parent OS/i }),
    ).toHaveAttribute(
      "href",
      "http://presenter.local:5294/parent-os?showcase=1",
    );

    vi.unstubAllGlobals();
  });

  it("renders the story map in the required order without internal credentials", () => {
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "localhost",
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        runtime_surface_valid: true,
        selected_mode: "DETERMINISTIC",
        active_provider_id: "fake",
        active_model_id: "fake-model",
        verification_state: "deterministic_fixture_runtime",
      }),
    })));

    renderLauncher();

    const storyMap = screen.getByRole("list", { name: "Story map stages" });
    const steps = within(storyMap).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(
      steps.map((step) =>
        within(step).getByRole("link", { name: /opens in a new tab/i }).textContent,
      ),
    ).toEqual([
      "Teacher (opens in a new tab)",
      "Student (opens in a new tab)",
      "Assessment (opens in a new tab)",
      "Improve (opens in a new tab)",
      "Principal (opens in a new tab)",
      "Parent (opens in a new tab)",
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

    const assessmentLink = screen.getByRole("link", {
      name: /Assessment.*opens in a new tab/i,
    });
    expect(assessmentLink).toHaveAttribute("target", "_blank");
    expect(assessmentLink).toHaveAttribute("rel", "noopener noreferrer");

    vi.unstubAllGlobals();
  });
});
