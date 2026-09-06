/**
 * Teacher OS Library projection types (TOS-DEV10-I02).
 * Prefer regenerating full OpenAPI types via `pnpm generate:api-types` when practical.
 */

export type TeacherLibraryReviewNavigation = {
  content_id: string;
  version_id: string;
};

export type TeacherLibraryItem = {
  content_id: string;
  content_type: string;
  title: string;
  created_at: string;
  updated_at: string;
  stewardship_state: string;
  current_version_id: string | null;
  published_version_id: string | null;
  teaching_work_id: string | null;
  review_navigation: TeacherLibraryReviewNavigation | null;
};

export type TeacherLibraryList = {
  items: TeacherLibraryItem[];
  next_cursor: string | null;
};

export type TeacherLibraryDetail = TeacherLibraryItem & {
  aggregate_revision: number;
};

export type TeacherLibraryVersion = {
  content_id: string;
  version_id: string;
  version_number: number;
  content_type: string;
  title: string;
  stewardship_state: string;
  schema_id: string;
  schema_version: number;
  payload: Record<string, unknown>;
  payload_sha256: string;
  origin: string;
  created_at: string;
  published_version_id: string | null;
  current_version_id: string | null;
  teaching_work_id: string | null;
  aggregate_revision: number;
};

export type ListLibraryOptions = {
  limit?: number;
  cursor?: string | null;
  content_type?: string | null;
  stewardship_state?: string | null;
  published_only?: boolean | null;
};
