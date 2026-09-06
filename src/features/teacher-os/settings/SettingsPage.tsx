import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createTeacherMemory,
  getTeacherMemory,
  updateTeacherMemory,
  type TeacherMemoryPreferencesBody,
} from "@/services/api/teacherMemoryApi";
import { useSession } from "@/services/session/useSession";
import {
  ApiError,
  userMessageForApiError,
} from "@/shared/errors/ApiError";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import {
  DEFAULT_TEACHER_MEMORY_PREFERENCES,
  OUTPUT_FORMAT_OPTIONS,
  PREFERRED_DIFFICULTY_OPTIONS,
  PREPARATION_DETAIL_OPTIONS,
  TEACHING_STYLE_OPTIONS,
  clonePreferences,
  preferenceLabel,
} from "./preferences";
import "./settings.css";

type LoadStatus = "loading" | "ready" | "unavailable" | "error";

/**
 * Settings hosts Teaching preferences (Teacher Memory v1).
 * MEMORY → UI PREPARE DEFAULTS DEFERRED — no Prepare field mapping in this slice.
 */
export function SettingsPage() {
  const { isConnected, isProduction } = useSession();
  const sessionReady = isConnected || isProduction;

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [exists, setExists] = useState(false);
  const [etag, setEtag] = useState<string | null>(null);
  const [draft, setDraft] = useState<TeacherMemoryPreferencesBody>(() =>
    clonePreferences(DEFAULT_TEACHER_MEMORY_PREFERENCES),
  );

  const applyLoaded = useCallback(
    (
      preferences: TeacherMemoryPreferencesBody,
      nextEtag: string | null,
      saved: boolean,
    ) => {
      setDraft(clonePreferences(preferences));
      setEtag(nextEtag);
      setExists(saved);
    },
    [],
  );

  const loadPreferences = useCallback(async () => {
    if (!sessionReady) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    setActionMessage(null);
    setStaleNotice(null);
    try {
      const response = await getTeacherMemory();
      applyLoaded(response.data.preferences, response.etag, true);
      setStatus("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        applyLoaded(DEFAULT_TEACHER_MEMORY_PREFERENCES, null, false);
        setStatus("ready");
        return;
      }
      setStatus("error");
      setErrorMessage(userMessageForApiError(error));
    }
  }, [applyLoaded, sessionReady]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  function updateField<K extends keyof TeacherMemoryPreferencesBody>(
    key: K,
    value: TeacherMemoryPreferencesBody[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setActionMessage(null);
    setStaleNotice(null);
  }

  function onResetToDefaults() {
    setDraft(clonePreferences(DEFAULT_TEACHER_MEMORY_PREFERENCES));
    setActionMessage(
      "Form reset to defaults. Save deliberately to persist them.",
    );
    setStaleNotice(null);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setActionMessage(null);
    setStaleNotice(null);
    const body = { preferences: clonePreferences(draft) };
    const key = crypto.randomUUID();
    try {
      if (!exists) {
        const response = await createTeacherMemory(body, key);
        applyLoaded(response.data.preferences, response.etag, true);
        setActionMessage("Teaching preferences saved.");
      } else {
        if (!etag) {
          setStaleNotice(
            "Your preferences changed on the server. Refresh, review the current values, then save again.",
          );
          const fresh = await getTeacherMemory();
          applyLoaded(fresh.data.preferences, fresh.etag, true);
          return;
        }
        const response = await updateTeacherMemory(body, etag, key);
        applyLoaded(response.data.preferences, response.etag, true);
        setActionMessage("Teaching preferences saved.");
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === "precondition_failed" || error.status === 412)
      ) {
        setStaleNotice(
          "Your preferences changed on the server since you loaded them. Refresh, review the current values, then save again. No automatic resubmit.",
        );
        try {
          const fresh = await getTeacherMemory();
          applyLoaded(fresh.data.preferences, fresh.etag, true);
          setStatus("ready");
        } catch (reloadError) {
          if (reloadError instanceof ApiError && reloadError.status === 404) {
            applyLoaded(DEFAULT_TEACHER_MEMORY_PREFERENCES, null, false);
            setStatus("ready");
          } else {
            setErrorMessage(userMessageForApiError(reloadError));
            setStatus("error");
          }
        }
      } else {
        setActionMessage(userMessageForApiError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="stack settings-page">
      <header>
        <p className="muted">Teacher OS</p>
        <h1>Settings</h1>
      </header>

      {!isProduction ? (
        <section className="panel" aria-labelledby="settings-dev-heading">
          <h2 id="settings-dev-heading">Development session</h2>
          <p className="muted">
            Use the DEV session panel above the main content (also available on
            Today) to attach a memory-only bearer token and tenant id. See{" "}
            <Link to="/teacher-os/today">Today&apos;s Mission</Link>.
          </p>
        </section>
      ) : null}

      {status === "unavailable" ? (
        <EmptyState
          title="Connect a session"
          description="Teaching preferences require a connected DEV session (or production auth) before they can load or save."
        />
      ) : null}

      {status === "loading" ? (
        <LoadingState label="Loading teaching preferences…" />
      ) : null}

      {status === "error" && errorMessage ? (
        <ErrorState
          title="Could not load teaching preferences"
          message={errorMessage}
          onRetry={() => {
            void loadPreferences();
          }}
        />
      ) : null}

      {status === "ready" ? (
        <section
          className="panel"
          aria-labelledby="teaching-preferences-heading"
        >
          <h2 id="teaching-preferences-heading">Teaching preferences</h2>
          <p className="muted">
            {exists
              ? "These preferences are saved for your teacher profile. Changes apply only when you Save."
              : "Not saved yet — showing defaults. Edit and Save to create your preferences."}
          </p>

          {staleNotice ? (
            <p className="settings-notice" role="status">
              {staleNotice}
            </p>
          ) : null}
          {actionMessage ? (
            <p className="settings-confirm" role="status">
              {actionMessage}
            </p>
          ) : null}

          <form className="settings-form stack" onSubmit={onSave}>
            <label className="stack-tight">
              <span>Teaching style</span>
              <select
                aria-label="Teaching style"
                value={draft.teaching_style}
                onChange={(event) =>
                  updateField(
                    "teaching_style",
                    event.target.value as TeacherMemoryPreferencesBody["teaching_style"],
                  )
                }
              >
                {TEACHING_STYLE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {preferenceLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-tight">
              <span>Preferred difficulty</span>
              <select
                aria-label="Preferred difficulty"
                value={draft.preferred_difficulty}
                onChange={(event) =>
                  updateField(
                    "preferred_difficulty",
                    event.target
                      .value as TeacherMemoryPreferencesBody["preferred_difficulty"],
                  )
                }
              >
                {PREFERRED_DIFFICULTY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {preferenceLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-tight">
              <span>Preparation detail</span>
              <select
                aria-label="Preparation detail"
                value={draft.preparation_detail}
                onChange={(event) =>
                  updateField(
                    "preparation_detail",
                    event.target
                      .value as TeacherMemoryPreferencesBody["preparation_detail"],
                  )
                }
              >
                {PREPARATION_DETAIL_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {preferenceLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack-tight">
              <span>Output format</span>
              <select
                aria-label="Output format"
                value={draft.output_format}
                onChange={(event) =>
                  updateField(
                    "output_format",
                    event.target
                      .value as TeacherMemoryPreferencesBody["output_format"],
                  )
                }
              >
                {OUTPUT_FORMAT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {preferenceLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={draft.include_differentiation}
                onChange={(event) =>
                  updateField("include_differentiation", event.target.checked)
                }
              />
              <span>Include differentiation</span>
            </label>

            <div className="settings-actions">
              <button
                type="submit"
                className="btn"
                disabled={busy}
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={onResetToDefaults}
              >
                Reset to defaults
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </article>
  );
}
