import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar({
  title = "Dashboard",
  subtitle,
  searchPlaceholder,
}) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = useMemo(() => searchParams.get("q") || "", [searchParams]);

  const initials =
    user?.full_name
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const setQ = (next) => {
    const sp = new URLSearchParams(searchParams);
    const value = String(next || "").trimStart();
    if (!value) sp.delete("q");
    else sp.set("q", value);
    setSearchParams(sp, { replace: true });
  };

  return (
    <header
      className="sticky top-0 z-20 px-6 py-3 flex items-center gap-3"
      style={{
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="min-w-0">
        <h1 className="text-sm font-medium truncate">{title}</h1>
        {subtitle ? (
          <p
            className="text-xs truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {searchPlaceholder ? (
          <input
            type="text"
            value={q}
            placeholder={searchPlaceholder}
            className="input-field text-xs"
            style={{ width: 220, height: 32 }}
            onChange={(e) => setQ(e.target.value)}
          />
        ) : null}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          title={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          style={{
            width: 52,
            height: 28,
            borderRadius: 20,
            border: "1px solid var(--border-light)",
            background: "var(--bg-raised)",
            position: "relative",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 0.3s, border-color 0.3s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background:
                theme === "light"
                  ? "linear-gradient(135deg,#2563eb,#6d28d9)"
                  : "linear-gradient(135deg,#4f8ef7,#7c3aed)",
              transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
              transform:
                theme === "light" ? "translateX(24px)" : "translateX(0)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: 6,
              transform: "translateY(-50%)",
              fontSize: 11,
              pointerEvents: "none",
            }}
          >
            🌙
          </span>
          <span
            style={{
              position: "absolute",
              top: "50%",
              right: 5,
              transform: "translateY(-50%)",
              fontSize: 11,
              pointerEvents: "none",
            }}
          >
            ☀️
          </span>
        </button>
        <button
          className="w-8 h-8 rounded-full text-xs font-mono"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent-text)",
            border: "1px solid var(--accent)",
          }}
          title={user?.full_name || "Account"}
        >
          {initials}
        </button>
        <button
          onClick={handleLogout}
          className="btn-ghost py-1.5 px-3 text-xs"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
