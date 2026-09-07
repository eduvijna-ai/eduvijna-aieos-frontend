import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CONTENT_ID,
  mockJsonResponse,
  renderApp,
  stubFetch,
  VERSION_ID,
  WORK_ID,
} from "@/test/test-utils";
import { homeworkPayload } from "@/features/teacher-os/artifacts/artifactFixtures";

const DETAIL_ROUTE = `/teacher-os/library/${CONTENT_ID}`;

const libraryDetail = {
  content_id: CONTENT_ID,
  content_type: "homework",
  title: "Fractions Homework",
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-02T11:00:00.000Z",
  stewardship_state: "APPROVED",
  current_version_id: VERSION_ID,
  published_version_id: VERSION_ID,
  teaching_work_id: WORK_ID,
  review_navigation: {
    content_id: CONTENT_ID,
    version_id: VERSION_ID,
  },
  aggregate_revision: 4,
};

const libraryVersion = {
  content_id: CONTENT_ID,
  version_id: VERSION_ID,
  version_number: 1,
  content_type: "homework",
  title: "Fractions Homework",
  stewardship_state: "APPROVED",
  schema_id: "education.homework",
  schema_version: 1,
  payload: homeworkPayload,
  payload_sha256: "payload-hash-must-not-show",
  origin: "AI",
  created_at: "2026-09-01T10:00:00.000Z",
  published_version_id: VERSION_ID,
  current_version_id: VERSION_ID,
  teaching_work_id: WORK_ID,
  aggregate_revision: 4,
};

function isLibraryItemPath(url: string) {
  return (
    url.includes(`/api/v1/teacher-os/library/${CONTENT_ID}`) &&
    !url.includes("/versions/")
  );
}

function isLibraryVersionPath(url: string) {
  return url.includes(
    `/api/v1/teacher-os/library/${CONTENT_ID}/versions/${VERSION_ID}`,
  );
}

function stubLibraryReady() {
  stubFetch((call) => {
    if (isLibraryItemPath(call.url)) {
      return mockJsonResponse(libraryDetail);
    }
    if (isLibraryVersionPath(call.url)) {
      return mockJsonResponse(libraryVersion);
    }
    return mockJsonResponse(
      { title: "Not Found", status: 404 },
      { status: 404 },
    );
  });
}

describe("LibraryDetailPage", () => {
  it("uses ArtifactRenderer and does not stringify the payload", async () => {
    stubLibraryReady();
    renderApp(DETAIL_ROUTE);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Fractions Homework",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Preview the published resource and use it in your teaching workflow.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Owner-scoped open\/preview/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Homework").length).toBeGreaterThan(0);
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByText("APPROVED")).not.toBeInTheDocument();
    expect(screen.getByTestId("library-artifact")).toBeInTheDocument();
    expect(
      screen.getByText("Complete at home."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Shade a model that shows 1/2."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("library-version-payload")).toBeNull();
    expect(document.querySelector("pre.library-payload")).toBeNull();
    expect(document.body.textContent).not.toContain(
      JSON.stringify(homeworkPayload, null, 2),
    );
    expect(
      screen.queryByText("payload-hash-must-not-show"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("education.homework")).not.toBeInTheDocument();
    expect(screen.queryByText("SECRET_ANSWER_2_4")).not.toBeInTheDocument();
  });

  it("retains Open in Work, Work, and Review actions", async () => {
    stubLibraryReady();
    renderApp(DETAIL_ROUTE);
    expect(
      await screen.findByRole("link", { name: "Open in Work" }),
    ).toHaveAttribute(
      "href",
      `/teacher-os/work/${WORK_ID}/artifacts/${CONTENT_ID}/versions/${VERSION_ID}`,
    );
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "href",
      `/teacher-os/work/${WORK_ID}`,
    );
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      `/teacher-os/review/${CONTENT_ID}/versions/${VERSION_ID}`,
    );
  });

  it("retains the loading state", async () => {
    stubFetch(() => new Promise(() => {}));
    renderApp(DETAIL_ROUTE);
    expect(
      await screen.findByText("Loading library item…"),
    ).toBeInTheDocument();
  });

  it("retains the error state with retry", async () => {
    stubFetch(() =>
      mockJsonResponse({ title: "Not Found", status: 404 }, { status: 404 }),
    );
    renderApp(DETAIL_ROUTE);
    expect(
      await screen.findByRole("heading", {
        name: "Could not open library item",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retains the unavailable state without a session", async () => {
    renderApp(DETAIL_ROUTE, null);
    expect(
      await screen.findByRole("heading", { name: "Session required" }),
    ).toBeInTheDocument();
  });

  it("shows a teacher-friendly empty version state", async () => {
    stubFetch((call) => {
      if (isLibraryItemPath(call.url)) {
        return mockJsonResponse({
          ...libraryDetail,
          published_version_id: null,
          current_version_id: null,
          teaching_work_id: null,
          review_navigation: null,
        });
      }
      return mockJsonResponse(
        { title: "Not Found", status: 404 },
        { status: 404 },
      );
    });
    renderApp(DETAIL_ROUTE);
    expect(
      await screen.findByText("No version is available to open yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open in Work" }),
    ).not.toBeInTheDocument();
  });
});
