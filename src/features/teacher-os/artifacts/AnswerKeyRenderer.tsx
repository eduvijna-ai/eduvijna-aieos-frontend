import { artifactTypeLabel } from "./artifactLabels";
import type { AnswerKeyArtifact, AnswerKeyEntry } from "./artifactTypes";

const SOURCE_ORDER = ["worksheet", "quiz", "homework"] as const;

function groupEntries(entries: AnswerKeyEntry[]) {
  const groups = new Map<string, AnswerKeyEntry[]>();
  for (const kind of SOURCE_ORDER) {
    groups.set(kind, []);
  }
  for (const entry of entries) {
    const existing = groups.get(entry.sourceArtifactKind);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.sourceArtifactKind, [entry]);
    }
  }
  return [...groups.entries()].filter(([, items]) => items.length > 0);
}

export function AnswerKeyRenderer({ answerKey }: { answerKey: AnswerKeyArtifact }) {
  const groups = groupEntries(answerKey.entries);

  return (
    <article className="artifact-document" aria-label="Answer Key">
      <p className="artifact-kicker">Answer Key</p>
      <h2>{answerKey.title}</h2>

      {groups.map(([kind, items]) => (
        <section
          key={kind}
          className="artifact-answer-group artifact-section"
          aria-labelledby={`answer-group-${kind}`}
        >
          <h3 id={`answer-group-${kind}`}>{artifactTypeLabel(kind)}</h3>
          <ol className="artifact-question-list">
            {items.map((entry, index) => (
              <li key={`${kind}-${index}`} className="artifact-answer-item">
                <h4>Question {index + 1}</h4>
                <p className="artifact-answer">
                  <strong>Answer:</strong> {entry.answer}
                </p>
                <p className="artifact-explanation">{entry.explanation}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}
