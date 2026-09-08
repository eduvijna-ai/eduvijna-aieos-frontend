import {
  ApiError,
  problemCodeFromApiError,
  userMessageForApiError,
} from "@/shared/errors/ApiError";

const PROBLEM_MESSAGES: Record<string, string> = {
  assignment_not_found: "This assignment is not available.",
  attempt_not_found: "This work could not be found.",
  assignment_closed_or_cancelled:
    "This assignment is closed or cancelled, so it cannot be changed.",
  assignment_not_yet_available:
    "This assignment is not available yet.",
  attempt_in_progress_conflict:
    "You already have work in progress for this assignment.",
  second_attempt_not_authorized:
    "This assignment allows one attempt. You cannot start another.",
  attempt_already_submitted:
    "This work is already submitted and cannot be changed.",
  idempotency_key_reused:
    "This action does not match the original request. Refresh and try again.",
  invalid_cursor:
    "That page link is not valid. Start again from the first page of assignments.",
  response_validation_failed:
    "One of the answers could not be saved. Check your responses and try again.",
  school_context_unavailable:
    "Your class membership could not be confirmed right now. Try again shortly.",
  persistence_operation_failed:
    "Student work is temporarily unavailable.",
};

export function studentMessageForApiError(error: unknown): string {
  const code = problemCodeFromApiError(error);
  if (code && PROBLEM_MESSAGES[code]) {
    return PROBLEM_MESSAGES[code];
  }
  if (error instanceof ApiError) {
    if (error.code === "unauthorized" || error.code === "forbidden") {
      return "You do not have access to this student work. Connect a valid student session and try again.";
    }
    if (error.code === "precondition_failed") {
      return "This work changed since you last loaded it. Refresh and try again.";
    }
    if (error.code === "not_found") {
      return "This assignment or work is not available.";
    }
    if (error.code === "network") {
      return "Could not reach the server. Check your connection and retry the same action.";
    }
  }
  return userMessageForApiError(error);
}
