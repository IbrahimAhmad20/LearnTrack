// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2a10 10 0 0 1 0 20" />
    </svg>
  );
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-2/3" />
      <div className="flex gap-2 mt-2">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <p
        className="text-xs mb-1 uppercase tracking-widest"
        style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-display"
        style={{
          color: accent ? "var(--accent-text)" : "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, type = "default" }) {
  const styles = {
    default: { background: "var(--bg-hover)", color: "var(--text-secondary)" },
    published: { background: "rgba(61,158,110,0.15)", color: "#5ec99a" },
    draft: { background: "var(--bg-hover)", color: "var(--text-muted)" },
    accent: { background: "var(--accent-dim)", color: "var(--accent-text)" },
  };
  return (
    <span
      className="tag"
      style={{ ...styles[type], border: "1px solid transparent" }}
    >
      {children}
    </span>
  );
}

// ── ErrorMessage ──────────────────────────────────────────────────────────────
export function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div
      className="rounded px-3 py-2 text-sm"
      style={{
        background: "rgba(192,83,74,0.12)",
        border: "1px solid rgba(192,83,74,0.3)",
        color: "#e07a73",
      }}
    >
      {message}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center"
      style={{ color: "var(--text-muted)" }}
    >
      <div className="text-4xl mb-4 opacity-30">{icon}</div>
      <p
        className="font-medium mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {title}
      </p>
      <p className="text-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value = 0, max = 100, label }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {label}
          </span>
          <span
            className="text-xs"
            style={{
              color: "var(--accent-text)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            {pct}%
          </span>
        </div>
      )}
      <div
        className="rounded-full overflow-hidden"
        style={{ height: 4, background: "var(--bg-hover)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card-raised w-full p-6"
        style={{ maxWidth: width, animation: "slideUp 0.2s ease" }}
      >
        <style>{`@keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }`}</style>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
