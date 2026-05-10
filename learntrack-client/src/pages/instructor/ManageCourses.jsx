import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { courses as coursesApi } from "../../api";
import {
  Badge,
  Spinner,
  ErrorMessage,
  EmptyState,
  SkeletonCard,
} from "../../components/ui";

// ── Create course modal ────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    is_published: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => {
    const val =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    try {
      await coursesApi.create(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card-raised w-full max-w-md p-6"
        style={{ animation: "slideUp 0.2s ease" }}
      >
        <style>{`@keyframes slideUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }`}</style>

        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium" style={{ color: "var(--text-primary)" }}>
            New course
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-opacity-10"
            style={{ color: "var(--text-muted)" }}
          >
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

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="label">Course title *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Introduction to Machine Learning"
              value={form.title}
              onChange={set("title")}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Category</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Computer Science"
              value={form.category}
              onChange={set("category")}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input-field"
              placeholder="What will students learn?"
              rows={3}
              value={form.description}
              onChange={set("description")}
              style={{ resize: "none" }}
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={set("is_published")}
              style={{ accentColor: "var(--accent)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Publish immediately
            </span>
          </label>

          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Next: open your course from the list to{" "}
            <strong style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
              add lessons (videos, docs)
            </strong>
            . Quizzes are optional and can be added there too.
          </p>

          <ErrorMessage message={error} />

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 justify-center"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Spinner size={15} /> : "Create course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Course card ────────────────────────────────────────────────────────────────
function CourseCard({ course, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      await coursesApi.delete(course.course_id);
      onDelete(course.course_id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div
      className="card p-5 flex flex-col gap-3 transition-all duration-200 hover:border-opacity-60"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="font-medium text-sm leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {course.title}
          </p>
          {course.category && (
            <p
              className="text-xs mt-0.5"
              style={{
                color: "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              {course.category}
            </p>
          )}
        </div>
        <Badge type={course.is_published ? "published" : "draft"}>
          {course.is_published ? "live" : "draft"}
        </Badge>
      </div>

      {course.description && (
        <p
          className="text-xs line-clamp-2 leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {course.description}
        </p>
      )}

      <div className="flex gap-2 mt-auto pt-1">
        <Link
          to={`/instructor/courses/${course.course_id}`}
          className="btn-ghost flex-1 justify-center text-xs py-1.5"
        >
          Edit
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1.5 rounded text-xs transition-all duration-150"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--danger)",
            opacity: deleting ? 0.5 : 1,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(192,83,74,0.1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          {deleting ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ManageCourses() {
  const [courseList, setCourseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | published | draft
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  const load = useCallback(() => {
    setLoading(true);
    coursesApi
      .listMine()
      .then((r) => setCourseList(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = courseList.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "published" ? c.is_published : !c.is_published);
    return matchSearch && matchFilter;
  });

  const removeLocally = (id) =>
    setCourseList((prev) => prev.filter((c) => c.course_id !== id));

  return (
    <div className="p-8 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Courses
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {courseList.length} course{courseList.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New course
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          className="input-field"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            const sp = new URLSearchParams(searchParams);
            if (!next) sp.delete("q");
            else sp.set("q", next);
            setSearchParams(sp, { replace: true });
          }}
          style={{ maxWidth: 280 }}
        />
        <div
          className="flex gap-1 p-0.5 rounded"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
          }}
        >
          {["all", "published", "draft"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded text-xs transition-all duration-150"
              style={{
                background: filter === f ? "var(--bg-hover)" : "transparent",
                color:
                  filter === f ? "var(--text-primary)" : "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="▦"
          title={search ? "No results" : "No courses yet"}
          description={
            search
              ? `No courses match "${search}"`
              : "Create your first course to get started"
          }
          action={
            !search && (
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                Create course
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => (
            <CourseCard
              key={course.course_id}
              course={course}
              onDelete={removeLocally}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CreateModal onClose={() => setShowModal(false)} onCreated={load} />
      )}
    </div>
  );
}
