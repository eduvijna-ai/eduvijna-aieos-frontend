import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as studentLearningApi from "@/services/api/studentLearningApi";
import { ASSIGNMENT_ID, sampleAssignment } from "../studentOs.fixtures";
import { AssignmentCardFromList } from "./AssignmentCardFromList";
import { clearAssignmentDetailCacheForTests } from "./assignmentCardEnrichment";

function renderCard(assignment: ReturnType<typeof sampleAssignment>) {
  return render(
    <MemoryRouter>
      <ul>
        <AssignmentCardFromList assignment={assignment} />
      </ul>
    </MemoryRouter>,
  );
}

describe("assignment card list enrichment", () => {
  afterEach(() => {
    clearAssignmentDetailCacheForTests();
    vi.restoreAllMocks();
  });

  it("fetches assignment detail when list item omits resource", async () => {
    const listItem = sampleAssignment({ resource: null });
    const detail = sampleAssignment();
    const getStudentAssignment = vi
      .spyOn(studentLearningApi, "getStudentAssignment")
      .mockResolvedValue({
        data: detail,
        etag: null,
        status: 200,
        headers: new Headers(),
      });

    renderCard(listItem);

    expect(
      screen.getByRole("heading", { name: "Assigned work" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Leaf parts worksheet" }),
      ).toBeInTheDocument();
    });
    expect(getStudentAssignment).toHaveBeenCalledTimes(1);
    expect(getStudentAssignment).toHaveBeenCalledWith(ASSIGNMENT_ID);
    expect(screen.getByText("Worksheet")).toBeInTheDocument();
  });

  it("keeps neutral fallback when detail enrichment fails", async () => {
    vi.spyOn(studentLearningApi, "getStudentAssignment").mockRejectedValue(
      new Error("network"),
    );
    renderCard(sampleAssignment({ resource: null }));
    await waitFor(() => {
      expect(studentLearningApi.getStudentAssignment).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("heading", { name: "Assigned work" }),
    ).toBeInTheDocument();
  });
});
