import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = {
  instructor: [
    { to: "/instructor", label: "Overview", icon: "⬡", end: true },
    { to: "/instructor/courses", label: "Courses", icon: "▦" },
    { to: "/instructor/analytics", label: "Analytics", icon: "◈" },
  ],
  student: [
    { to: "/student", label: "Dashboard", icon: "⬡", end: true },
    { to: "/student/courses", label: "Browse courses", icon: "▦" },
    { to: "/student/quizzes", label: "Quizzes", icon: "◈" },
  ],
  admin: [
    { to: "/admin", label: "Overview", icon: "⬡", end: true },
    { to: "/admin/users", label: "Users", icon: "◉" },
    { to: "/admin/courses", label: "Courses", icon: "▦" },
    { to: "/admin/analytics", label: "Analytics", icon: "◈" },
  ],
};

export default function Sidebar({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = NAV[role] || NAV.student;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials =
    user?.full_name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <aside
      className="flex flex-col h-screen sticky top-0"
      style={{
        width: 220,
        minWidth: 220,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-5 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="font-display text-lg italic"
          style={{ color: "var(--accent)", letterSpacing: "-0.01em" }}
        >
          Learn
        </span>
        <span
          className="font-display text-lg"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
        >
          Track
        </span>
      </div>

      {/* User badge */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded text-xs font-medium"
            style={{
              width: 28,
              height: 28,
              background: "var(--accent-dim)",
              color: "var(--accent-text)",
              fontFamily: "DM Mono, monospace",
              border: "1px solid var(--accent)",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {user?.full_name || "User"}
            </p>
            <p
              className="text-xs truncate"
              style={{
                color: "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              {role}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        <p
          className="px-3 mb-2 text-xs uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          Workspace
        </p>
        {nav.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <span style={{ fontSize: 14, opacity: 0.7 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-left"
          style={{ color: "var(--danger)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
