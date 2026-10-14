import type { MouseEvent, ReactNode } from "react";
import { Link, NavLink, type NavLinkProps } from "react-router-dom";
import "./aieos360-showcase.css";
import {
  SHOWCASE_LAUNCHER_PATH,
  useShowcaseActive,
  useWithShowcase,
} from "./showcaseContext";

type ShowcaseLinkProps = {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function ShowcaseLink({
  to,
  className,
  children,
  onClick,
}: ShowcaseLinkProps) {
  const destination = useWithShowcase(to);
  return (
    <Link to={destination} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

type ShowcaseNavLinkProps = {
  to: string;
  className?: NavLinkProps["className"];
  children: ReactNode;
};

export function ShowcaseNavLink({ to, className, children }: ShowcaseNavLinkProps) {
  const destination = useWithShowcase(to);
  return (
    <NavLink to={destination} className={className}>
      {children}
    </NavLink>
  );
}

type ShowcaseExternalHandoffProps = {
  href: string;
  children: ReactNode;
  testId?: string;
};

export function ShowcaseBackLink() {
  const active = useShowcaseActive();
  const launcherHref = useWithShowcase(SHOWCASE_LAUNCHER_PATH);
  if (!active) return null;
  return (
    <p className="aieos360-showcase-continuity">
      <Link to={launcherHref}>Back to AIEOS360 showcase</Link>
    </p>
  );
}

export function ShowcaseExternalHandoff({
  href,
  children,
  testId,
}: ShowcaseExternalHandoffProps) {
  const active = useShowcaseActive();
  if (!active) return null;
  return (
    <section
      className="aieos360-showcase-continuity panel"
      aria-label="Showcase continuation"
    >
      <p className="aieos360-showcase-continuity__label">Presenter continuation</p>
      <a
        className="aieos360-showcase-continuity__handoff"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testId}
      >
        {children}
        <span className="aieos360-showcase__sr-only"> (opens in a new tab)</span>
      </a>
    </section>
  );
}
