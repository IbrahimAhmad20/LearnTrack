import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ title = "Dashboard", subtitle, searchPlaceholder }) {
  const { user, logout } = useAuth();
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
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
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
        <button onClick={handleLogout} className="btn-ghost py-1.5 px-3 text-xs">
          Logout
        </button>
      </div>
    </header>
  );
}
