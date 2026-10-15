import { useEffect, useState } from "react";
import {
  getStudentAssignment,
  type StudentAssignmentResponse,
} from "@/services/api/studentLearningApi";

type CacheEntry =
  | { status: "ok"; assignment: StudentAssignmentResponse }
  | { status: "failed" };

const detailCache = new Map<string, CacheEntry>();
const inFlightDetail = new Map<string, Promise<StudentAssignmentResponse>>();

export function clearAssignmentDetailCacheForTests(): void {
  detailCache.clear();
  inFlightDetail.clear();
}

export function listItemNeedsDetailEnrichment(
  assignment: StudentAssignmentResponse,
): boolean {
  return assignment.resource == null;
}

/** Merge detail resource onto list/home authority fields (progress, timing, ids). */
export function mergeAssignmentDetailResource(
  listItem: StudentAssignmentResponse,
  detail: StudentAssignmentResponse,
): StudentAssignmentResponse {
  if (detail.resource == null) return listItem;
  return { ...listItem, resource: detail.resource };
}

export function useEnrichedAssignmentForCard(
  listItem: StudentAssignmentResponse,
): StudentAssignmentResponse {
  const [displayed, setDisplayed] = useState(listItem);

  useEffect(() => {
    setDisplayed(listItem);
    if (!listItemNeedsDetailEnrichment(listItem)) {
      return;
    }

    const assignmentId = listItem.assignment_id;
    const cached = detailCache.get(assignmentId);
    if (cached?.status === "ok") {
      setDisplayed(mergeAssignmentDetailResource(listItem, cached.assignment));
      return;
    }
    if (cached?.status === "failed") {
      return;
    }

    let cancelled = false;
    void getStudentAssignment(assignmentId)
      .then(({ data }) => {
        detailCache.set(assignmentId, { status: "ok", assignment: data });
        if (!cancelled) {
          setDisplayed(mergeAssignmentDetailResource(listItem, data));
        }
      })
      .catch(() => {
        detailCache.set(assignmentId, { status: "failed" });
      });

    return () => {
      cancelled = true;
    };
  }, [listItem]);

  return displayed;
}
