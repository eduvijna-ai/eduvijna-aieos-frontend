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
  parseWorksheetHintSource,
  validateDraftHintText,
  WORKSHEET_HINT_SCHEMA_VERSION,
} from "./worksheetHintAuthorPolicy";
import "./library.css";

type LoadFence = {
  generation: number;
  session: DevSession | null;
  contentId: string;
};

const OUT_OF_DATE_MESSAGE =
  "This worksheet changed elsewhere. We've reloaded the latest version.";

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

  const appendKeyRef = useRef<string | null>(null);
  const appendMaterialRef = useRef<string | null>(null);
  const submitKeyRef = useRef<string | null>(null);
  const submitVersionRef = useRef<string | null>(null);
  const sessionTrackedRef = useRef<DevSession | null | undefined>(undefined);

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
  }, []);

  const invalidateAuthorSync = useCallback(() => {
    bumpLoadGeneration();
    purgeAuthorState();
    setErrorMessage("");
    setStatusMessage("");
  }, [bumpLoadGeneration, purgeAuthorState]);

  useLayoutEffect(() => {
    const prior = sessionTrackedRef.current;
    sessionTrackedRef.current = session;
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

  const load = useCallback(async () => {
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
      const versionId = content.current_version_id ?? detail.current_version_id;
      if (!versionId) {
        setStatus("error");
        setErrorMessage("This worksheet has no current version to author from.");
        return;
      }

      const versionResponse = await getLibraryVersion(contentId, versionId);
      if (loadFenceStale(fence)) return;

      const version = versionResponse.data;
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

      const parsed = parseWorksheetHintSource(version.payload);
      if (!parsed.ok) {
        setStatus("error");
        setErrorMessage(parsed.reason);
        return;
      }

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

      const drafts: Record<string, string> = {};
      for (const id of ids) {
        const existing = questionMap[id]?.learner_hint;
        if (typeof existing === "string" && existing.trim()) {
          drafts[id] = existing.trim();
        } else {
          drafts[id] = "";
        }
      }

      setTitle(detail.title);
      setCurrentVersionId(versionId);
      setContentEtag(contentResponse.etag);
      setSourcePayload(parsed.payload);
      setQuestionIds(ids);
      setQuestionsById(questionMap);
      setHintDrafts(drafts);
      setClasses(classesResponse.data.items);
      setStatus("ready");
    } catch (error) {
      if (loadFenceStale(fence)) return;
      setErrorMessage(userMessageForApiError(error));
      setStatus("error");
    }
  }, [contentId, isConnected, isProduction, loadFenceStale]);

  useEffect(() => {
    void load();
  }, [load, loadGeneration]);

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
    validHintCount >= 1 && Boolean(classRef.trim()) && !hasBlockingIssues;

  async function onCreateHintVersion() {
    if (!sourcePayload || !contentEtag || !classRef.trim()) {
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

    const bodyPayload = buildWorksheetHintAppendPayload(sourcePayload, hintDrafts);
    const material = appendMaterialFingerprint;
    if (
      appendMaterialRef.current !== material ||
      !appendKeyRef.current
    ) {
      appendKeyRef.current = crypto.randomUUID();
      appendMaterialRef.current = material;
    }

    setBusyAppend(true);
    setStatusMessage("");
    try {
      const response = await postWorksheetLearnerHintVersionAppend(
        contentId,
        {
          authoring_class_ref: classRef.trim(),
          payload: bodyPayload,
        },
        contentEtag,
        appendKeyRef.current,
      );
      if (
        sessionRef.current !== sessionTrackedRef.current ||
        contentIdRef.current !== contentId
      ) {
        return;
      }
      setCreatedVersionId(response.data.version_id);
      setCreatedContentEtag(response.etag);
      setStatusMessage(
        `Created hint-bearing worksheet version ${response.data.version_number}. Submit it for independent review when ready.`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "precondition_failed") {
        setStatusMessage(OUT_OF_DATE_MESSAGE);
        await load();
        return;
      }
      setStatusMessage(userMessageForApiError(error));
    } finally {
      setBusyAppend(false);
    }
  }

  async function onSubmitForReview() {
    if (!createdVersionId || !createdContentEtag) {
      setStatusMessage("Create the hint-bearing version before submitting.");
      return;
    }
    if (
      submitVersionRef.current !== createdVersionId ||
      !submitKeyRef.current
    ) {
      submitKeyRef.current = crypto.randomUUID();
      submitVersionRef.current = createdVersionId;
    }
    setBusySubmitReview(true);
    setStatusMessage("");
    try {
      await postContentSubmitForReview(
        contentId,
        createdVersionId,
        createdContentEtag,
        submitKeyRef.current,
      );
      if (
        sessionRef.current !== sessionTrackedRef.current ||
        contentIdRef.current !== contentId
      ) {
        return;
      }
      setStatusMessage(
        "Submitted for independent review. Approval and publishing remain separate steps.",
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "precondition_failed") {
        setStatusMessage(OUT_OF_DATE_MESSAGE);
        await load();
        return;
      }
      setStatusMessage(userMessageForApiError(error));
    } finally {
      setBusySubmitReview(false);
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
              disabled={busySubmitReview || !createdVersionId}
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