import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { enrollments as enrollmentsApi } from "../../api";
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
    enrollmentsApi
      .list()
      .then((r) => setEnrolled(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || "Student";

  const completed = enrolled.filter((e) => e.progress_pct >= 100).length;

  return (
    <div className="p-8 max-w-4xl page-enter">
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

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Enrolled"
          value={loading ? "—" : enrolled.length}
          sub="courses"
        />
        <StatCard
          label="Completed"
          value={loading ? "—" : completed}
          sub="courses"
          accent
        />
        <StatCard
          label="In progress"
          value={loading ? "—" : enrolled.length - completed}
          sub="courses"
        />
      </div>

      <div className="mb-8">
        <Heatmap />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          My courses
        </h2>
        <Link to="/student/courses" className="btn-ghost py-1.5 px-3 text-xs">
          Browse all →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {enrolled.slice(0, 3).map((e) => (
          <CourseCard
            key={e.course_id}
            title={e.title}
            instructor={e.instructor_name}
            status="enrolled"
            progress={e.progress_pct || 0}
            description={e.description}
            action={
              <Link to={`/student/courses/${e.course_id}`} className="btn-ghost text-xs py-1 px-2">
                Open
              </Link>
            }
          />
        ))}
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
          enrolled.slice(0, 6).map((e) => (
            <Link
              key={e.course_id}
              to={`/student/courses/${e.course_id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors duration-150"
              style={{ borderBottom: "1px solid var(--border)" }}
              onMouseEnter={(el) =>
                (el.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(el) =>
                (el.currentTarget.style.background = "transparent")
              }
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {e.title}
                </p>
                <div className="mt-2">
                  <ProgressBar value={e.progress_pct || 0} max={100} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
