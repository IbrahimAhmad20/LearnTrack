import { useState, useEffect, useMemo } from "react";
import { reviews as reviewsApi } from "../../api";
import { SkeletonCard, EmptyState, StatCard } from "../../components/ui";
import StarRating from "../../components/StarRating";

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

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("all");
  const [starFilter, setStarFilter] = useState("all");

  useEffect(() => {
    reviewsApi
      .instructorMine()
      .then((r) => setReviews(r.data || []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  const courses = useMemo(() => {
    const seen = new Map();
    reviews.forEach((r) => {
      if (!seen.has(r.course_id)) seen.set(r.course_id, r.course_title);
    });
    return [...seen.entries()].map(([id, title]) => ({ id, title }));
  }, [reviews]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (courseFilter !== "all" && String(r.course_id) !== courseFilter)
        return false;
      if (starFilter === "5" && r.rating !== 5) return false;
      if (starFilter === "4" && r.rating !== 4) return false;
      if (starFilter === "3" && r.rating !== 3) return false;
      if (starFilter === "le2" && r.rating > 2) return false;
      return true;
    });
  }, [reviews, courseFilter, starFilter]);

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

  return (
    <div className="p-8 page-enter">
      {/* Header */}
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
              {reviews.length} total review{reviews.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon="★"
          title="No reviews yet"
          description="Reviews appear once students complete and rate your courses"
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
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="input-field"
              style={{ maxWidth: 220 }}
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.title}
                </option>
              ))}
            </select>
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
                  {/* Reviewer row */}
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
                  </div>
                  {review.body && (
                    <p
                      className="text-sm"
                      style={{
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
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
    </div>
  );
}
