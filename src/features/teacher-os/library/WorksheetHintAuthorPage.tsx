import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { getLibraryItem, getLibraryVersion } from "@/services/api/libraryApi";
import type { TeacherLibraryDetail } from "@/services/api/generated/libraryTypes";
import { getContent } from "@/services/api/contentApi";
import {
  listAssignableClasses,
  type SchoolContextClassItem,
} from "@/services/api/teachingAssignmentsApi";
import {
  postContentSubmitForReview,
  postWorksheetLearnerHintVersionAppend,
} from "@/services/api/worksheetHintAuthoringApi";
import type { DevSession } from "@/services/session/DevSessionConnector";
import { useSession } from "@/services/session/useSession";
import { ApiError, userMessageForApiError } from "@/shared/errors/ApiError";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import {
  buildWorksheetHintAppendPayload,
  countAppendableHints,
  hintIssueMessage,
  libraryItemEligibleForHintAuthoring,
  parseWorksheetHintSourceForAuthoring,
  validateDraftHintText,
  WORKSHEET_HINT_SCHEMA_VERSION,
  worksheetQuestionBindingSignature,
} from "./worksheetHintAuthorPolicy";
import "./library.css";

type LoadFence = {
  generation: number;
  session: DevSession | null;
  contentId: string;
};

type MutationFence = {
  generation: number;
  session: DevSession | null;
  contentId: string;
  sourceVersionId: string | null;
};

function reviewNavigationMatchesVersion(
  detail: TeacherLibraryDetail,
  versionId: string,
): boolean {
  return detail.review_navigation?.version_id === versionId;
}

function mutationFenceStale(
  fence: MutationFence,
  generation: number,
  session: DevSession | null,
  contentId: string,
): boolean {
  return (
    fence.generation !== generation ||
    fence.session !== session ||
    fence.contentId !== contentId
  );
}

const OUT_OF_DATE_MESSAGE =
  "This worksheet changed elsewhere. Reload the latest source and reconcile your unsaved hints before trying again.";
const AMBIGUOUS_APPEND_MESSAGE =
  "The save result is uncertain. Your draft is still here — reload or retry only after checking the latest version.";
const AMBIGUOUS_SUBMIT_MESSAGE =
  "The submit result is uncertain. Your worksheet and drafts are unchanged — reload or retry only after checking the server state.";
const RECONCILIATION_MESSAGE =
  "The worksheet source changed. Review the updated questions, reapply any saved hint text, then preview again before creating a version.";

type SourceBinding = {
  versionId: string;
  signature: string;
  questionsById: Record<string, Record<string, unknown>>;
};

export function WorksheetHintAuthorPage() {
  const { contentId = "" } = useParams();
  const { isConnected, isProduction, session } = useSession();
  const sessionRef = useRef(session);
  const contentIdRef = useRef(contentId);
  useEffect(() => {
    sessionRef.current = session;
    contentIdRef.current = contentId;
  }, [session, contentId]);

  const loadGenerationRef = useRef(0);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const bumpLoadGeneration = useCallback(() => {
    loadGenerationRef.current += 1;
    setLoadGeneration(loadGenerationRef.current);
  }, []);

  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [title, setTitle] = useState("Worksheet");
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [contentEtag, setContentEtag] = useState<string | null>(null);
  const [sourcePayload, setSourcePayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [questionsById, setQuestionsById] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [hintDrafts, setHintDrafts] = useState<Record<string, string>>({});
  const [fieldIssues, setFieldIssues] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<SchoolContextClassItem[]>([]);
  const [classRef, setClassRef] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [busyAppend, setBusyAppend] = useState(false);
  const [busySubmitReview, setBusySubmitReview] = useState(false);
  const [createdVersionId, setCreatedVersionId] = useState<string | null>(null);
  const [createdContentEtag, setCreatedContentEtag] = useState<string | null>(
    null,
  );
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [unassignedDrafts, setUnassignedDrafts] = useState<
    Record<string, string>
  >({});

  const boundSourceRef = useRef<SourceBinding | null>(null);
  const appendKeyRef = useRef<string | null>(null);
  const appendMaterialRef = useRef<string | null>(null);
  const submitKeyRef = useRef<string | null>(null);
  const submitVersionRef = useRef<string | null>(null);
  const submitMaterialRef = useRef<string | null>(null);
  const appendInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const createdMaterialRef = useRef<string | null>(null);

  const appendMaterialFingerprint = useMemo(
    () =>
      JSON.stringify({
        classRef: classRef.trim(),
        hints: hintDrafts,
        sourceVersionId: currentVersionId,
      }),
    [classRef, hintDrafts, currentVersionId],
  );

  const loadFenceStale = useCallback(
    (fence: LoadFence) =>
      fence.generation !== loadGenerationRef.current ||
      fence.session !== sessionRef.current ||
      fence.contentId !== contentIdRef.current,
    [],
  );

  const purgeAuthorState = useCallback(() => {
    setSourcePayload(null);
    setQuestionIds([]);
    setQuestionsById({});
    setHintDrafts({});
    setFieldIssues({});
    setClassRef("");
    setShowPreview(false);
    setCreatedVersionId(null);
    setCreatedContentEtag(null);
    setContentEtag(null);
    setCurrentVersionId(null);
    appendKeyRef.current = null;
    appendMaterialRef.current = null;
    submitKeyRef.current = null;
    submitVersionRef.current = null;
    submitMaterialRef.current = null;
    appendInFlightRef.current = false;
    submitInFlightRef.current = false;
    setBusyAppend(false);
    setBusySubmitReview(false);
    createdMaterialRef.current = null;
    boundSourceRef.current = null;
    setReconciliationRequired(false);
    setUnassignedDrafts({});
  }, []);

  const invalidateAuthorSync = useCallback(() => {
    bumpLoadGeneration();
    purgeAuthorState();
    setErrorMessage("");
    setStatusMessage("");
  }, [bumpLoadGeneration, purgeAuthorState]);

  const priorSessionRef = useRef<DevSession | null | undefined>(undefined);
  useLayoutEffect(() => {
    const prior = priorSessionRef.current;
    priorSessionRef.current = session;
    if (prior !== undefined && prior !== session) {
      invalidateAuthorSync();
      setStatus(isConnected || isProduction ? "loading" : "unavailable");
    }
  }, [session, invalidateAuthorSync, isConnected, isProduction]);

  const priorContentRef = useRef(contentId);
  useLayoutEffect(() => {
    if (priorContentRef.current !== contentId) {
      priorContentRef.current = contentId;
      invalidateAuthorSync();
      setStatus(isConnected || isProduction ? "loading" : "unavailable");
    }
  }, [contentId, invalidateAuthorSync, isConnected, isProduction]);

  const applyAuthoringSource = useCallback(
    (
      parsed: {
        payload: Record<string, unknown>;
        questionIds: string[];
      },
      versionId: string,
      contentEtagValue: string,
      preservedDrafts: Record<string, string>,
      requireReconciliationOnDrift: boolean,
    ): boolean => {
      const questionMap: Record<string, Record<string, unknown>> = {};
      const ids: string[] = [];
      for (const entry of parsed.payload.questions as unknown[]) {
        if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
          const record = entry as Record<string, unknown>;
          const id = typeof record.id === "string" ? record.id : "";
          if (id) {
            questionMap[id] = record;
            ids.push(id);
          }
        }
      }
      const signature = worksheetQuestionBindingSignature(ids, questionMap);
      const prior = boundSourceRef.current;
      const drifted =
        requireReconciliationOnDrift &&
        prior !== null &&
        (prior.versionId !== versionId || prior.signature !== signature);

      const nextDrafts: Record<string, string> = {};
      const orphans: Record<string, string> = {};
      for (const id of ids) {
        nextDrafts[id] = preservedDrafts[id] ?? "";
      }
      for (const [id, text] of Object.entries(preservedDrafts)) {
        if (!ids.includes(id) && text.trim()) {
          orphans[id] = text;
        }
      }

      if (drifted && prior) {
        for (const id of ids) {
          const draft = preservedDrafts[id];
          if (!draft?.trim()) continue;
          const oldQuestion = prior.questionsById[id];
          const newQuestion = questionMap[id];
          if (!oldQuestion) continue;
          const sameBinding =
            typeof oldQuestion.prompt === "string" &&
            oldQuestion.prompt === newQuestion?.prompt &&
            String(oldQuestion.answer ?? "") === String(newQuestion?.answer ?? "");
          if (!sameBinding) {
            orphans[`${id} (previous source)`] = draft;
            nextDrafts[id] = "";
          }
        }
        setReconciliationRequired(true);
        setShowPreview(false);
        setCreatedVersionId(null);
        setCreatedContentEtag(null);
        createdMaterialRef.current = null;
        appendKeyRef.current = null;
        appendMaterialRef.current = null;
        submitKeyRef.current = null;
        submitVersionRef.current = null;
        submitMaterialRef.current = null;
        setFieldIssues({});
      }

      setContentEtag(contentEtagValue);
      setCurrentVersionId(versionId);
      setSourcePayload(parsed.payload);
      setQuestionIds(ids);
      setQuestionsById(questionMap);
      setHintDrafts(nextDrafts);
      setUnassignedDrafts((prev) => ({ ...prev, ...orphans }));
      boundSourceRef.current = {
        versionId,
        signature,
        questionsById: questionMap,
      };
      return drifted;
    },
    [],
  );

  const reloadMetadataPreservingDrafts = useCallback(
    async (draftSnapshot: Record<string, string>) => {
      const fence: LoadFence = {
        generation: loadGenerationRef.current,
        session: sessionRef.current,
        contentId,
      };
      try {
        const [, contentResponse] = await Promise.all([
          getLibraryItem(contentId),
          getContent(contentId),
        ]);
        if (loadFenceStale(fence)) return;
        const versionId = contentResponse.data.current_version_id;
        if (!versionId) return;
        const versionResponse = await getLibraryVersion(contentId, versionId);
        if (loadFenceStale(fence)) return;
        const version = versionResponse.data;
        if (version.content_id !== contentId || version.version_id !== versionId) {
          return;
        }
        const reparsed = parseWorksheetHintSourceForAuthoring(version.payload);
        if (!reparsed.ok) {
          setStatusMessage(reparsed.reason);
          setHintDrafts(draftSnapshot);
          return;
        }
        if (!contentResponse.etag) {
          setStatusMessage(OUT_OF_DATE_MESSAGE);
          setHintDrafts(draftSnapshot);
          return;
        }
        const needsReconcile = applyAuthoringSource(
          reparsed,
          versionId,
          contentResponse.etag,
          draftSnapshot,
          true,
        );
        setStatusMessage(
          needsReconcile ? RECONCILIATION_MESSAGE : OUT_OF_DATE_MESSAGE,
        );
      } catch {
        if (!loadFenceStale(fence)) {
          setStatusMessage(OUT_OF_DATE_MESSAGE);
        }
      }
    },
    [applyAuthoringSource, contentId, loadFenceStale],
  );

  const load = useCallback(async (options?: { preserveDrafts?: Record<string, string> }) => {
    if (!isConnected && !isProduction) {
      setStatus("unavailable");
      return;
    }
    if (!contentId) {
      setStatus("error");
      setErrorMessage("Missing content id.");
      return;
    }
    const fence: LoadFence = {
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
    };
    setStatus("loading");
    setErrorMessage("");
    setStatusMessage("");
    try {
      const [libraryResponse, contentResponse, classesResponse] =
        await Promise.all([
          getLibraryItem(contentId),
          getContent(contentId),
          listAssignableClasses(),
        ]);
      if (loadFenceStale(fence)) return;

      const detail = libraryResponse.data;
      const content = contentResponse.data;
      const versionId = content.current_version_id;
      if (!versionId) {
        setStatus("error");
        setErrorMessage(
          "This worksheet has no authoritative current version to author from.",
        );
        return;
      }

      const versionResponse = await getLibraryVersion(contentId, versionId);
      if (loadFenceStale(fence)) return;

      const version = versionResponse.data;
      if (version.content_id !== contentId || version.version_id !== versionId) {
        setStatus("error");
        setErrorMessage("Worksheet version binding does not match this content.");
        return;
      }
      if (
        !libraryItemEligibleForHintAuthoring(
          detail.content_type,
          version.schema_id,
          version.schema_version,
        )
      ) {
        setStatus("error");
        setErrorMessage(
          "Learner hints can only be added to governed education.worksheet versions.",
        );
        return;
      }

      const parsed = parseWorksheetHintSourceForAuthoring(version.payload);
      if (!parsed.ok) {
        setStatus("error");
        setErrorMessage(parsed.reason);
        return;
      }

      const preserved = options?.preserveDrafts;
      const drafts: Record<string, string> = preserved ? { ...preserved } : {};
      if (!preserved) {
        const questionMap: Record<string, Record<string, unknown>> = {};
        for (const entry of parsed.payload.questions as unknown[]) {
          if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
            const record = entry as Record<string, unknown>;
            const id = typeof record.id === "string" ? record.id : "";
            if (id) {
              questionMap[id] = record;
            }
          }
        }
        for (const id of parsed.questionIds) {
          const existing = questionMap[id]?.learner_hint;
          if (typeof existing === "string" && existing.trim()) {
            drafts[id] = existing.trim();
          } else {
            drafts[id] = "";
          }
        }
      }

      if (!contentResponse.etag) {
        setStatus("error");
        setErrorMessage("Content revision is missing; cannot author hints.");
        return;
      }

      setTitle(detail.title);
      setReconciliationRequired(false);
      setUnassignedDrafts({});
      applyAuthoringSource(
        parsed,
        versionId,
        contentResponse.etag,
        drafts,
        false,
      );
      setCreatedVersionId(null);
      setCreatedContentEtag(null);
      createdMaterialRef.current = null;
      setClasses(classesResponse.data.items);
      setStatus("ready");
    } catch (error) {
      if (loadFenceStale(fence)) return;
      setErrorMessage(userMessageForApiError(error));
      setStatus("error");
    }
  }, [applyAuthoringSource, contentId, isConnected, isProduction, loadFenceStale]);

  useEffect(() => {
    void load();
  }, [load, loadGeneration]);

  useEffect(() => {
    if (
      createdMaterialRef.current !== null &&
      createdMaterialRef.current !== appendMaterialFingerprint
    ) {
      setCreatedVersionId(null);
      setCreatedContentEtag(null);
      submitKeyRef.current = null;
      submitVersionRef.current = null;
      submitMaterialRef.current = null;
      createdMaterialRef.current = null;
      setStatusMessage(
        "Hint or class changed after the last created version. Create a new version before submitting.",
      );
    }
  }, [appendMaterialFingerprint]);

  function onHintChange(questionId: string, value: string) {
    setHintDrafts((prev) => ({ ...prev, [questionId]: value }));
    const question = questionsById[questionId];
    const issue = validateDraftHintText(value, {
      answer: question?.answer,
      explanation: question?.explanation,
    });
    setFieldIssues((prev) => {
      const next = { ...prev };
      if (!value.trim()) {
        delete next[questionId];
        return next;
      }
      if (issue.ok) {
        delete next[questionId];
      } else {
        next[questionId] = hintIssueMessage(issue.issue);
      }
      return next;
    });
  }

  const validHintCount =
    sourcePayload !== null
      ? countAppendableHints(sourcePayload, hintDrafts)
      : 0;
  const hasBlockingIssues = Object.keys(fieldIssues).length > 0;
  const canPreview =
    validHintCount >= 1 &&
    Boolean(classRef.trim()) &&
    !hasBlockingIssues &&
    !reconciliationRequired;

  function onConfirmReconciliation() {
    setReconciliationRequired(false);
    setShowPreview(false);
    setStatusMessage("");
  }

  async function onCreateHintVersion() {
    if (appendInFlightRef.current) return;
    if (!sourcePayload || !contentEtag || !classRef.trim() || !currentVersionId) {
      setStatusMessage("Select a class and add at least one valid hint.");
      return;
    }
    if (!canPreview) {
      setStatusMessage("Fix hint issues before creating a new version.");
      return;
    }
    if (!showPreview) {
      setStatusMessage("Review the preview before creating the version.");
      return;
    }

    const draftSnapshot = { ...hintDrafts };
    const bodyPayload = buildWorksheetHintAppendPayload(sourcePayload, hintDrafts);
    const material = appendMaterialFingerprint;
    if (
      appendMaterialRef.current !== material ||
      !appendKeyRef.current
    ) {
      appendKeyRef.current = crypto.randomUUID();
      appendMaterialRef.current = material;
    }

    const startFence: MutationFence = {
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
      sourceVersionId: currentVersionId,
    };
    const idempotencyKey = appendKeyRef.current;
    const etagAtStart = contentEtag;

    appendInFlightRef.current = true;
    setBusyAppend(true);
    setStatusMessage("");
    try {
      const response = await postWorksheetLearnerHintVersionAppend(
        contentId,
        {
          authoring_class_ref: classRef.trim(),
          payload: bodyPayload,
        },
        etagAtStart,
        idempotencyKey,
      );
      if (
        mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
        )
      ) {
        return;
      }
      createdMaterialRef.current = material;
      setCreatedVersionId(response.data.version_id);
      setCreatedContentEtag(response.etag);
      setStatusMessage(
        `Created hint-bearing worksheet version ${response.data.version_number}. Submit it for independent review when ready.`,
      );
    } catch (error) {
      if (
        mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
        )
      ) {
        return;
      }
      if (error instanceof ApiError && error.code === "precondition_failed") {
        setStatusMessage(OUT_OF_DATE_MESSAGE);
        await reloadMetadataPreservingDrafts(draftSnapshot);
        return;
      }
      const isTransport =
        error instanceof ApiError &&
        (error.status === 0 ||
          error.code === "network" ||
          (error.status !== null && error.status >= 500));
      if (isTransport || !(error instanceof ApiError)) {
        try {
          const contentResponse = await getContent(contentId);
          if (
            mutationFenceStale(
              startFence,
              loadGenerationRef.current,
              sessionRef.current,
              contentIdRef.current,
            )
          ) {
            return;
          }
          const nextVersionId = contentResponse.data.current_version_id;
          if (nextVersionId && nextVersionId !== startFence.sourceVersionId) {
            setStatusMessage(
              "A new worksheet version may exist. Review the latest source before creating another version.",
            );
            await reloadMetadataPreservingDrafts(draftSnapshot);
            return;
          }
        } catch {
          if (
            mutationFenceStale(
              startFence,
              loadGenerationRef.current,
              sessionRef.current,
              contentIdRef.current,
            )
          ) {
            return;
          }
        }
        setStatusMessage(AMBIGUOUS_APPEND_MESSAGE);
        setHintDrafts(draftSnapshot);
        return;
      }
      setStatusMessage(userMessageForApiError(error));
    } finally {
      if (
        !mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
        )
      ) {
        appendInFlightRef.current = false;
        setBusyAppend(false);
      }
    }
  }

  async function onSubmitForReview() {
    if (submitInFlightRef.current) return;
    if (!createdVersionId || !createdContentEtag || !createdMaterialRef.current) {
      setStatusMessage("Create the hint-bearing version before submitting.");
      return;
    }
    if (createdMaterialRef.current !== appendMaterialFingerprint) {
      setStatusMessage(
        "Current hints do not match the created version. Create a new version first.",
      );
      return;
    }
    if (
      submitVersionRef.current !== createdVersionId ||
      submitMaterialRef.current !== appendMaterialFingerprint ||
      !submitKeyRef.current
    ) {
      submitKeyRef.current = crypto.randomUUID();
      submitVersionRef.current = createdVersionId;
      submitMaterialRef.current = appendMaterialFingerprint;
    }
    const startFence: MutationFence = {
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
      sourceVersionId: createdVersionId,
    };
    const submitKey = submitKeyRef.current;
    const etagForSubmit = createdContentEtag;
    const versionForSubmit = createdVersionId;
    const draftSnapshot = { ...hintDrafts };

    submitInFlightRef.current = true;
    setBusySubmitReview(true);
    setStatusMessage("");
    try {
      await postContentSubmitForReview(
        contentId,
        versionForSubmit,
        etagForSubmit,
        submitKey,
      );
      if (
        mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
        )
      ) {
        return;
      }
      setStatusMessage(
        "Submitted for independent review. Approval and publishing remain separate steps.",
      );
    } catch (error) {
      if (
        mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
        )
      ) {
        return;
      }
      if (error instanceof ApiError && error.code === "precondition_failed") {
        setStatusMessage(OUT_OF_DATE_MESSAGE);
        await reloadMetadataPreservingDrafts(draftSnapshot);
        return;
      }
      const isTransport =
        error instanceof ApiError &&
        (error.status === 0 ||
          error.code === "network" ||
          (error.status !== null && error.status >= 500));
      if (isTransport || !(error instanceof ApiError)) {
        try {
          const [contentResponse, versionResponse, libraryResponse] =
            await Promise.all([
              getContent(contentId),
              getLibraryVersion(contentId, versionForSubmit),
              getLibraryItem(contentId),
            ]);
          if (
            mutationFenceStale(
              startFence,
              loadGenerationRef.current,
              sessionRef.current,
              contentIdRef.current,
            )
          ) {
            return;
          }
          const submitted =
            versionResponse.data.version_id === versionForSubmit &&
            (versionResponse.data.stewardship_state === "IN_REVIEW" ||
              reviewNavigationMatchesVersion(
                libraryResponse.data,
                versionForSubmit,
              ));
          if (submitted) {
            setStatusMessage(
              "Submitted for independent review. Approval and publishing remain separate steps.",
            );
            if (contentResponse.etag) {
              setCreatedContentEtag(contentResponse.etag);
            }
            return;
          }
        } catch {
          if (
            mutationFenceStale(
              startFence,
              loadGenerationRef.current,
              sessionRef.current,
              contentIdRef.current,
            )
          ) {
            return;
          }
        }
        setStatusMessage(AMBIGUOUS_SUBMIT_MESSAGE);
        return;
      }
      setStatusMessage(userMessageForApiError(error));
    } finally {
      if (
        !mutationFenceStale(
          startFence,
          loadGenerationRef.current,
          sessionRef.current,
          contentIdRef.current,
        )
      ) {
        submitInFlightRef.current = false;
        setBusySubmitReview(false);
      }
    }
  }

  return (
    <article className="stack library-page">
      <header>
        <p className="muted">
          <Link to="/teacher-os/library">Library</Link> ·{" "}
          <Link to={`/teacher-os/library/${contentId}`}>Item</Link> · Learner
          hints
        </p>
        <h1>Author learner hints</h1>
        <p className="muted">{title}</p>
        <p className="muted">
          Edits create a new immutable worksheet@{WORKSHEET_HINT_SCHEMA_VERSION}{" "}
          version. Only optional per-question learner hints change.
        </p>
      </header>

      <div className="status-region" aria-live="polite">
        {status === "loading" ? (
          <LoadingState label="Loading worksheet source…" />
        ) : null}
        {status === "unavailable" ? (
          <EmptyState
            title="Session required"
            description="Connect a DEV session to author learner hints."
          />
        ) : null}
        {status === "error" ? (
          <ErrorState
            title="Cannot author hints"
            message={errorMessage}
            onRetry={() => void load()}
          />
        ) : null}
      </div>

      {status === "ready" && sourcePayload ? (
        <section className="panel stack library-detail">
          <p className="muted">
            Authoring from current version{" "}
            <code>{currentVersionId}</code>. Answers and teacher notes stay
            private to this screen.
          </p>

          {reconciliationRequired ? (
            <div className="library-reconcile-banner" role="alert">
              <p>{RECONCILIATION_MESSAGE}</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onConfirmReconciliation}
              >
                I reviewed the updated questions
              </button>
            </div>
          ) : null}

          {Object.keys(unassignedDrafts).length > 0 ? (
            <div
              className="library-unassigned-drafts"
              data-testid="unassigned-hint-drafts"
            >
              <h2>Unassigned hint text</h2>
              <p className="muted">
                These hints are preserved from an earlier source binding. Copy
                them onto the correct questions manually.
              </p>
              <ul>
                {Object.entries(unassignedDrafts).map(([key, text]) => (
                  <li key={key}>
                    <strong>{key}</strong>: {text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label htmlFor="authoring-class-ref">
            Authoring class
            <span className="muted library-field-hint">
              Choose the current School Context class. The server verifies your
              authority for this class.
            </span>
            <select
              id="authoring-class-ref"
              value={classRef}
              onChange={(event) => setClassRef(event.target.value)}
            >
              <option value="">Select a class…</option>
              {classes.map((item) => (
                <option key={item.class_ref} value={item.class_ref}>
                  {item.display_label ?? item.class_ref}
                </option>
              ))}
            </select>
          </label>

          <div className="library-hint-editor" data-testid="hint-editor">
            {questionIds.map((questionId) => {
              const question = questionsById[questionId];
              const prompt =
                typeof question?.prompt === "string" ? question.prompt : "";
              return (
                <div key={questionId} className="library-hint-row">
                  <p>
                    <strong>{questionId}</strong>: {prompt}
                  </p>
                  <label htmlFor={`hint-${questionId}`}>
                    Learner hint (optional)
                    <textarea
                      id={`hint-${questionId}`}
                      rows={3}
                      value={hintDrafts[questionId] ?? ""}
                      onChange={(event) =>
                        onHintChange(questionId, event.target.value)
                      }
                    />
                  </label>
                  {fieldIssues[questionId] ? (
                    <p className="library-hint-issue" role="alert">
                      {fieldIssues[questionId]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="muted">
            Valid hints ready: {validHintCount}. At least one is required.
          </p>

          <div className="library-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canPreview}
              onClick={() => setShowPreview((value) => !value)}
            >
              {showPreview ? "Hide preview" : "Preview new version"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busyAppend || !canPreview || !showPreview}
              onClick={() => void onCreateHintVersion()}
            >
              Create hint-bearing version
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={
                busySubmitReview || !createdVersionId || reconciliationRequired
              }
              onClick={() => void onSubmitForReview()}
            >
              Submit for independent review
            </button>
          </div>

          {showPreview && canPreview ? (
            <div className="library-hint-preview" data-testid="hint-preview">
              <h2>Preview</h2>
              <p className="muted">
                This posts a new immutable version. It does not publish or
                assign automatically.
              </p>
              <ul>
                {questionIds.map((questionId) => {
                  const draft = hintDrafts[questionId]?.trim();
                  if (!draft) return null;
                  const validated = validateDraftHintText(draft, {
                    answer: questionsById[questionId]?.answer,
                    explanation: questionsById[questionId]?.explanation,
                  });
                  if (!validated.ok) return null;
                  return (
                    <li key={questionId}>
                      <strong>{questionId}</strong>: {validated.normalized}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <p className="status-region" aria-live="assertive" role="status">
            {statusMessage}
          </p>
        </section>
      ) : null}
    </article>
  );
}