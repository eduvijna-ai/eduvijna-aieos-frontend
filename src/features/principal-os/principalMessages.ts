import { ApiError } from "@/shared/errors/ApiError";

function isUnavailableStatus(error: ApiError): boolean {
  if (error.code === "unavailable" || error.code === "network") return true;
  return error.status !== null && error.status >= 500;
}

export function principalMessageForApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized" || error.status === 401) {
      return "Your session is not currently accepted. Connect a valid development session and try again.";
    }
    if (error.code === "forbidden" || error.status === 403) {
      return "The current Principal does not have School Intelligence access.";
    }
    if (isUnavailableStatus(error)) {
      if (error.status === 503 || error.code === "unavailable") {
        return "School Intelligence is temporarily unavailable because current authority or a required source could not be resolved.";
      }
      return "School Intelligence is temporarily unavailable.";
    }
  }
  return "School Intelligence is temporarily unavailable.";
}

export function principalErrorTitle(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized" || error.status === 401) {
      return "Session is not currently accepted";
    }
    if (error.code === "forbidden" || error.status === 403) {
      return "School Intelligence access is not available";
    }
    if (error.status === 503 || error.code === "unavailable") {
      return "School Intelligence is temporarily unavailable";
    }
  }
  return "School Intelligence is temporarily unavailable";
}
