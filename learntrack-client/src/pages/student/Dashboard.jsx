import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { enrollments as enrollmentsApi } from "../../api";
import api from "../../api";
import {
  StatCard,
  ProgressBar,
  SkeletonCard,
  EmptyState,
} from "../../components/ui";
import { CourseCard, Heatmap } from "../../components";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [enrolled, setEnrolled] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [enrollRes, progressRes] = await Promise.allSettled([
          enrollmentsApi.list(),
          api.get("/progress/me"),
        ]);

        const enrollments =
          enrollRes.status === "fulfilled" ? enrollRes.value.data || [] : [];

        const progressItems =
          progressRes.status === "fulfilled"
            ? progressRes.value.data || []
            : [];

        // group progress items by course_id, average percent
        const progressByCourse = {};
        for (const item of progressItems) {
          const courseId = item.content?.course_id;
          if (!courseId) continue;
          if (!progressByCourse[courseId])
            progressByCourse[courseId] = { total: 0, count: 0 };
          progressByCourse[courseId].total += item.progress_percent || 0;
          progressByCourse[courseId].count += 1;
        }

        const merged = enrollments.map((e) => {
          const p = progressByCourse[e.course_id];
          const pct = p ? Math.round(p.total / p.count) : 0;
          return { ...e, progress_pct: Number.isFinite(pct) ? pct : 0 };
        });

        setEnrolled(merged);
      } catch {
        // leave empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || "Student";

  const completed = enrolled.filter((e) => (e.progress_pct ?? 0) >= 100).length;
  const inProgress = enrolled.filter(
    (e) => (e.progress_pct ?? 0) > 0 && (e.progress_pct ?? 0) < 100,
  ).length;

  // in-progress first, then not-started, then completed
  const sorted = [...enrolled].sort((a, b) => {
    const rank = (e) => {
      const p = e.progress_pct ?? 0;
      return p > 0 && p < 100 ? 0 : p === 0 ? 1 : 2;
    };
    return rank(a) - rank(b);
  });

  return (
    <div className="p-8 page-enter">
      {/* greeting */}
      <div className="mb-8">
        <h1
          className="font-display text-3xl mb-1"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          {greeting},{" "}
          <span className="italic" style={{ color: "var(--accent)" }}>
            {firstName}
          </span>
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Keep learning — every lesson counts.
        </p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Enrolled"
          value={loading ? "—" : enrolled.length}
          sub="courses"
        />
        <StatCard
          label="In progress"
          value={loading ? "—" : inProgress}
          sub="courses"
          accent
        />
        <StatCard
          label="Completed"
          value={loading ? "—" : completed}
          sub="courses"
        />
      </div>

      {/* heatmap */}
      <div className="mb-8">
        <Heatmap />
      </div>

      {/* continue learning — only shown when there are active courses */}
      {!loading && inProgress > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="text-xs uppercase tracking-widest"
              style={{
                color: "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              Continue learning
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {sorted
              .filter(
                (e) => (e.progress_pct ?? 0) > 0 && (e.progress_pct ?? 0) < 100,
              )
              .slice(0, 3)
              .map((e) => (
                <CourseCard
                  key={e.course_id}
                  title={e.title}
                  instructor={e.instructor_name}
                  status="enrolled"
                  progress={e.progress_pct}
                  description={e.description}
                  thumbnail_url={e.thumbnail_url}
                  action={
                    <Link
                      to={`/student/courses/${e.course_id}`}
                      className="btn-primary w-full justify-center text-xs py-1.5"
                    >
                      Continue →
                    </Link>
                  }
                />
              ))}
          </div>
        </>
      )}

      {/* all courses — compact list */}
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          All my courses
        </h2>
        <Link to="/student/courses" className="btn-ghost py-1.5 px-3 text-xs">
          Browse catalogue →
        </Link>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-3 flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : enrolled.length === 0 ? (
          <EmptyState
            icon="▦"
            title="No courses yet"
            description="Browse available courses and enroll to get started"
            action={
              <Link to="/student/courses" className="btn-primary">
                Browse courses
              </Link>
            }
          />
        ) : (
          sorted.map((e, i) => (
            <Link
              key={e.course_id}
              to={`/student/courses/${e.course_id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors duration-150"
              style={{
                borderBottom:
                  i < sorted.length - 1 ? "1px solid var(--border)" : "none",
              }}
              onMouseEnter={(el) =>
                (el.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(el) =>
                (el.currentTarget.style.background = "transparent")
              }
            >
              {/* circular progress ring */}
              <div style={{ flexShrink: 0 }}>
                {(() => {
                  const pct = Number.isFinite(e.progress_pct)
                    ? e.progress_pct
                    : 0;
                  return (
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="var(--bg-hover)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={pct >= 100 ? "var(--success)" : "var(--accent)"}
                        strokeWidth="3"
                        strokeDasharray={`${(pct / 100) * 87.96} 87.96`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                        style={{ transition: "stroke-dasharray 0.4s ease" }}
                      />
                      <text
                        x="18"
                        y="18"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{
                          fontSize: 8,
                          fontFamily: "DM Mono, monospace",
                          fontWeight: 600,
                          fill:
                            pct >= 100
                              ? "var(--success)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {pct >= 100 ? "✓" : `${pct}%`}
                      </text>
                    </svg>
                  );
                })()}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate mb-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {e.title}
                </p>
                <p
                  className="text-xs truncate"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "DM Mono, monospace",
                  }}
                >
                  {e.instructor_name
                    ? `by ${e.instructor_name}`
                    : e.enrolled_at
                      ? `Enrolled ${new Date(e.enrolled_at).toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`
                      : ""}
                </p>
              </div>

              {/* status badge */}
              <div style={{ flexShrink: 0 }}>
                {(e.progress_pct ?? 0) >= 100 ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: "rgba(29,158,117,0.12)",
                      color: "var(--success)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    done
                  </span>
                ) : (e.progress_pct ?? 0) > 0 ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: "var(--accent-dim)",
                      color: "var(--accent-text)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    active
                  </span>
                ) : (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: "var(--bg-hover)",
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    not started
                  </span>
                )}
              </div>

              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, opacity: 0.5 }}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
