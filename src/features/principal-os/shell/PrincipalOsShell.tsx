import { NavLink, Outlet } from "react-router-dom";
import { DevSessionPanel } from "@/features/teacher-os/shell/DevSessionPanel";
import "@/features/teacher-os/shell/shell.css";
import "../school-intelligence/school-intelligence.css";

const NAV_ITEMS = [
  { to: "/principal-os", label: "School Intelligence", end: true },
] as const;

export function PrincipalOsShell() {
  return (
    <div className="tos-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="tos-nav" aria-label="Principal OS">
        <div className="tos-brand">
          <p className="tos-brand-kicker">EduVijna</p>
          <p className="tos-brand-title">Principal OS</p>
        </div>
        <nav aria-label="Primary">
          <ul className="tos-nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive ? "tos-nav-link is-active" : "tos-nav-link"
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="tos-nav-note muted">
          Current School Intelligence facts for classes in your authorized
          scope.
        </p>
      </aside>
      <div className="tos-main-column">
        <DevSessionPanel />
        <main id="main-content" className="tos-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
