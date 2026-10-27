import { useEffect, useState } from "react";
import {
  formatVerificationState,
  loadShowcaseRuntimeTruth,
  type ShowcaseRuntimeTruth,
} from "./showcaseRuntimeTruth";

export function ShowcaseModeTruthPanel() {
  const [truth, setTruth] = useState<ShowcaseRuntimeTruth | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadShowcaseRuntimeTruth().then((payload) => {
      if (!cancelled) {
        setTruth(payload);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const surfaceActive = truth?.runtime_surface_valid === true;
  const activeProvider = surfaceActive
    ? (truth?.active_provider_id ?? "—")
    : "—";
  const activeModel = surfaceActive ? (truth?.active_model_id ?? "—") : "—";
  const verificationState = surfaceActive
    ? formatVerificationState(truth?.verification_state)
    : "Managed showcase not running — runtime truth not verified";

  return (
    <section
      className="aieos360-showcase__section aieos360-showcase__mode-truth"
      aria-labelledby="aieos360-mode-truth-heading"
    >
      <h2 id="aieos360-mode-truth-heading">Showcase runtime truth</h2>
      <dl className="aieos360-showcase__mode-truth-grid">
        <div>
          <dt>Selected mode (operator)</dt>
          <dd>
            {surfaceActive
              ? (truth?.selected_mode ?? "DETERMINISTIC")
              : "— (not active)"}
          </dd>
        </div>
        <div>
          <dt>Verified runtime mode</dt>
          <dd>{surfaceActive ? (truth?.verified_runtime_mode ?? "—") : "—"}</dd>
        </div>
        <div>
          <dt>Active provider / model</dt>
          <dd>
            <code>{activeProvider}</code> / <code>{activeModel}</code>
          </dd>
        </div>
        <div>
          <dt>Runtime composition</dt>
          <dd>
            {surfaceActive && truth?.real_provider_runtime_verified
              ? "Observed via operator-verified Teacher backend surface"
              : "Not verified"}
          </dd>
        </div>
        <div>
          <dt>Live generation proof</dt>
          <dd>
            {truth?.real_provider_generation_verified
              ? "Proven (operator evidence)"
              : "Pending — aggregator/runtime composition is not generation proof"}
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
        This panel reads the operator-verified Teacher backend runtime surface
        written at managed start only. Browser URL/query parameters do not
        change provider runtime. Operator mode is configured before managed
        start and requires stop/restart to change.
      </p>
    </section>
  );
}
