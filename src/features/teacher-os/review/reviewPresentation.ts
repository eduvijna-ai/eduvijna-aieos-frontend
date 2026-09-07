import { artifactTypeLabel } from "@/features/teacher-os/artifacts/artifactLabels";
import { stewardshipStatusLabel } from "@/features/teacher-os/work/stewardshipLabel";
import { humanizeSnakeCase } from "@/features/teacher-os/work/qualityPresentation";

export function reviewArtifactTypeLabel(
  contentType: string | null | undefined,
): string {
  return artifactTypeLabel(contentType);
}

export function reviewStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return stewardshipStatusLabel(status);
}

export function originQueueLabel(origin: string | null | undefined): string {
  if (!origin) return "";
  if (origin === "AI") return "AI-prepared";
  if (origin === "teacher") return "Teacher-prepared";
  return humanizeSnakeCase(origin);
}

export function originPreparedLabel(origin: string | null | undefined): string {
  if (!origin) return "";
  if (origin === "AI") return "Prepared by AI";
  if (origin === "teacher") return "Prepared by you";
  return humanizeSnakeCase(origin);
}

export function reviewPageTitle(contentType: string | null | undefined): string {
  return `Review ${reviewArtifactTypeLabel(contentType)}`;
}
