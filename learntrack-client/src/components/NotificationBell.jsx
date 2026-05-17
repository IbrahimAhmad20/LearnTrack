import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const POLL_INTERVAL_MS = 30_000; // poll unread count every 30 s

const TYPE_ICON = {
  new_content: "▦",
  quiz_graded: "◈",
  announcement: "◉",
  enrollment_complete: "✓",
  certificate_issued: "✦",
  review_received: "★",
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // ── Fetch unread count (lightweight — hits partial index) ─────────────────
  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get("/notifications/me/unread-count");
      setUnread(res.data?.unread_count ?? 0);
    } catch (_) {
      // silently ignore — bell is non-critical
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = window.setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchCount]);

  // ── Load notifications when panel opens ───────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get("/notifications/me", { params: { limit: 15, page: 1 } })
      .then((res) => setNotifs(res.data?.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── Mark single notification as read ──────────────────────────────────────
  async function markRead(notif) {
    if (notif.is_read) return;
    try {
      await api.patch(`/notifications/${notif.notif_id}/read`);
      setNotifs((prev) =>
        prev.map((n) =>
          n.notif_id === notif.notif_id ? { ...n, is_read: true } : n,
        ),
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch (_) {}
  }

  // ── Mark all as read ──────────────────────────────────────────────────────
  async function markAllRead() {
    if (unread === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await api.patch("/notifications/me/read-all");
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (_) {
    } finally {
      setMarkingAll(false);
    }
  }

  function handleNotifClick(notif) {
    markRead(notif);
    if (notif.ref_course_id) {
      navigate(`/student/courses/${notif.ref_course_id}`);
      setOpen(false);
    }
  }

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: open ? "var(--accent-dim)" : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={open ? "var(--accent)" : "var(--text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "DM Mono, monospace",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
              border: "1.5px solid var(--bg-surface)",
              pointerEvents: "none",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxHeight: 440,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            overflow: "hidden",
            zIndex: 200,
            animation: "notifSlide 0.15s ease",
          }}
        >
          <style>{`
            @keyframes notifSlide {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Panel header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Notifications
              {unread > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: "var(--accent-dim)",
                    color: "var(--accent-text)",
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 99,
                    fontFamily: "DM Mono, monospace",
                  }}
                >
                  {unread} new
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                style={{
                  fontSize: 11,
                  color: "var(--accent-text)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "DM Mono, monospace",
                  opacity: markingAll ? 0.5 : 1,
                }}
              >
                {markingAll ? "Marking…" : "Mark all read"}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", maxHeight: 360 }}>
            {loading ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                }}
              >
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: "32px 24px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>
                  🔔
                </div>
                <p style={{ fontSize: 13 }}>You're all caught up</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.notif_id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "11px 14px",
                    borderBottom: "1px solid var(--border)",
                    background: notif.is_read
                      ? "transparent"
                      : "var(--accent-dim)",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-raised)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notif.is_read
                      ? "transparent"
                      : "var(--accent-dim)";
                  }}
                >
                  {/* Type icon */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: notif.is_read
                        ? "var(--bg-raised)"
                        : "var(--accent-dim)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      flexShrink: 0,
                      color: notif.is_read
                        ? "var(--text-muted)"
                        : "var(--accent)",
                    }}
                  >
                    {TYPE_ICON[notif.type] || "◉"}
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: notif.is_read
                          ? "var(--text-secondary)"
                          : "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {notif.body}
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 3,
                        fontFamily: "DM Mono, monospace",
                      }}
                    >
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.is_read && (
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        marginTop: 4,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <button
            onClick={() => {
              navigate("/student/notifications");
              setOpen(false);
            }}
            style={{
              width: "100%",
              padding: "10px",
              background: "var(--bg-raised)",
              border: "none",
              borderTop: "1px solid var(--border)",
              color: "var(--accent-text)",
              fontSize: 12,
              fontFamily: "DM Mono, monospace",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            View all notifications →
          </button>
        </div>
      )}
    </div>
  );
}
