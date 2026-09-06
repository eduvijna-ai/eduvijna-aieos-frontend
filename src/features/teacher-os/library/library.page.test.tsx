import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderApp, mockJsonResponse } from "@/test/test-utils";

const sampleLibraryItem = {
  content_id: "11111111-1111-1111-1111-111111111111",
  content_type: "lesson.plan",
  title: "Photosynthesis library item",
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-02T11:00:00.000Z",
  stewardship_state: "APPROVED",
  current_version_id: "22222222-2222-2222-2222-222222222222",
  published_version_id: "22222222-2222-2222-2222-222222222222",
  teaching_work_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  review_navigation: null,
};

describe("LibraryPage", () => {
  it("replaces PlaceholderPage and renders library fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockJsonResponse({ items: [sampleLibraryItem], next_cursor: null }),
      ),
    );
    renderApp("/teacher-os/library");
    expect(
      await screen.findByRole("heading", { name: /^Library$/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Not implemented yet/i)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "Photosynthesis library item",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("lesson.plan")).toBeInTheDocument();
    expect(screen.getAllByText("APPROVED").length).toBeGreaterThan(0);
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(document.querySelector(".library-list")).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Open$/i })).toHaveAttribute(
      "href",
      "/teacher-os/work/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/artifacts/11111111-1111-1111-1111-111111111111/versions/22222222-2222-2222-2222-222222222222",
    );
    expect(screen.getByRole("link", { name: /^Work$/i })).toBeInTheDocument();
  });

  it("shows empty → Prepare and type/state filters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("stewardship_state=DRAFT")) {
        return mockJsonResponse({ items: [], next_cursor: null });
      }
      return mockJsonResponse({ items: [], next_cursor: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/teacher-os/library");
    expect(await screen.findByText(/Library is empty/i)).toBeInTheDocument();
    expect(
      screen.getByRole("status").querySelector('a[href="/teacher-os/prepare"]'),
    ).toBeTruthy();
    await userEvent.selectOptions(
      screen.getByLabelText(/Stewardship state/i),
      "DRAFT",
    );
    await userEvent.click(screen.getByRole("button", { name: /Apply filters/i }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("stewardship_state=DRAFT"),
        ),
      ).toBe(true);
    });
  });

  it("shows Review navigation for IN_REVIEW items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockJsonResponse({
          items: [
            {
              ...sampleLibraryItem,
              stewardship_state: "IN_REVIEW",
              published_version_id: null,
              review_navigation: {
                content_id: sampleLibraryItem.content_id,
                version_id: sampleLibraryItem.current_version_id,
              },
            },
          ],
          next_cursor: null,
        }),
      ),
    );
    renderApp("/teacher-os/library");
    expect(await screen.findByText("Not published")).toBeInTheDocument();
    expect(screen.getAllByText("IN_REVIEW").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /^Review$/i })).toHaveAttribute(
      "href",
      `/teacher-os/review/${sampleLibraryItem.content_id}/versions/${sampleLibraryItem.current_version_id}`,
    );
  });
});
