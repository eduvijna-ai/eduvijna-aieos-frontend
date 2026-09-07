import type { EducationalQuality } from "@/services/api/generated/teachingTypes";
import {
  isEducationalQualityPass,
  qualityCheckLabel,
  qualitySummaryText,
} from "./qualityPresentation";

export function EducationalQualitySummary({
  quality,
}: {
  quality: EducationalQuality;
}) {
  const passed = isEducationalQualityPass(quality);
  return (
    <div className="work-eq" data-testid="work-eq-summary">
      <p className="work-eq-summary">
        <span className="work-eq-kicker">Educational quality</span>
        <span className={passed ? "work-eq-pass" : "work-eq-attention"}>
          {qualitySummaryText(quality)}
        </span>
      </p>
      {quality.checks.length > 0 ? (
        <details className="work-eq-details">
          <summary>View quality details</summary>
          <ul className="work-eq-list">
            {quality.checks.map((check) => (
              <li key={check.code}>
                <div className="work-eq-row">
                  <span className="work-eq-label">
                    {check.passed ? "✓ " : ""}
                    {qualityCheckLabel(check.code)}
                  </span>
                  <span className="work-eq-result">
                    {check.passed ? "Passed" : "Not passed"}
                  </span>
                </div>
                {check.explanation ? (
                  <p className="work-eq-explanation">{check.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
