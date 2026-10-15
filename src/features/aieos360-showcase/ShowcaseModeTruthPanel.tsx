import { useEffect, useState } from "react";
import {
  formatVerificationState,
  loadShowcaseRuntimeTruth,
  type ShowcaseRuntimeTruth,
} from "./showcaseRuntimeTruth";

export function ShowcaseModeTruthPanel() {
  const [truth, setTruth] = useState<ShowcaseRuntimeTruth | null>(null);
  const [aggregatorTruth, setAggregatorTruth] = useState<{
    active_provider_id?: string;
    active_model_id?: string;
    mode?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadShowcaseRuntimeTruth().then((payload) => {
      if (!cancelled) {
        setTruth(payload);
      }
    });
    void fetch("/api/v1/platform/ai/providers", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as {
          active_provider_id?: string;
          active_model_id?: string;
          mode?: string;
        };
      })
      .then((payload) => {
        if (!cancelled) {
          setAggregatorTruth(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAggregatorTruth(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeProvider =
    aggregatorTruth?.active_provider_id ?? truth?.active_provider_id ?? "—";
  const activeModel =
    aggregatorTruth?.active_model_id ?? truth?.active_model_id ?? "—";
  const verificationState = formatVerificationState(truth?.verification_state);

  return (
    <section
      className="aieos360-showcase__section aieos360-showcase__mode-truth"
      aria-labelledby="aieos360-mode-truth-heading"
    >
      <h2 id="aieos360-mode-truth-heading">Showcase runtime truth</h2>
      <dl className="aieos360-showcase__mode-truth-grid">
        <div>
          <dt>Selected mode (operator)</dt>
          <dd>{truth?.selected_mode ?? "DETERMINISTIC (default)"}</dd>
        </div>
        <div>
          <dt>Verified runtime mode</dt>
          <dd>{truth?.verified_runtime_mode ?? "—"}</dd>
        </div>
        <div>
          <dt>Active provider / model</dt>
          <dd>
            <code>{activeProvider}</code> / <code>{activeModel}</code>
          </dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>{verificationState}</dd>
        </div>
        <div>
          <dt>Seeded worksheet</dt>
          <dd>
            {truth?.seeded_worksheet_origin ??
              "synthetic_prerequisite_fixture (not real-AI relabeled)"}
          </dd>
        </div>
      </dl>
      <p className="aieos360-showcase__mode-truth-note">
        Browser URL/query parameters do not change provider runtime. Operator
        mode is configured before managed start and requires stop/restart to
        change. REAL_AI selected is not equivalent to verified real-provider
        generation.
      </p>
    </section>
  );
}
