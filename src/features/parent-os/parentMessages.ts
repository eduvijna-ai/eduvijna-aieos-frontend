import { ApiError } from "@/shared/errors/ApiError";

function isUnavailableStatus(error: ApiError): boolean {
  if (error.code === "unavailable" || error.code === "network") return true;
  return error.status !== null && error.status >= 500;
}

export function parentMessageForApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized" || error.status === 401) {
      return "Your session is not currently accepted. Connect a valid development session and try again.";
    }
    if (error.code === "forbidden" || error.status === 403) {
      return "The current adult does not have Parent Intelligence access.";
    }
    if (error.code === "not_found" || error.status === 404) {
      return "This child is not available.";
    }
    if (isUnavailableStatus(error)) {
      return "Parent information is temporarily unavailable.";
    }
  }
  return "Parent information is temporarily unavailable.";
}

export function parentErrorTitle(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized" || error.status === 401) {
      return "Session is not currently accepted";
    }
    if (error.code === "forbidden" || error.status === 403) {
      return "Parent Intelligence access is not available";
    }
    if (error.code === "not_found" || error.status === 404) {
      return "This child is not available.";
    }
    if (error.status === 503 || error.code === "unavailable") {
      return "Parent information is temporarily unavailable";
    }
  }
  return "Parent information is temporarily unavailable";
}

export function isParentChildConcealment(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "not_found" || error.status === 404)
  );
}
