import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { courses as coursesApi, instructors as instructorsApi } from "../../api";
import { StatCard, Badge, SkeletonCard, EmptyState, Spinner } from "../../components/ui";
import { useToast } from "../../components";

function CourseRow({ course }) {
  return (
    <Link
      to="/instructor/courses"
      className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 group"
      style={{ borderBottom: "1px solid var(--border)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--bg-hover)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Title */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {course.title}
        </p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {course.category || "Uncategorized"}
        </p>
      </div>

      {/* Status */}
      <Badge type={course.is_published ? "published" : "draft"}>
        {course.is_published ? "published" : "draft"}
      </Badge>

      {/* Arrow */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

export default function InstructorDashboard() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [courseList, setCourseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deptInput, setDeptInput] = useState("");
  const [qualInput, setQualInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    coursesApi
      .listMine()
      .then((r) => setCourseList(r.data))
      .catch(() => setError("Could not load courses"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const p = user?.instructor_profile;
    setDeptInput(p?.department ?? "");
    setQualInput(p?.qualification ?? "");
  }, [user]);

  const saveInstructorProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await instructorsApi.updateMe({
        department: deptInput.trim() || null,
        qualification: qualInput.trim() || null,
      });
      await refreshUser();
      showToast("Teaching profile saved", "success");
    } catch (err) {
      showToast(
        err.response?.data?.error || "Could not save teaching profile",
        "error",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const published = courseList.filter((c) => c.is_published).length;
  const draft = courseList.length - published;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || "Instructor";

  return (
    <div className="p-8 max-w-4xl page-enter">
      {/* Header */}
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
          Here's what's happening with your courses today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Total courses"
          value={loading ? "—" : courseList.length}
          sub="all time"
        />
        <StatCard
          label="Published"
          value={loading ? "—" : published}
          sub="live & visible"
          accent
        />
        <StatCard
          label="Drafts"
          value={loading ? "—" : draft}
          sub="in progress"
        />
      </div>

      {(user?.role === "instructor" || user?.role === "admin") && (
        <div className="card p-5 mb-8">
          <h2
            className="text-sm font-medium mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Teaching profile
          </h2>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
          >
            Department and qualification show on course pages next to your name.
            Set them here or during registration as an instructor.
          </p>
          <form
            onSubmit={saveInstructorProfile}
            className="flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            <div className="flex-1 min-w-0">
              <label className="label">Department</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Computer Science"
                value={deptInput}
                onChange={(e) => setDeptInput(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="label">Qualification</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. PhD Software Engineering"
                value={qualInput}
                onChange={(e) => setQualInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-primary shrink-0"
              disabled={savingProfile}
              style={{ opacity: savingProfile ? 0.7 : 1 }}
            >
              {savingProfile ? <Spinner size={14} /> : "Save"}
            </button>
          </form>
        </div>
      )}

      {/* Course list */}
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-sm font-medium"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "DM Mono, monospace",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Your courses
        </h2>
        <Link
          to="/instructor/courses"
          className="btn-ghost py-1.5 px-3 text-xs"
        >
          Manage all →
        </Link>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-2 flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: "var(--danger)" }}
          >
            {error}
          </div>
        ) : courseList.length === 0 ? (
          <EmptyState
            icon="▦"
            title="No courses yet"
            description="Create your first course to get started"
            action={
              <Link to="/instructor/courses" className="btn-primary">
                Create course
              </Link>
            }
          />
        ) : (
          courseList
            .slice(0, 8)
            .map((course) => (
              <CourseRow key={course.course_id} course={course} />
            ))
        )}
      </div>

      {!loading && courseList.length > 8 && (
        <p
          className="text-xs text-center mt-3"
          style={{ color: "var(--text-muted)" }}
        >
          Showing 8 of {courseList.length} courses —{" "}
          <Link
            to="/instructor/courses"
            style={{ color: "var(--accent-text)" }}
          >
            view all
          </Link>
        </p>
      )}
    </div>
  );
}
