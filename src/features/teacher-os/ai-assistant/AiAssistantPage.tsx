import { type FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  respondTeacherOsAssistant,
  type TeacherOsAssistantHistoryTurn,
  type TeacherOsAssistantResponse,
} from "@/services/api/aiAssistantApi";
import { useSession } from "@/services/session/useSession";
import {
  ApiError,
  userMessageForApiError,
} from "@/shared/errors/ApiError";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { localToday } from "@/shared/time/calendarDate";
import "./assistant.css";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  suggestedQuestions?: string[];
  suggestedNextStep?: string | null;
  contextSummary?: string;
};

type PageStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

const MAX_SESSION_HISTORY = 12;

/**
 * Teacher OS Contextual AI Assistant v1.
 * Session-scoped chat only. Suggestions never silently mutate business state.
 */
export function AiAssistantPage() {
  const { isConnected, isProduction } = useSession();
  const sessionReady = isConnected || isProduction;
  const [searchParams] = useSearchParams();
  const teachingWorkId = searchParams.get("teaching_work_id");

  const [status, setStatus] = useState<PageStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [lastResponse, setLastResponse] =
    useState<TeacherOsAssistantResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionReady) {
      setStatus("unavailable");
      return;
    }
    setStatus((current) => {
      if (current === "loading" || current === "error") {
        return current;
      }
      return turns.length > 0 ? "ready" : "idle";
    });
  }, [sessionReady, turns.length]);

  function clearConversation() {
    if (busy) {
      return;
    }
    setTurns([]);
    setLastResponse(null);
    setErrorMessage(null);
    setDraft("");
    setStatus(sessionReady ? "idle" : "unavailable");
  }

  async function submitMessage(
    message: string,
    options: { retry?: boolean } = {},
  ) {
    const trimmed = message.trim();
    if (!trimmed || busy || !sessionReady) {
      return;
    }
    const retry = options.retry === true;

    setBusy(true);
    setStatus("loading");
    setErrorMessage(null);

    // Retry must not re-append the failed optimistic user turn, and must not
    // include that current message twice in the Backend history payload.
    let priorTurns = turns;
    if (retry) {
      const last = turns[turns.length - 1];
      if (last?.role === "user" && last.content === trimmed) {
        priorTurns = turns.slice(0, -1);
      }
    } else {
      const optimistic: ChatTurn = { role: "user", content: trimmed };
      setTurns((current) => [...current, optimistic]);
    }

    const history: TeacherOsAssistantHistoryTurn[] = priorTurns
      .slice(-MAX_SESSION_HISTORY)
      .map((turn) => ({ role: turn.role, content: turn.content }));

    setDraft("");

    try {
      const response = await respondTeacherOsAssistant({
        message: trimmed,
        history,
        teaching_work_id: teachingWorkId || null,
        mission_date: localToday(),
      });
      const body = response.data;
      setLastResponse(body);
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: body.answer,
          suggestedQuestions: body.suggested_questions ?? [],
          suggestedNextStep: body.suggested_next_step,
          contextSummary: body.context_summary,
        },
      ]);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(userMessageForApiError(error));
      if (!(error instanceof ApiError)) {
        // keep optimistic user turn for retry context
      }
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage(draft);
  }

  function onSuggestedQuestion(question: string) {
    void submitMessage(question);
  }

  if (!sessionReady) {
    return (
      <article className="assistant-page">
        <header>
          <p className="eyebrow">Teacher OS</p>
          <h1>AI Assistant</h1>
        </header>
        <EmptyState
          title="Connect a development session"
          description="The Assistant calls the AIEOS Backend only. Connect via the DEV session panel first."
        />
      </article>
    );
  }

  return (
    <article className="assistant-page">
      <header className="assistant-header">
        <div>
          <p className="eyebrow">Teacher OS</p>
          <h1>AI Assistant</h1>
          <p className="lede">
            Read, reason, and suggest from authorized Teacher OS context. No
            silent Publish, Assign, Teach, Assess, remediation, or Memory
            changes.
          </p>
        </div>
        <div className="assistant-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={clearConversation}
            disabled={busy}
          >
            New conversation
          </button>
        </div>
      </header>

      <section className="assistant-context panel" aria-label="Context">
        <h2 className="assistant-section-title">Context</h2>
        {teachingWorkId ? (
          <p>
            Selected Teaching Work:{" "}
            <Link to={`/teacher-os/work/${teachingWorkId}`}>{teachingWorkId}</Link>
          </p>
        ) : (
          <p className="muted">
            No Teaching Work selected. The Backend will use Today&apos;s Mission
            continue-work when available.
          </p>
        )}
        {lastResponse?.context_summary ? (
          <p className="muted assistant-context-summary">
            Server context: {lastResponse.context_summary}
          </p>
        ) : null}
        <p className="muted">
          Chat continuity is session-only in this browser. Nothing is stored as
          Chat SoR.
        </p>
      </section>

      <section className="assistant-thread panel" aria-live="polite">
        <h2 className="assistant-section-title">Conversation</h2>
        {turns.length === 0 && status !== "loading" ? (
          <EmptyState
            title="Ask a teaching question"
            description="Try focusing on today, summarizing current work, or asking about preparation."
          />
        ) : null}
        <ul className="assistant-turns">
          {turns.map((turn, index) => (
            <li
              key={`${turn.role}-${index}`}
              className={`assistant-turn assistant-turn-${turn.role}`}
            >
              <p className="assistant-turn-role">
                {turn.role === "user" ? "You" : "Assistant"}
              </p>
              <p className="assistant-turn-body">{turn.content}</p>
              {turn.role === "assistant" && turn.suggestedNextStep ? (
                <p className="assistant-next-step">
                  Suggested next step (proposal only): {turn.suggestedNextStep}
                </p>
              ) : null}
              {turn.role === "assistant" &&
              turn.suggestedQuestions &&
              turn.suggestedQuestions.length > 0 ? (
                <div className="assistant-suggestions">
                  <p className="muted">Suggested follow-ups</p>
                  <ul>
                    {turn.suggestedQuestions.map((question) => (
                      <li key={question}>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busy}
                          onClick={() => onSuggestedQuestion(question)}
                        >
                          {question}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {status === "loading" ? <LoadingState label="Thinking…" /> : null}
        {status === "error" && errorMessage ? (
          <ErrorState
            title="Assistant request failed"
            message={errorMessage}
            onRetry={() => {
              const lastUser = [...turns].reverse().find((t) => t.role === "user");
              void submitMessage(lastUser?.content ?? draft, { retry: true });
            }}
          />
        ) : null}
      </section>

      <section className="assistant-compose panel">
        <form onSubmit={onSubmit} className="assistant-form">
          <label htmlFor="assistant-message">Message</label>
          <textarea
            id="assistant-message"
            rows={3}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What should I focus on today?"
          />
          <div className="assistant-compose-actions">
            <button type="submit" className="btn" disabled={busy || !draft.trim()}>
              Send
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={clearConversation}
              disabled={busy}
            >
              Clear conversation
            </button>
          </div>
        </form>
        <p className="muted assistant-guardrail">
          Suggested actions never mutate. Open{" "}
          <Link to="/teacher-os/today">Today</Link>,{" "}
          <Link to="/teacher-os/prepare">Prepare</Link>,{" "}
          <Link to="/teacher-os/teach">Teach</Link>,{" "}
          <Link to="/teacher-os/assess">Assess</Link>, or{" "}
          <Link to="/teacher-os/improve">Improve</Link> and confirm there.
        </p>
      </section>
    </article>
  );
}
