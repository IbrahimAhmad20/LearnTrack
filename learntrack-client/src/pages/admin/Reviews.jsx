import { useState, useEffect, useMemo } from "react";
import api, { reviews as reviewsApi } from "../../api";
import { SkeletonCard, EmptyState, StatCard } from "../../components/ui";
import StarRating from "../../components/StarRating";
import ConfirmDialog from "../../components/ConfirmDialog";

function InitialsAvatar({ name = "", size = 28 }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--accent-dim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--accent-text)",
        fontSize: size * 0.38,
        fontWeight: 600,
        fontFamily: "DM Mono, monospace",
        flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starFilter, setStarFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Fetch all published courses, then load reviews for each
    api
      .get("/courses", { params: { limit: 200 } })
      .then(async (res) => {
        const courses = res.data?.courses || res.data || [];
        // Load reviews for all courses in parallel
        const results = await Promise.allSettled(
          courses.map((c) =>
            reviewsApi.list(c.course_id, { limit: 200 }).then((r) =>
              (r.data?.reviews || []).map((rv) => ({
                ...rv,
                course_id: c.course_id,
                course_title: c.title,
              })),
            ),
          ),
        );
        const all = results
          .filter((r) => r.status === "fulfilled")
          .flatMap((r) => r.value);
        all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setReviews(all);
      })
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (starFilter === "5" && r.rating !== 5) return false;
      if (starFilter === "4" && r.rating !== 4) return false;
      if (starFilter === "3" && r.rating !== 3) return false;
      if (starFilter === "le2" && r.rating > 2) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = r.users?.full_name?.toLowerCase().includes(q);
        const matchCourse = r.course_title?.toLowerCase().includes(q);
        const matchBody = r.body?.toLowerCase().includes(q);
        if (!matchName && !matchCourse && !matchBody) return false;
      }
      return true;
    });
  }, [reviews, starFilter, search]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";
  const pct4plus = reviews.length
    ? Math.round(
        (reviews.filter((r) => r.rating >= 4).length / reviews.length) * 100,
      )
    : 0;

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  async function handleDelete(reviewId) {
    setDeleting(true);
    try {
      await reviewsApi.delete(reviewId);
      setReviews((prev) => prev.filter((r) => r.review_id !== reviewId));
    } catch {
      // silent
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-display text-2xl"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Reviews
          </h1>
          {!loading && (
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {reviews.length} total review{reviews.length !== 1 ? "s" : ""}{" "}
              across all courses
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon="★"
          title="No reviews yet"
          description="Reviews appear once students rate courses"
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Avg Rating" value={`★ ${avgRating}`} accent />
            <StatCard label="Total Reviews" value={reviews.length} />
            <StatCard label="4★ and above" value={`${pct4plus}%`} />
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, course, or text…"
              className="input-field"
              style={{ maxWidth: 280 }}
            />
            {[
              { value: "all", label: "All" },
              { value: "5", label: "5★" },
              { value: "4", label: "4★" },
              { value: "3", label: "3★" },
              { value: "le2", label: "≤2★" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStarFilter(opt.value)}
                className="btn-ghost"
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  ...(starFilter === opt.value
                    ? {
                        background: "var(--accent-dim)",
                        color: "var(--accent-text)",
                        borderColor: "var(--accent)",
                      }
                    : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Review list */}
          <div className="card overflow-hidden">
            {filtered.length === 0 ? (
              <div
                className="px-6 py-12 text-center"
                style={{ color: "var(--text-muted)" }}
              >
                No reviews match your filters.
              </div>
            ) : (
              filtered.map((review, i) => (
                <div
                  key={review.review_id}
                  style={{
                    padding: "16px 20px",
                    borderBottom:
                      i < filtered.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <InitialsAvatar name={review.users?.full_name} size={28} />
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {review.users?.full_name || "Anonymous"}
                    </span>
                    <StarRating value={review.rating} size={14} />
                    <span
                      className="tag"
                      style={{
                        background: "var(--bg-raised)",
                        color: "var(--text-muted)",
                        fontSize: 11,
                      }}
                    >
                      {review.course_title}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        color: "var(--text-muted)",
                        fontFamily: "DM Mono, monospace",
                        fontSize: 11,
                      }}
                    >
                      {formatDate(review.created_at)}
                    </span>
                    <button
                      onClick={() => setDeleteTarget(review)}
                      className="btn-ghost"
                      style={{
                        fontSize: 11,
                        padding: "2px 10px",
                        color: "var(--error, #e07a73)",
                        borderColor: "var(--error, #e07a73)",
                        opacity: 0.8,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  {review.body && (
                    <p
                      className="text-sm"
                      style={{
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {review.body}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Remove review"
          message={`Remove the ${deleteTarget.rating}★ review by ${deleteTarget.users?.full_name || "this student"} on "${deleteTarget.course_title}"? This cannot be undone.`}
          confirmLabel={deleting ? "Removing…" : "Remove"}
          onConfirm={() => handleDelete(deleteTarget.review_id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
