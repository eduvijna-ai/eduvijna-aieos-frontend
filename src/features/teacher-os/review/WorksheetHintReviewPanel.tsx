import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  listHintedWorksheetQuestions,
  resolveHintReviewPanelMode,
  type HintedWorksheetQuestion,
} from "@/features/teacher-os/library/worksheetHintAuthorPolicy";
import { postWorksheetLearnerHintAttestation } from "@/services/api/worksheetHintAuthoringApi";
import type { DevSession } from "@/services/session/DevSessionConnector";
import { ApiError, userMessageForApiError } from "@/shared/errors/ApiError";
import { ErrorState } from "@/shared/components/ErrorState";

export type HintAttestationCheckState = {
  hardBlockClear: boolean;
  humanReviewPass: boolean;
};

type WorksheetHintReviewPanelProps = {
  contentId: string;
  versionId: string;
  schemaId: string | null | undefined;
  schemaVersion: number | null | undefined;
  payload: unknown;
  contentEtag: string | null;
  session: DevSession | null;
  resourceGeneration: number;
  onAttestationRecorded: (identity: HintReviewResourceIdentity) => void;
  disabled?: boolean;
};

export type HintReviewResourceIdentity = {
  contentId: string;
  versionId: string;
  contentEtag: string | null;
  payloadRef: unknown;
  session: DevSession | null;
  resourceGeneration: number;
};

export function hintReviewResourceIdentityLive(
  captured: HintReviewResourceIdentity,
  current: HintReviewResourceIdentity | null,
): boolean {
  if (!current) return false;
  return (
    captured.contentId === current.contentId &&
    captured.versionId === current.versionId &&
    captured.contentEtag === current.contentEtag &&
    captured.payloadRef === current.payloadRef &&
    captured.session === current.session &&
    captured.resourceGeneration === current.resourceGeneration
  );
}

export function worksheetHintReviewRequired(
  schemaId: string | null | undefined,
  schemaVersion: number | null | undefined,
  payload: unknown,
): boolean {
  return resolveHintReviewPanelMode(schemaId, schemaVersion, payload).kind ===
    "review";
}

export function WorksheetHintReviewPanel({
  contentId,
  versionId,
  schemaId,
  schemaVersion,
  payload,
  contentEtag,
  session,
  resourceGeneration,
  onAttestationRecorded,
  disabled = false,
}: WorksheetHintReviewPanelProps) {
  const panelMode = resolveHintReviewPanelMode(schemaId, schemaVersion, payload);
  const hintedQuestions = useMemo(
    () =>
      panelMode.kind === "review"
        ? (listHintedWorksheetQuestions(payload) ?? [])
        : [],
    [panelMode.kind, payload],
  );

  const [checks, setChecks] = useState<Record<string, HintAttestationCheckState>>(
    {},
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const bindRef = useRef<string | null>(null);
  const sessionRef = useRef(session);
  const resourceGenerationRef = useRef(resourceGeneration);
  const resourceIdentityRef = useRef<HintReviewResourceIdentity | null>(null);

  useEffect(() => {
    sessionRef.current = session;
    resourceGenerationRef.current = resourceGeneration;
  }, [session, resourceGeneration]);

  const resourceIdentity: HintReviewResourceIdentity = useMemo(
    () => ({
      contentId,
      versionId,
      contentEtag,
      payloadRef: payload,
      session,
      resourceGeneration,
    }),
  [
    contentId,
    versionId,
    contentEtag,
    payload,
    session,
    resourceGeneration,
  ]);

  const resetPanelState = useCallback(() => {
    setChecks({});
    setStatusMessage("");
    setBusy(false);
    idempotencyKeyRef.current = null;
    bindRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const prior = resourceIdentityRef.current;
    resourceIdentityRef.current = resourceIdentity;
    if (prior === null) return;
    const changed =
      prior.contentId !== resourceIdentity.contentId ||
      prior.versionId !== resourceIdentity.versionId ||
      prior.contentEtag !== resourceIdentity.contentEtag ||
      prior.payloadRef !== resourceIdentity.payloadRef ||
      prior.session !== resourceIdentity.session ||
      prior.resourceGeneration !== resourceIdentity.resourceGeneration;
    if (changed) {
      resetPanelState();
    }
  }, [resourceIdentity, resetPanelState]);

  function setCheck(
    questionId: string,
    field: keyof HintAttestationCheckState,
    value: boolean,
  ) {
    setChecks((prev) => ({
      ...prev,
      [questionId]: {
        hardBlockClear: prev[questionId]?.hardBlockClear ?? false,
        humanReviewPass: prev[questionId]?.humanReviewPass ?? false,
        [field]: value,
      },
    }));
  }

  const allAcknowledged = hintedQuestions.every((question) => {
    const state = checks[question.questionId];
    return state?.hardBlockClear === true && state?.humanReviewPass === true;
  });

  async function recordAttestation() {
    if (!contentEtag) {
      setStatusMessage("This review page is out of date. Reload and try again.");
      return;
    }
    if (!allAcknowledged) {
      setStatusMessage(
        "Confirm mechanical safety and pedagogical review for every hinted question.",
      );
      return;
    }

    const currentIdentity = resourceIdentityRef.current;
    if (!currentIdentity?.contentEtag) {
      setStatusMessage("This review page is out of date. Reload and try again.");
      return;
    }

    const startIdentity: HintReviewResourceIdentity = { ...currentIdentity };

    const bind = `${startIdentity.contentId}:${startIdentity.versionId}:${startIdentity.contentEtag}`;
    if (bindRef.current !== bind || !idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
      bindRef.current = bind;
    }

    const per_question_outcomes = hintedQuestions.map(
      (question: HintedWorksheetQuestion) => {
        const state = checks[question.questionId];
        return {
          question_id: question.questionId,
          hard_block_clear: state?.hardBlockClear === true,
          human_review_pass: state?.humanReviewPass === true,
        };
      },
    );

    setBusy(true);
    setStatusMessage("");
    try {
      await postWorksheetLearnerHintAttestation(
        startIdentity.contentId,
        startIdentity.versionId,
        { per_question_outcomes },
        startIdentity.contentEtag!,
        idempotencyKeyRef.current!,
      );
      if (!hintReviewResourceIdentityLive(startIdentity, resourceIdentityRef.current)) {
        return;
      }
      setStatusMessage(
        "Attestation recorded. You can now approve if you are an authorized reviewer.",
      );
      onAttestationRecorded(startIdentity);
    } catch (error) {
      if (!hintReviewResourceIdentityLive(startIdentity, resourceIdentityRef.current)) {
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setStatusMessage(
          "An attestation may already exist for this version. Try approving, or reload if the server still requires attestation.",
        );
        return;
      }
      if (error instanceof ApiError && error.code === "precondition_failed") {
        setStatusMessage(
          "This resource was updated elsewhere. Reload and complete attestation again.",
        );
        return;
      }
      setStatusMessage(userMessageForApiError(error));
    } finally {
      if (hintReviewResourceIdentityLive(startIdentity, resourceIdentityRef.current)) {
        setBusy(false);
      }
    }
  }

  if (panelMode.kind === "hidden") {
    return null;
  }

  if (panelMode.kind === "invalid") {
    return (
      <ErrorState
        title="Cannot review learner hints"
        message={panelMode.reason}
      />
    );
  }

  return (
    <section
      className="panel review-hint-attestation"
      aria-labelledby="hint-attestation-heading"
      data-testid="worksheet-hint-review"
    >
      <h2 id="hint-attestation-heading">Learner hint review</h2>
      <p className="muted">
        The server performs authoritative mechanical checks when attestation is
        stored. Confirm each hint yourself; the checklist below is advisory
        only and is not a server QA result.
      </p>
      <ul className="review-hint-list">
        {hintedQuestions.map((question) => (
          <li key={question.questionId} className="review-hint-card">
            <p>
              <strong>{question.questionId}</strong>: {question.prompt}
            </p>
            {question.options.length > 0 ? (
              <ul>
                {question.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            ) : null}
            <p>
              <span className="muted">Hint: </span>
              {question.hintText}
            </p>
            <label className="review-confirm">
              <input
                type="checkbox"
                checked={checks[question.questionId]?.hardBlockClear === true}
                disabled={disabled || busy}
                onChange={(event) =>
                  setCheck(
                    question.questionId,
                    "hardBlockClear",
                    event.target.checked,
                  )
                }
              />
              I inspected this hint for obvious mechanical safety issues (no
              URLs, markup, PII, or answer giveaway).
            </label>
            <label className="review-confirm">
              <input
                type="checkbox"
                checked={checks[question.questionId]?.humanReviewPass === true}
                disabled={disabled || busy}
                onChange={(event) =>
                  setCheck(
                    question.questionId,
                    "humanReviewPass",
                    event.target.checked,
                  )
                }
              />
              I confirm this hint is pedagogically appropriate for learners.
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn"
        disabled={disabled || busy || !allAcknowledged}
        onClick={() => void recordAttestation()}
      >
        Record structured attestation
      </button>
      <p className="status-region" aria-live="assertive" role="status">
        {statusMessage}
      </p>
    </section>
  );
}