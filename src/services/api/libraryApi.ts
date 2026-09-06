import { apiRequest } from "./client";
import type {
  ListLibraryOptions,
  TeacherLibraryDetail,
  TeacherLibraryList,
  TeacherLibraryVersion,
} from "./generated/libraryTypes";

export async function listLibrary(options?: ListLibraryOptions) {
  return apiRequest<TeacherLibraryList>("/api/v1/teacher-os/library", {
    method: "GET",
    query: {
      limit: options?.limit ?? 100,
      cursor: options?.cursor ?? undefined,
      content_type: options?.content_type ?? undefined,
      stewardship_state: options?.stewardship_state ?? undefined,
      published_only: options?.published_only ? "true" : undefined,
    },
  });
}

export async function getLibraryItem(contentId: string) {
  return apiRequest<TeacherLibraryDetail>(
    `/api/v1/teacher-os/library/${contentId}`,
    { method: "GET" },
  );
}

export async function getLibraryVersion(contentId: string, versionId: string) {
  return apiRequest<TeacherLibraryVersion>(
    `/api/v1/teacher-os/library/${contentId}/versions/${versionId}`,
    { method: "GET" },
  );
}
