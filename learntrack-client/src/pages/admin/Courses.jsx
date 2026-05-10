import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { admin as adminApi } from "../../api";
import { Badge, Spinner, EmptyState, SkeletonCard } from "../../components/ui";

export default function AdminCourses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .allCourses()
      .then((r) => setCourses(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  const deleteCourse = async (course) => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`))
      return;
    setDeleting(course.course_id);
    try {
      await adminApi.deleteCourse(course.course_id);
      setCourses((prev) =>
        prev.filter((c) => c.course_id !== course.course_id),
      );
    } catch {
    } finally {
      setDeleting(null);
    }
  };

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            All courses
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {courses.length} courses on the platform
          </p>
        </div>
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
          style={{ maxWidth: 260 }}
        />
      </div>

      <div className="card overflow-hidden">
        <div
          className="grid px-5 py-2.5 text-xs"
          style={{
            gridTemplateColumns: "1fr auto auto auto",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
            fontFamily: "DM Mono, monospace",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <span>Title</span>
          <span>Category</span>
          <span>Status</span>
          <span></span>
        </div>

        {loading ? (
          <div className="p-3 flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="▦"
            title="No courses found"
            description="Try a different search"
          />
        ) : (
          filtered.map((c, i) => (
            <div
              key={c.course_id}
              className="grid px-5 py-3.5 text-sm items-center gap-4"
              style={{
                gridTemplateColumns: "1fr auto auto auto",
                borderBottom:
                  i < filtered.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <p
                className="font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {c.title}
              </p>
              <span
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                }}
              >
                {c.category || "—"}
              </span>
              <Badge type={c.is_published ? "published" : "draft"}>
                {c.is_published ? "live" : "draft"}
              </Badge>
              <button
                onClick={() => deleteCourse(c)}
                disabled={deleting === c.course_id}
                className="px-2 py-1 rounded text-xs transition-all duration-150"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--danger)",
                  opacity: deleting === c.course_id ? 0.5 : 1,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(192,83,74,0.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {deleting === c.course_id ? <Spinner size={12} /> : "Delete"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
