import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { notifications as notificationsApi } from "../../api";
import { Spinner, EmptyState } from "../../components/ui";

const TYPE_META = {
  new_content: { icon: "▦", label: "New lesson" },
  quiz_graded: { icon: "◈", label: "Quiz graded" },
  announcement: { icon: "◉", label: "Announcement" },
  enrollment_complete: { icon: "✓", label: "Enrolled" },
  certificate_issued: { icon: "✦", label: "Certificate" },
  review_received: { icon: "★", label: "Review" },
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const fetchNotifs = useCallback(
    async (pg = 1, unread = false, replace = true) => {
      if (pg === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await notificationsApi.list({
          page: pg,
          limit: 30,
          ...(unread ? { unread: true } : {}),
        });
        const data = res.data;
        const list = data.notifications || [];
        setItems((prev) => (replace ? list : [...prev, ...list]));
        setTotal(data.total || 0);
        setPage(pg);
        setTotalPages(data.totalPages || 1);
      } catch {
        if (replace) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchNotifs(1, unreadOnly, true);
  }, [unreadOnly]);

  const markRead = async (notif) => {
    if (!notif.is_read) {
      setItems((prev) =>
        prev.map((n) =>
          n.notif_id === notif.notif_id ? { ...n, is_read: true } : n,
        ),
      );
      notificationsApi.markRead(notif.notif_id).catch(() => {});
    }
    if (notif.ref_course_id) {
      navigate(`/student/courses/${notif.ref_course_id}`);
    }
  };

  const deleteNotif = async (e, id) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.notif_id !== id));
    notificationsApi.delete(id).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    notificationsApi.markAllRead().catch(() => {});
  };

  return (
    <div className="p-8 max-w-2xl page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1
            className="font-display text-2xl"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span
              style={{
                background: "var(--accent)",
                color: "#0e0e0f",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                padding: "1px 7px",
                fontFamily: "DM Mono, monospace",
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly((p) => !p)}
            className="btn-ghost"
            style={{
              fontSize: 12,
              ...(unreadOnly
                ? {
                    background: "var(--accent-dim)",
                    color: "var(--accent-text)",
                    borderColor: "var(--accent)",
                  }
                : {}),
            }}
          >
            {unreadOnly ? "Unread only" : "All"}
          </button>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="btn-ghost"
            style={{ fontSize: 12, opacity: unreadCount === 0 ? 0.4 : 1 }}
          >
            Mark all read
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-3">
              <div
                className="skeleton"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              />
              <div className="flex-1 flex flex-col gap-2">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="◉"
          title="All caught up"
          description="No notifications yet"
        />
      ) : (
        <div className="card overflow-hidden">
          {items.map((notif, i) => {
            const meta = TYPE_META[notif.type] || {
              icon: "·",
              label: notif.type,
            };
            return (
              <div
                key={notif.notif_id}
                onClick={() => markRead(notif)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom:
                    i < items.length - 1 ? "1px solid var(--border)" : "none",
                  cursor: "pointer",
                  background: !notif.is_read
                    ? "var(--accent-dim)"
                    : "transparent",
                  transition: "background 0.15s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!notif.is_read) return;
                  e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = !notif.is_read
                    ? "var(--accent-dim)"
                    : "transparent";
                }}
              >
                {/* Type icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--bg-raised)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    color: "var(--accent-text)",
                    flexShrink: 0,
                  }}
                >
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {notif.body}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {relativeTime(notif.created_at)}
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
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* Delete */}
                <button
                  onClick={(e) => deleteNotif(e, notif.notif_id)}
                  style={{
                    color: "var(--text-muted)",
                    padding: 4,
                    flexShrink: 0,
                  }}
                  title="Delete"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {page < totalPages && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => fetchNotifs(page + 1, unreadOnly, false)}
            disabled={loadingMore}
            className="btn-ghost"
            style={{ fontSize: 13 }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
