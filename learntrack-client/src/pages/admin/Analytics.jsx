import { useState, useEffect } from "react";
import { analytics } from "../../api";
import { StatCard, SkeletonCard, ErrorMessage } from "../../components/ui";
import { AnalyticsChart, DataTable } from "../../components";

export default function AdminAnalytics() {
  const [active, setActive] = useState([]);
  const [completion, setCompletion] = useState([]);
  const [underperforming, setUnderperforming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoadError("");
    Promise.all([
      analytics.activeStudents(),
      analytics.completionRates(),
      analytics.underperforming(),
    ])
      .then(([a, c, u]) => {
        setActive(a.data ?? []);
        setCompletion(c.data ?? []);
        setUnderperforming(u.data ?? []);
      })
      .catch((err) => {
        setLoadError(
          err.response?.data?.error ||
            "Could not load analytics. If counts stay empty, ensure materialized views exist and run refresh (admin).",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-4xl page-enter">
      <div className="mb-8">
        <h1
          className="text-xl font-medium mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Platform analytics
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Engagement and performance across the entire platform.
        </p>
      </div>

      <ErrorMessage message={loadError} />

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Active students"
          value={loading ? "—" : active.length}
          sub="with watch activity"
          accent
        />
        <StatCard
          label="Completion data"
          value={loading ? "—" : completion.length}
          sub="students tracked"
        />
        <StatCard
          label="Underperforming"
          value={loading ? "—" : underperforming.length}
          sub="students flagged"
        />
      </div>

      {/* Active students */}
      <div className="mb-3">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          Most active students
        </h2>
      </div>
      <div className="card overflow-hidden mb-6">
        {loading ? (
          <div className="p-3 flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No activity data yet.
          </div>
        ) : (
          active.slice(0, 10).map((s, i) => (
            <div
              key={s.user_id}
              className="grid px-5 py-3 text-sm items-center"
              style={{
                gridTemplateColumns: "1fr auto",
                borderBottom:
                  i < Math.min(active.length, 10) - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-xs"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "DM Mono, monospace",
                    minWidth: 20,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ color: "var(--text-primary)" }}>
                  {s.full_name}
                </span>
              </div>
              <span
                style={{
                  color: "var(--accent-text)",
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                }}
              >
                {Math.round(s.total_watch_sec / 60)}m
              </span>
            </div>
          ))
        )}
      </div>

      {/* Underperforming */}
      <div className="mb-3">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          Underperforming students
        </h2>
      </div>
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-3 flex flex-col gap-2">
            {[1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : underperforming.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No underperforming students flagged.
          </div>
        ) : (
          underperforming.map((s, i) => (
            <div
              key={s.user_id}
              className="grid px-5 py-3 text-sm items-center"
              style={{
                gridTemplateColumns: "1fr auto",
                borderBottom:
                  i < underperforming.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>
                {s.full_name}
              </span>
              <span
                style={{
                  color: "var(--danger)",
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  textAlign: "right",
                }}
              >
                avg {Math.round(Number(s.avg_score ?? 0))}%
                {s.attempts_count != null
                  ? ` · ${s.attempts_count} attempts`
                  : ""}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <AnalyticsChart
          title="Top watch time (minutes)"
          type="bar"
          data={active.slice(0, 7).map((row) => ({
            label: row.full_name,
            value: Math.round((row.total_watch_sec || 0) / 60),
          }))}
        />
        <DataTable
          columns={[
            { key: "full_name", label: "Student" },
            {
              key: "avg_score",
              label: "Avg Score",
              render: (value) => `${Math.round(Number(value || 0))}%`,
            },
          ]}
          rows={underperforming}
          rowKey="user_id"
          pageSize={6}
        />
      </div>
    </div>
  );
}
