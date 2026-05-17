import { useState, useEffect } from "react";
import { transactions as transactionsApi } from "../../api";
import { SkeletonCard, EmptyState, StatCard } from "../../components/ui";

function fmtCurrency(amount, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Earnings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    transactionsApi
      .earnings()
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const totalSales =
    data?.by_course?.reduce((s, c) => s + (c.sales || 0), 0) || 0;
  const bestCourse = data?.by_course?.[0]?.course_title || "—";

  const formatShortDate = (iso) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  if (loading) {
    return (
      <div className="p-8 page-enter">
        <h1
          className="font-display text-2xl mb-8"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Earnings
        </h1>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton h-3 w-1/2 mb-3" />
              <div className="skeleton h-7 w-3/4" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="p-8 page-enter">
        <h1
          className="font-display text-2xl mb-8"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Earnings
        </h1>
        <EmptyState
          icon="◑"
          title="No earnings yet"
          description="Revenue appears here once students purchase your courses"
        />
      </div>
    );
  }

  return (
    <div className="p-8 page-enter">
      <h1
        className="font-display text-2xl mb-6"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        Earnings
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={fmtCurrency(data.total)}
          accent
        />
        <StatCard label="Total Sales" value={totalSales} />
        <StatCard label="Best Seller" value={bestCourse} sub="by revenue" />
      </div>

      {/* Revenue by course */}
      {data.by_course?.length > 0 && (
        <div className="card p-5 mb-6">
          <h2
            className="text-xs uppercase tracking-widest mb-4"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            Revenue by Course
          </h2>
          <div className="flex flex-col gap-3">
            {data.by_course.map((course) => {
              const barWidth = data.total
                ? (course.revenue / data.total) * 100
                : 0;
              return (
                <div key={course.course_id} className="flex items-center gap-3">
                  <div
                    className="text-sm truncate"
                    style={{
                      color: "var(--text-secondary)",
                      minWidth: 0,
                      flex: "0 1 200px",
                    }}
                    title={course.course_title}
                  >
                    {course.course_title}
                  </div>
                  <div className="flex-1 relative" style={{ height: 8 }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "var(--bg-raised)",
                        borderRadius: 99,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${barWidth}%`,
                        background: "var(--accent)",
                        borderRadius: 99,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 12,
                      color: "var(--accent-text)",
                      flexShrink: 0,
                      minWidth: 90,
                      textAlign: "right",
                    }}
                  >
                    {fmtCurrency(course.revenue, course.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {data.recent?.length > 0 && (
        <div className="card overflow-hidden">
          <div
            className="px-5 py-3 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <h2
              className="text-xs uppercase tracking-widest"
              style={{
                color: "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              Recent Transactions
            </h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Date", "Course", "Amount", "Currency"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 20px",
                      textAlign: "left",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                      letterSpacing: "0.05em",
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent.map((tx, i) => (
                <tr
                  key={tx.transaction_id || i}
                  style={{
                    background:
                      i % 2 === 0 ? "transparent" : "var(--bg-raised)",
                    borderBottom:
                      i < data.recent.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                  }}
                >
                  <td
                    style={{
                      padding: "10px 20px",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {formatShortDate(tx.created_at)}
                  </td>
                  <td
                    style={{
                      padding: "10px 20px",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      maxWidth: 240,
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.courses?.title || "—"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "10px 20px",
                      fontSize: 12,
                      color: "var(--accent-text)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {fmtCurrency(tx.amount, tx.currency)}
                  </td>
                  <td
                    style={{
                      padding: "10px 20px",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {tx.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
