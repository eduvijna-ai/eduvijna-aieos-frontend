import { useMemo } from "react";
import {
  readRoleUrlOverrides,
  readShowcaseHost,
  resolveRoleLaunchUrls,
  resolveStoryStageUrl,
  ROLE_ENTRY_PATHS,
  STORY_STAGE_ORDER,
  type ShowcaseRole,
} from "./roleUrls";
import { withShowcaseAbsoluteUrl } from "./showcaseContext";
import { ShowcaseModeTruthPanel } from "./ShowcaseModeTruthPanel";
import "./aieos360-showcase.css";

const ROLE_CARDS: ReadonlyArray<{
  role: ShowcaseRole;
  title: string;
  description: string;
}> = [
  {
    role: "teacher",
    title: "Teacher OS",
    description: "Mission control for preparation, teaching, and assessment.",
  },
  {
    role: "student",
    title: "Student OS",
    description: "Assignments, attempts, and learner-facing work.",
  },
  {
    role: "principal",
    title: "Principal OS",
    description: "School intelligence and leadership visibility.",
  },
  {
    role: "parent",
    title: "Parent OS",
    description: "Family-facing progress and assignment awareness.",
  },
];

export function Aieos360ShowcaseLauncherPage() {
  const host = useMemo(() => readShowcaseHost(), []);
  const overrides = useMemo(() => readRoleUrlOverrides(), []);
  const roleUrls = useMemo(
    () => resolveRoleLaunchUrls(host, overrides),
    [host, overrides],
  );
  const showcaseRoleUrls = useMemo(
    () => ({
      teacher: withShowcaseAbsoluteUrl(roleUrls.teacher),
      student: withShowcaseAbsoluteUrl(roleUrls.student),
      principal: withShowcaseAbsoluteUrl(roleUrls.principal),
      parent: withShowcaseAbsoluteUrl(roleUrls.parent),
    }),
    [roleUrls],
  );

  return (
    <div className="aieos360-showcase">
      <header className="aieos360-showcase__banner" role="banner">
        <p className="aieos360-showcase__eyebrow">Client demonstration</p>
        <h1 className="aieos360-showcase__title">
          AIEOS360 Client Showcase — NON_PRODUCTION / SYNTHETIC REHEARSAL
        </h1>
        <p className="aieos360-showcase__lede">
          Launch each role in its own rehearsal surface. Keep this launcher tab
          open to return between stages during a presentation.
        </p>
      </header>

      <main className="aieos360-showcase__main">
        <ShowcaseModeTruthPanel />

        <section
          className="aieos360-showcase__section"
          aria-labelledby="aieos360-role-launch-heading"
        >
          <h2 id="aieos360-role-launch-heading">Role launch</h2>
          <ul className="aieos360-showcase__role-grid">
            {ROLE_CARDS.map((card) => (
              <li key={card.role}>
                <article className="aieos360-showcase__role-card">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <p className="aieos360-showcase__path">
                    Entry:{" "}
                    <code>{ROLE_ENTRY_PATHS[card.role]}</code>
                  </p>
                  <a
                    className="aieos360-showcase__launch"
                    href={showcaseRoleUrls[card.role]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open {card.title}
                    <span className="aieos360-showcase__sr-only">
                      {" "}
                      (opens in a new tab)
                    </span>
                  </a>
                </article>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="aieos360-showcase__section"
          aria-labelledby="aieos360-story-heading"
        >
          <h2 id="aieos360-story-heading">Story map</h2>
          <p className="aieos360-showcase__story-intro">
            Follow the rehearsal narrative in order. Each stage uses an existing
            product route on the appropriate role surface.
          </p>
          <ol
            className="aieos360-showcase__story-map"
            aria-label="Story map stages"
          >
            {STORY_STAGE_ORDER.map((stage, index) => (
              <li key={stage.id} className="aieos360-showcase__story-step">
                <a
                  className="aieos360-showcase__story-link"
                  href={withShowcaseAbsoluteUrl(
                    resolveStoryStageUrl(
                      stage.id,
                      host,
                      roleUrls,
                      overrides,
                    ),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {stage.label}
                  <span className="aieos360-showcase__sr-only">
                    {" "}
                    (opens in a new tab)
                  </span>
                </a>
                {index < STORY_STAGE_ORDER.length - 1 ? (
                  <span
                    className="aieos360-showcase__story-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
