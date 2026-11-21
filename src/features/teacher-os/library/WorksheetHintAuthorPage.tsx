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
  type WorksheetLearnerHintVersionAppendRequest,
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

/** Governed recovery / mutation-authority phases (mutually exclusive). */
export type AuthorPhase =
  | "READY"
  | "REVALIDATING"
  | "AUTHORITY_UNAVAILABLE"
  | "RECONCILIATION_REQUIRED"
  | "APPEND_OUTCOME_UNCERTAIN"
  | "SUBMIT_OUTCOME_UNCERTAIN";

type PendingMutationReceipt = {
  kind: "append" | "submit";
  generation: number;
  session: DevSession | null;
  contentId: string;
  sourceVersionId: string;
  etag: string;
  materialFingerprint: string;
  idempotencyKey: string;
  /** Frozen at first POST — used only for explicit recovery replay. */
  appendRequest?: WorksheetLearnerHintVersionAppendRequest;
};

function isUncertainPhase(phase: AuthorPhase): boolean {
  return (
    phase === "APPEND_OUTCOME_UNCERTAIN" || phase === "SUBMIT_OUTCOME_UNCERTAIN"
  );
}

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
  "The save result is uncertain. Your draft and the original request are preserved — reload shows the latest worksheet, or use Recover original append attempt with the same idempotency key.";
const AMBIGUOUS_SUBMIT_MESSAGE =
  "The submit result is uncertain. Use Reload to inspect server state, or Recover original submit attempt to replay the exact request.";
const RECONCILIATION_MESSAGE =
  "The worksheet source changed. Review the updated questions, reapply any saved hint text, then preview again before creating a version.";

type SourceBinding = {
  versionId: string;
  signature: string;
  contentEtag: string;
  questionsById: Record<string, Record<string, unknown>>;
};

const REVALIDATION_BLOCKED_MESSAGE =
  "Cannot refresh worksheet authority right now. Your unsaved hints are preserved — use Reload latest worksheet when the source is available.";

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
  const [authorPhase, setAuthorPhase] = useState<AuthorPhase>("REVALIDATING");
  const authorPhaseRef = useRef<AuthorPhase>("REVALIDATING");
  const setAuthorPhaseSync = useCallback((phase: AuthorPhase) => {
    authorPhaseRef.current = phase;
    setAuthorPhase(phase);
  }, []);
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
  const recoverInFlightRef = useRef(false);
  const createdMaterialRef = useRef<string | null>(null);
  const pendingMutationReceiptRef = useRef<PendingMutationReceipt | null>(null);

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

  const clearPendingMutationKeys = useCallback(
    (kind?: "append" | "submit", options?: { force?: boolean }) => {
      const keepReceipt =
        isUncertainPhase(authorPhaseRef.current) && !options?.force;
      if (!kind || kind === "append") {
        if (!keepReceipt) {
          appendKeyRef.current = null;
          appendMaterialRef.current = null;
          if (pendingMutationReceiptRef.current?.kind === "append") {
            pendingMutationReceiptRef.current = null;
          }
        }
      }
      if (!kind || kind === "submit") {
        if (!keepReceipt) {
          submitKeyRef.current = null;
          submitVersionRef.current = null;
          submitMaterialRef.current = null;
          if (pendingMutationReceiptRef.current?.kind === "submit") {
            pendingMutationReceiptRef.current = null;
          }
        }
      }
    },
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
    clearPendingMutationKeys();
    appendInFlightRef.current = false;
    submitInFlightRef.current = false;
    setBusyAppend(false);
    setBusySubmitReview(false);
    createdMaterialRef.current = null;
    boundSourceRef.current = null;
    pendingMutationReceiptRef.current = null;
    setAuthorPhaseSync("REVALIDATING");
    setUnassignedDrafts({});
  }, [clearPendingMutationKeys, setAuthorPhaseSync]);

  const beginRevalidation = useCallback(() => {
    if (isUncertainPhase(authorPhaseRef.current)) {
      return;
    }
    setAuthorPhaseSync("REVALIDATING");
    setShowPreview(false);
    setCreatedVersionId(null);
    setCreatedContentEtag(null);
    createdMaterialRef.current = null;
    clearPendingMutationKeys("submit");
  }, [clearPendingMutationKeys, setAuthorPhaseSync]);

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
        (prior.versionId !== versionId ||
          prior.signature !== signature ||
          prior.contentEtag !== contentEtagValue);

      const priorQuestionSignature = (id: string) =>
        prior
          ? worksheetQuestionBindingSignature([id], prior.questionsById)
          : "";
      const nextQuestionSignature = (id: string) =>
        worksheetQuestionBindingSignature([id], questionMap);

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
        const versionChanged = prior.versionId !== versionId;
        for (const id of ids) {
          const draft = preservedDrafts[id];
          if (!draft?.trim()) continue;
          const hadPriorQuestion = Boolean(prior.questionsById[id]);
          const bindingChanged =
            hadPriorQuestion &&
            priorQuestionSignature(id) !== nextQuestionSignature(id);
          if (
            versionChanged ||
            bindingChanged ||
            !hadPriorQuestion
          ) {
            const orphanKey =
              versionChanged || bindingChanged
                ? `${id} (previous source)`
                : id;
            orphans[orphanKey] = draft;
            nextDrafts[id] = "";
          }
        }
        setShowPreview(false);
        setCreatedVersionId(null);
        setCreatedContentEtag(null);
        createdMaterialRef.current = null;
        if (!isUncertainPhase(authorPhaseRef.current)) {
          clearPendingMutationKeys();
        }
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
        contentEtag: contentEtagValue,
        questionsById: questionMap,
      };
      return drifted;
    },
    [clearPendingMutationKeys],
  );

  const reloadMetadataPreservingDrafts = useCallback(
    async (draftSnapshot: Record<string, string>) => {
      const phaseAtStart = authorPhaseRef.current;
      const uncertainAtStart = isUncertainPhase(phaseAtStart);
      const receiptAtStart = pendingMutationReceiptRef.current;
      if (!uncertainAtStart) {
        beginRevalidation();
      }
      const fence: LoadFence = {
        generation: loadGenerationRef.current,
        session: sessionRef.current,
        contentId,
      };
      const failClosed = (message: string) => {
        if (loadFenceStale(fence)) return;
        if (uncertainAtStart && receiptAtStart) {
          pendingMutationReceiptRef.current = receiptAtStart;
          setAuthorPhaseSync(phaseAtStart);
          setHintDrafts(draftSnapshot);
          setShowPreview(false);
          setStatusMessage(message);
          return;
        }
        setAuthorPhaseSync("AUTHORITY_UNAVAILABLE");
        setHintDrafts(draftSnapshot);
        setShowPreview(false);
        setStatusMessage(message);
      };
      try {
        const [libraryResponse, contentResponse] = await Promise.all([
          getLibraryItem(contentId),
          getContent(contentId),
        ]);
        if (loadFenceStale(fence)) return;
        const versionId = contentResponse.data.current_version_id;
        if (!versionId) {
          failClosed(REVALIDATION_BLOCKED_MESSAGE);
          return;
        }
        const versionResponse = await getLibraryVersion(contentId, versionId);
        if (loadFenceStale(fence)) return;
        const version = versionResponse.data;
        if (version.content_id !== contentId || version.version_id !== versionId) {
          failClosed(REVALIDATION_BLOCKED_MESSAGE);
          return;
        }
        const detail = libraryResponse.data;
        if (
          !libraryItemEligibleForHintAuthoring(
            detail.content_type,
            version.schema_id,
            version.schema_version,
          )
        ) {
          failClosed(
            "The latest content is not an eligible worksheet for hint authoring.",
          );
          return;
        }
        const reparsed = parseWorksheetHintSourceForAuthoring(version.payload);
        if (!reparsed.ok) {
          failClosed(reparsed.reason);
          return;
        }
        if (!contentResponse.etag) {
          failClosed(REVALIDATION_BLOCKED_MESSAGE);
          return;
        }
        let classItems: SchoolContextClassItem[] = [];
        try {
          const classesResponse = await listAssignableClasses();
          if (loadFenceStale(fence)) return;
          classItems = classesResponse.data.items;
        } catch {
          failClosed(
            "Could not refresh School Context classes. Choose a class again after reload.",
          );
          return;
        }
        setClasses(classItems);
        const selectedStillValid = classItems.some(
          (item) => item.class_ref === classRef,
        );
        if (classRef && !selectedStillValid) {
          setClassRef("");
          setStatusMessage(
            "Your previously selected class is no longer assignable. Choose a current class before creating a version.",
          );
        }
        if (uncertainAtStart && receiptAtStart) {
          if (loadFenceStale(fence)) return;
          setClasses(classItems);
          const selectedStillValidUncertain = classItems.some(
            (item) => item.class_ref === classRef,
          );
          if (classRef && !selectedStillValidUncertain) {
            setClassRef("");
          }
          pendingMutationReceiptRef.current = receiptAtStart;
          setAuthorPhaseSync(phaseAtStart);
          setHintDrafts(draftSnapshot);
          setShowPreview(false);
          setStatusMessage(
            phaseAtStart === "APPEND_OUTCOME_UNCERTAIN"
              ? `${AMBIGUOUS_APPEND_MESSAGE} Current authoritative version: ${versionId}.`
              : `${AMBIGUOUS_SUBMIT_MESSAGE} Current authoritative version: ${versionId}.`,
          );
          return;
        }
        const needsReconcile = applyAuthoringSource(
          reparsed,
          versionId,
          contentResponse.etag,
          draftSnapshot,
          true,
        );
        if (loadFenceStale(fence)) return;
        if (pendingMutationReceiptRef.current) {
          return;
        }
        setAuthorPhaseSync("RECONCILIATION_REQUIRED");
        setShowPreview(false);
        setStatusMessage(
          needsReconcile ? RECONCILIATION_MESSAGE : OUT_OF_DATE_MESSAGE,
        );
      } catch {
        failClosed(REVALIDATION_BLOCKED_MESSAGE);
      }
    },
    [
      applyAuthoringSource,
      beginRevalidation,
      classRef,
      clearPendingMutationKeys,
      contentId,
      loadFenceStale,
      setAuthorPhaseSync,
    ],
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
      clearPendingMutationKeys();
      setClasses(classesResponse.data.items);
      setAuthorPhaseSync("READY");
      setStatus("ready");
    } catch (error) {
      if (loadFenceStale(fence)) return;
      setErrorMessage(userMessageForApiError(error));
      setStatus("error");
    }
  }, [
    applyAuthoringSource,
    clearPendingMutationKeys,
    contentId,
    isConnected,
    isProduction,
    loadFenceStale,
    setAuthorPhaseSync,
  ]);

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

  const hintsEditable =
    authorPhase === "READY" || authorPhase === "RECONCILIATION_REQUIRED";

  function onHintChange(questionId: string, value: string) {
    if (!hintsEditable) return;
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
    authorPhase === "READY" &&
    validHintCount >= 1 &&
    Boolean(classRef.trim()) &&
    !hasBlockingIssues;

  function onConfirmReconciliation() {
    if (authorPhaseRef.current !== "RECONCILIATION_REQUIRED") return;
    if (pendingMutationReceiptRef.current) return;
    setAuthorPhaseSync("READY");
    setShowPreview(false);
    setStatusMessage("");
  }

  async function finalizeResolvedAppend(
    startFence: MutationFence,
    versionId: string,
    versionNumber: number | undefined,
    responseEtag: string | null,
    material: string,
  ) {
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
    clearPendingMutationKeys("append", { force: true });
    createdMaterialRef.current = material;
    setCreatedVersionId(versionId);
    setCreatedContentEtag(responseEtag);
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
      const authoritativeCurrent = contentResponse.data.current_version_id;
      if (authoritativeCurrent && authoritativeCurrent !== versionId) {
        setAuthorPhaseSync("RECONCILIATION_REQUIRED");
        setShowPreview(false);
        setStatusMessage(
          `Hint version ${versionNumber ?? versionId} was recorded, but the content now points at ${authoritativeCurrent}. Reconcile against the latest source before any new action.`,
        );
        return;
      }
      if (contentResponse.etag) {
        setCreatedContentEtag(contentResponse.etag);
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
    setAuthorPhaseSync("READY");
    setStatusMessage(
      `Created hint-bearing worksheet version ${versionNumber ?? versionId}. Submit it for independent review when ready.`,
    );
  }

  async function onRecoverOriginalMutation() {
    if (recoverInFlightRef.current) return;
    const phase = authorPhaseRef.current;
    const receipt = pendingMutationReceiptRef.current;
    if (!receipt || !isUncertainPhase(phase)) return;
    if (
      receipt.generation !== loadGenerationRef.current ||
      receipt.session !== sessionRef.current ||
      receipt.contentId !== contentIdRef.current
    ) {
      return;
    }

    const startFence: MutationFence = {
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
      sourceVersionId: receipt.sourceVersionId,
    };

    recoverInFlightRef.current = true;
  if (receipt.kind === "append") {
      if (!receipt.appendRequest) {
        recoverInFlightRef.current = false;
        return;
      }
      setBusyAppend(true);
      setStatusMessage("");
      try {
        const response = await postWorksheetLearnerHintVersionAppend(
          contentId,
          receipt.appendRequest,
          receipt.etag,
          receipt.idempotencyKey,
        );
        if (response.data.content_id !== contentId) {
          setStatusMessage(
            "Recovery response does not match this content. The original request remains unresolved.",
          );
          return;
        }
        await finalizeResolvedAppend(
          startFence,
          response.data.version_id,
          response.data.version_number,
          response.etag,
          receipt.materialFingerprint,
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
          clearPendingMutationKeys("append", { force: true });
          pendingMutationReceiptRef.current = null;
          setStatusMessage(OUT_OF_DATE_MESSAGE);
          await reloadMetadataPreservingDrafts({ ...hintDrafts });
          return;
        }
        const isTransport =
          error instanceof ApiError &&
          (error.status === 0 ||
            error.code === "network" ||
            (error.status !== null && error.status >= 500));
        if (isTransport || !(error instanceof ApiError)) {
          setAuthorPhaseSync("APPEND_OUTCOME_UNCERTAIN");
          setStatusMessage(AMBIGUOUS_APPEND_MESSAGE);
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
          recoverInFlightRef.current = false;
          setBusyAppend(false);
        }
      }
      return;
    }

    setBusySubmitReview(true);
    setStatusMessage("");
    try {
      await postContentSubmitForReview(
        contentId,
        receipt.sourceVersionId,
        receipt.etag,
        receipt.idempotencyKey,
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
      clearPendingMutationKeys("submit", { force: true });
      setAuthorPhaseSync("READY");
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
        clearPendingMutationKeys("submit", { force: true });
        setStatusMessage(OUT_OF_DATE_MESSAGE);
        await reloadMetadataPreservingDrafts({ ...hintDrafts });
        return;
      }
      const isTransport =
        error instanceof ApiError &&
        (error.status === 0 ||
          error.code === "network" ||
          (error.status !== null && error.status >= 500));
      if (isTransport || !(error instanceof ApiError)) {
        setAuthorPhaseSync("SUBMIT_OUTCOME_UNCERTAIN");
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
        recoverInFlightRef.current = false;
        setBusySubmitReview(false);
      }
    }
  }

  async function onCreateHintVersion() {
    if (appendInFlightRef.current || recoverInFlightRef.current) return;
    if (authorPhaseRef.current !== "READY") return;
    if (pendingMutationReceiptRef.current) return;
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
    if (appendMaterialRef.current !== material || !appendKeyRef.current) {
      appendKeyRef.current = crypto.randomUUID();
      appendMaterialRef.current = material;
    }

    const startFence: MutationFence = {
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
      sourceVersionId: currentVersionId,
    };
    const idempotencyKey = appendKeyRef.current as string;
    const etagAtStart = contentEtag;

    const frozenAppendRequest: WorksheetLearnerHintVersionAppendRequest = {
      authoring_class_ref: classRef.trim(),
      payload: structuredClone(bodyPayload) as WorksheetLearnerHintVersionAppendRequest["payload"],
    };
    pendingMutationReceiptRef.current = {
      kind: "append",
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
      sourceVersionId: currentVersionId,
      etag: etagAtStart,
      materialFingerprint: material,
      idempotencyKey,
      appendRequest: frozenAppendRequest,
    };

    appendInFlightRef.current = true;
    setBusyAppend(true);
    setStatusMessage("");
    try {
      const response = await postWorksheetLearnerHintVersionAppend(
        contentId,
        frozenAppendRequest,
        etagAtStart,
        idempotencyKey,
      );
      await finalizeResolvedAppend(
        startFence,
        response.data.version_id,
        response.data.version_number,
        response.etag,
        material,
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
        clearPendingMutationKeys("append", { force: true });
        pendingMutationReceiptRef.current = null;
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
        authorPhaseRef.current = "APPEND_OUTCOME_UNCERTAIN";
        setAuthorPhaseSync("APPEND_OUTCOME_UNCERTAIN");
        setShowPreview(false);
        setHintDrafts(draftSnapshot);
        setStatusMessage(AMBIGUOUS_APPEND_MESSAGE);
        return;
      }
      clearPendingMutationKeys("append", { force: true });
      pendingMutationReceiptRef.current = null;
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
    if (submitInFlightRef.current || recoverInFlightRef.current) return;
    if (authorPhaseRef.current !== "READY") return;
    if (pendingMutationReceiptRef.current) return;
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

    pendingMutationReceiptRef.current = {
      kind: "submit",
      generation: loadGenerationRef.current,
      session: sessionRef.current,
      contentId,
      sourceVersionId: versionForSubmit,
      etag: etagForSubmit,
      materialFingerprint: appendMaterialFingerprint,
      idempotencyKey: submitKey,
    };

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
      clearPendingMutationKeys("submit", { force: true });
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
        clearPendingMutationKeys("submit");
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
        authorPhaseRef.current = "SUBMIT_OUTCOME_UNCERTAIN";
        setAuthorPhaseSync("SUBMIT_OUTCOME_UNCERTAIN");
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
            clearPendingMutationKeys("submit", { force: true });
            setAuthorPhaseSync("READY");
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

  const showReconcileConfirm = authorPhase === "RECONCILIATION_REQUIRED";
  const showAuthorityReload = authorPhase === "AUTHORITY_UNAVAILABLE";
  const showUncertainReload =
    authorPhase === "APPEND_OUTCOME_UNCERTAIN" ||
    authorPhase === "SUBMIT_OUTCOME_UNCERTAIN";

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
        <section
          className="panel stack library-detail"
          data-author-phase={authorPhase}
        >
          <p className="muted">
            Authoring from current version{" "}
            <code>{currentVersionId}</code>. Answers and teacher notes stay
            private to this screen.
          </p>

          {showReconcileConfirm ? (
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

          {showAuthorityReload || showUncertainReload ? (
            <div className="library-reconcile-banner" role="alert">
              <p>
                {showAuthorityReload
                  ? REVALIDATION_BLOCKED_MESSAGE
                  : authorPhase === "APPEND_OUTCOME_UNCERTAIN"
                    ? AMBIGUOUS_APPEND_MESSAGE
                    : AMBIGUOUS_SUBMIT_MESSAGE}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="reload-authoritative-worksheet"
                disabled={busyAppend || busySubmitReview}
                onClick={() => void reloadMetadataPreservingDrafts({ ...hintDrafts })}
              >
                Reload latest authoritative worksheet
              </button>
              {authorPhase === "APPEND_OUTCOME_UNCERTAIN" ? (
                <button
                  type="button"
                  className="btn"
                  data-testid="recover-original-append"
                  disabled={busyAppend}
                  onClick={() => void onRecoverOriginalMutation()}
                >
                  Recover original append attempt
                </button>
              ) : null}
              {authorPhase === "SUBMIT_OUTCOME_UNCERTAIN" ? (
                <button
                  type="button"
                  className="btn"
                  data-testid="recover-original-submit"
                  disabled={busySubmitReview}
                  onClick={() => void onRecoverOriginalMutation()}
                >
                  Recover original submit attempt
                </button>
              ) : null}
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
              disabled={!hintsEditable}
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
                      disabled={!hintsEditable}
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
              disabled={
                busyAppend ||
                authorPhase !== "READY" ||
                !canPreview ||
                !showPreview
              }
              onClick={() => void onCreateHintVersion()}
            >
              Create hint-bearing version
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={
                busySubmitReview ||
                !createdVersionId ||
                authorPhase !== "READY"
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