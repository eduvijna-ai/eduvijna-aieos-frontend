import { NavLink, Outlet } from "react-router-dom";
import { DevSessionPanel } from "@/features/teacher-os/shell/DevSessionPanel";
import "@/features/teacher-os/shell/shell.css";
import "../parent-os.css";

const NAV_ITEMS = [
  { to: "/parent-os", label: "Home", end: true },
] as const;

export function ParentOsShell() {
  return (
    <div className="tos-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="tos-nav" aria-label="Parent OS">
        <div className="tos-brand">
          <p className="tos-brand-kicker">EduVijna</p>
          <p className="tos-brand-title">Parent OS</p>
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
          Current facts for children currently available in your Parent view.
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
