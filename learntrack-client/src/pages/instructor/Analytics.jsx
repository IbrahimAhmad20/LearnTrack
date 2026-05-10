import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { analytics, courses as coursesApi } from "../../api";
import { StatCard, SkeletonCard, ErrorMessage } from "../../components/ui";
import { AnalyticsChart, DataTable } from "../../components";

const DATE_PRESETS = [
  { id: "all", label: "All time" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
];

function dateRangeQuery(preset) {
  if (preset === "all") return {};
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

function completionBucketsFrom(rows) {
  const b = { "0–25%": 0, "26–50%": 0, "51–75%": 0, "76–100%": 0 };
  for (const r of rows) {
    const p = Number(r.avg_completion_pct) || 0;
    if (p <= 25) b["0–25%"] += 1;
    else if (p <= 50) b["26–50%"] += 1;
    else if (p <= 75) b["51–75%"] += 1;
    else b["76–100%"] += 1;
  }
  return Object.entries(b).map(([label, value]) => ({ label, value }));
}

export default function Analytics() {
  const [myCourses, setMyCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [datePreset, setDatePreset] = useState("all");

  const [active, setActive] = useState([]);
  const [completion, setCompletion] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [underperforming, setUnderperforming] = useState([]);
  const [courseDash, setCourseDash] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const courseTitleById = useMemo(() => {
    const m = {};
    for (const c of myCourses) {
      if (c.course_id != null) m[c.course_id] = c.title || `Course #${c.course_id}`;
    }
    return m;
  }, [myCourses]);

  const completionBuckets = useMemo(
    () => completionBucketsFrom(completion),
    [completion],
  );

  useEffect(() => {
    coursesApi
      .listMine()
      .then((r) => setMyCourses(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");
      const dateParams = dateRangeQuery(datePreset);
      const courseQ =
        selectedCourseId !== ""
          ? { course_id: selectedCourseId }
          : {};

      try {
        const [a, c, s, u] = await Promise.all([
          analytics.activeStudents({ ...dateParams, ...courseQ }),
          analytics.completionRates(courseQ),
          analytics.skippedContent(courseQ),
          analytics.underperforming({ threshold: 50, ...courseQ }),
        ]);

        if (cancelled) return;
        setActive(a.data ?? []);
        setCompletion(c.data ?? []);
        setSkipped(s.data ?? []);
        setUnderperforming(u.data ?? []);

        if (selectedCourseId !== "") {
          const dash = await analytics.instructorDash(selectedCourseId);
          if (!cancelled) setCourseDash(dash.data ?? null);
        } else {
          setCourseDash(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err.response?.data?.error ||
              "Could not load analytics. Check your connection and that analytics views are refreshed.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, datePreset]);

  const selectedTitle =
    selectedCourseId !== ""
      ? courseTitleById[Number(selectedCourseId)] || `Course #${selectedCourseId}`
      : null;

  return (
    <div className="p-8 max-w-6xl page-enter pb-24">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-xl font-medium mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Analytics
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Engagement and completion for students enrolled in your courses.
          </p>
        </div>
        {selectedCourseId !== "" && (
          <Link
            to={`/instructor/courses/${selectedCourseId}`}
            className="btn-ghost text-sm self-start sm:self-auto"
          >
            Edit course →
          </Link>
        )}
      </div>

      {/* Filters */}
      <div
        className="card p-4 mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:flex-wrap"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex-1 min-w-[200px]">
          <label
            className="text-xs uppercase tracking-widest block mb-2"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            Course
          </label>
          <select
            className="input-field"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={false}
          >
            <option value="">All my courses</option>
            {myCourses.map((c) => (
              <option key={c.course_id} value={String(c.course_id)}>
                {c.title || `Course #${c.course_id}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label
            className="text-xs uppercase tracking-widest block mb-2"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            Watch activity window
          </label>
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="text-xs px-3 py-1.5 rounded-md border transition-colors"
                style={{
                  borderColor:
                    datePreset === p.id ? "var(--accent)" : "var(--border)",
                  background:
                    datePreset === p.id
                      ? "rgba(61,158,110,0.12)"
                      : "transparent",
                  color:
                    datePreset === p.id
                      ? "var(--accent-text)"
                      : "var(--text-secondary)",
                }}
                onClick={() => setDatePreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ErrorMessage message={loadError} />

      {selectedCourseId !== "" && courseDash && !loading && (
        <div className="mb-2">
          <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>
            Snapshot · {selectedTitle}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <StatCard
              label="Enrollments"
              value={courseDash.enrollment_count ?? "—"}
              sub="students in this course"
              accent
            />
            <StatCard
              label="Top learners"
              value={(courseDash.top_students || []).length}
              sub="shown by watch time (top 5)"
            />
            <StatCard
              label="At-risk (quiz)"
              value={(courseDash.at_risk_students || []).length}
              sub="avg quiz score under 50%"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Active students"
          value={loading ? "—" : active.length}
          sub={
            datePreset === "all"
              ? "ranked by watch time · all activity"
              : `ranked by watch time · ${DATE_PRESETS.find((d) => d.id === datePreset)?.label.toLowerCase()}`
          }
          accent
        />
        <StatCard
          label="Completion rows"
          value={loading ? "—" : completion.length}
          sub="per learner & course"
        />
        <StatCard
          label="Skipped lessons"
          value={loading ? "—" : skipped.length}
          sub="content with skip events"
        />
        <StatCard
          label="Low quiz scores"
          value={loading ? "—" : underperforming.length}
          sub="under 50% avg (enrolled)"
        />
      </div>

      {/* Course detail panels when one course selected */}
      {selectedCourseId !== "" && courseDash && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="card p-4">
            <h3 className="text-sm font-medium mb-3">Top students by watch time</h3>
            {(courseDash.top_students || []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No watch data yet for this course.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {courseDash.top_students.map((row, i) => (
                  <li
                    key={row.user_id}
                    className="flex justify-between text-sm gap-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span>
                      <span
                        className="text-xs mr-2"
                        style={{
                          color: "var(--text-muted)",
                          fontFamily: "DM Mono, monospace",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {row.users?.full_name || row.user_id}
                    </span>
                    <span
                      className="font-mono text-xs shrink-0"
                      style={{ color: "var(--accent-text)" }}
                    >
                      {Math.round((row.total_watch_sec || 0) / 60)}m ·{" "}
                      {Math.round(Number(row.completion_pct || 0))}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium mb-3">At-risk (quiz & completion)</h3>
            {(courseDash.at_risk_students || []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No students flagged with low quiz scores in this course.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {courseDash.at_risk_students.map((row) => (
                  <li
                    key={row.user_id}
                    className="flex justify-between text-sm gap-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span>{row.users?.full_name || row.user_id}</span>
                    <span
                      className="font-mono text-xs shrink-0"
                      style={{ color: "var(--danger)" }}
                    >
                      quiz {Math.round(Number(row.avg_quiz_score || 0))}% ·{" "}
                      {Math.round(Number(row.completion_pct || 0))}% done
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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

      <div className="card overflow-hidden mb-8">
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
            No watch activity in this range. Students need to play content (and be
            enrolled).
          </div>
        ) : (
          <div>
            <div
              className="grid px-5 py-2.5 text-xs"
              style={{
                gridTemplateColumns: "1fr auto",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                fontFamily: "DM Mono, monospace",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <span>Student</span>
              <span>Watch time</span>
            </div>
            {active.slice(0, 10).map((s, i) => (
              <div
                key={s.user_id}
                className="grid px-5 py-3 text-sm"
                style={{
                  gridTemplateColumns: "1fr auto",
                  borderBottom:
                    i < Math.min(active.length, 10) - 1
                      ? "1px solid var(--border)"
                      : "none",
                  alignItems: "center",
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
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <AnalyticsChart
          title="Top watch time (minutes)"
          type="bar"
          data={active.slice(0, 5).map((row) => ({
            label: row.full_name,
            value: Math.round((row.total_watch_sec || 0) / 60),
          }))}
        />
        <AnalyticsChart
          title="Completion spread (learners)"
          type="bar"
          data={completionBuckets.map((row) => ({
            ...row,
            color: "rgba(61,158,110,0.55)",
          }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <DataTable
          columns={[
            { key: "full_name", label: "Student" },
            {
              key: "course_id",
              label: "Course",
              render: (v) =>
                v != null ? courseTitleById[v] || `#${v}` : "—",
            },
            {
              key: "avg_completion_pct",
              label: "Completion %",
              render: (v) => `${Math.round(Number(v || 0))}%`,
            },
          ]}
          rows={completion.map((r) => ({
            ...r,
            _rowUid: `${r.user_id}_${r.course_id}`,
          }))}
          rowKey="_rowUid"
          pageSize={6}
        />
        <DataTable
          columns={[
            { key: "title", label: "Lesson" },
            {
              key: "course_id",
              label: "Course",
              render: (v) =>
                v != null ? courseTitleById[v] || `#${v}` : "—",
            },
            {
              key: "skip_count",
              label: "Skips",
              render: (v) => String(v ?? "0"),
            },
          ]}
          rows={skipped}
          rowKey="content_id"
          pageSize={8}
        />
      </div>

      <div className="mb-3">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          Quiz: students below 50% average
        </h2>
      </div>
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-3">
            <SkeletonCard />
          </div>
        ) : underperforming.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No enrolled students under the threshold, or no quiz attempts yet.
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "full_name", label: "Student" },
              {
                key: "avg_score",
                label: "Avg score",
                render: (v) => `${Math.round(Number(v || 0))}%`,
              },
              {
                key: "attempts_count",
                label: "Attempts",
                render: (v) => String(v ?? "—"),
              },
            ]}
            rows={underperforming}
            rowKey="user_id"
            pageSize={10}
          />
        )}
      </div>
    </div>
  );
}
