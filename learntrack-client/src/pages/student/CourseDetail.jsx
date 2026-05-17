import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  courses as coursesApi,
  enrollments as enrollmentsApi,
  progress as progressApi,
  activity as activityApi,
  sections as sectionsApi,
  reviews as reviewsApi,
  transactions as transactionsApi,
} from "../../api";
import api from "../../api";
import { ProgressBar, Spinner, Badge } from "../../components/ui";
import SectionAccordion from "../../components/SectionAccordion";
import ReviewModal from "../../components/ReviewModal";
import StarRating from "../../components/StarRating";

function InitialsAvatar({ name = "", size = 32 }) {
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
        fontSize: size * 0.35,
        fontWeight: 600,
        fontFamily: "DM Mono, monospace",
        flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null);
  const [sections, setSections] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeContent, setActiveContent] = useState(null);

  // Reviews state
  const [reviewSummary, setReviewSummary] = useState(null);
  const [courseReviews, setCourseReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [myReview, setMyReview] = useState(null); // student's own review if posted

  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const watchIntervalRef = useRef(null);
  const lastPercentRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    Promise.allSettled([
      coursesApi.get(id),
      enrollmentsApi.progress(id),
      sectionsApi.byCourse(id),
      reviewsApi.summary(id),
      reviewsApi.list(id, { page: 1, limit: 20 }),
      api.get("/progress/me"),
    ])
      .then(
        ([
          courseRes,
          progressRes,
          sectionsRes,
          summaryRes,
          reviewsRes,
          allProgressRes,
        ]) => {
          if (courseRes.status === "fulfilled") {
            setCourse(courseRes.value.data);
            setActiveContent((courseRes.value.data.content || [])[0] || null);
          } else {
            navigate("/student/courses");
            return;
          }
          if (progressRes.status === "fulfilled")
            setProgress(progressRes.value.data);
          if (sectionsRes.status === "fulfilled")
            setSections(sectionsRes.value.data || []);
          if (summaryRes.status === "fulfilled")
            setReviewSummary(summaryRes.value.data);
          if (reviewsRes.status === "fulfilled") {
            const allReviews = reviewsRes.value.data?.reviews || [];
            setCourseReviews(allReviews);
            // Detect if this student already left a review
            if (currentUser?.user_id) {
              const mine = allReviews.find(
                (r) => r.users?.user_id === currentUser.user_id,
              );
              if (mine) setMyReview(mine);
            }
          }

          // Build per-content progress map
          if (allProgressRes.status === "fulfilled") {
            const allProg = allProgressRes.value.data || [];
            const courseContent = courseRes.value.data?.content || [];
            const contentIds = new Set(courseContent.map((c) => c.content_id));
            const map = {};
            allProg.forEach((p) => {
              if (contentIds.has(p.content_id)) {
                map[p.content_id] = p.progress_pct ?? p.progress_percent ?? 0;
              }
            });
            setProgressMap(map);
          }
        },
      )
      .finally(() => setLoading(false));
  }, [id]);

  const content = course?.content || [];

  const isYoutube = useMemo(() => {
    const url = activeContent?.content_url || "";
    return /youtube\.com|youtu\.be/.test(url);
  }, [activeContent]);

  const youtubeId = useMemo(() => {
    if (!activeContent?.content_url) return null;
    const url = activeContent.content_url;
    const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
    if (short) return short[1];
    const normal = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (normal) return normal[1];
    const embed = url.match(/embed\/([a-zA-Z0-9_-]{6,})/);
    return embed ? embed[1] : null;
  }, [activeContent]);

  const stopTracking = () => {
    if (watchIntervalRef.current) {
      window.clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = null;
    }
  };

  const pushProgress = async (contentId, currentSec, durationSec) => {
    if (!durationSec || !contentId) return;
    const percent = Math.max(
      0,
      Math.min(100, Math.round((currentSec / durationSec) * 100)),
    );
    if (percent >= lastPercentRef.current + 3 || percent === 100) {
      lastPercentRef.current = percent;
      progressApi.update(contentId, percent).catch(() => {});
      if (percent >= 95 && !completedRef.current) {
        completedRef.current = true;
        activityApi
          .log(contentId, "complete", Math.round(currentSec))
          .catch(() => {});
      }
    }
  };

  useEffect(() => {
    stopTracking();
    completedRef.current = false;
    lastPercentRef.current = 0;
    if (
      !activeContent?.content_id ||
      !isYoutube ||
      !youtubeId ||
      !ytContainerRef.current
    )
      return;

    const setup = () => {
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (event) => {
            const YT = window.YT;
            if (!YT || !ytPlayerRef.current) return;
            if (event.data === YT.PlayerState.PLAYING) {
              activityApi
                .log(
                  activeContent.content_id,
                  "play",
                  Math.round(ytPlayerRef.current.getCurrentTime()),
                )
                .catch(() => {});
              stopTracking();
              watchIntervalRef.current = window.setInterval(() => {
                const current = ytPlayerRef.current?.getCurrentTime?.() || 0;
                const duration = ytPlayerRef.current?.getDuration?.() || 0;
                pushProgress(activeContent.content_id, current, duration);
              }, 8000);
            } else if (event.data === YT.PlayerState.PAUSED) {
              activityApi
                .log(
                  activeContent.content_id,
                  "pause",
                  Math.round(ytPlayerRef.current.getCurrentTime()),
                )
                .catch(() => {});
              stopTracking();
            } else if (event.data === YT.PlayerState.ENDED) {
              stopTracking();
              pushProgress(
                activeContent.content_id,
                ytPlayerRef.current.getDuration(),
                ytPlayerRef.current.getDuration(),
              );
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      setup();
    } else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        setup();
      };
    }

    return () => {
      stopTracking();
      ytPlayerRef.current?.destroy?.();
      ytPlayerRef.current = null;
    };
  }, [activeContent, isYoutube, youtubeId]);

  const isEnrolled = !!progress;
  const progressPct = progress?.progress_pct || 0;
  // Allow review once enrolled (any progress). Previously required 95% which
  // locked out most students who hadn't finished the course.
  const canReview = isEnrolled;

  // ── Payment ──────────────────────────────────────────────────────────────
  const [buying, setBuying] = useState(false);
  const effectivePrice = course
    ? Number(course.discounted_price ?? course.price ?? 0)
    : 0;
  const isFree = effectivePrice === 0;

  async function handleBuyOrEnroll() {
    if (buying) return;
    setBuying(true);
    try {
      const res = await transactionsApi.initiate(Number(id));
      if (res.data.free) {
        // Free course — already enrolled by backend
        window.location.reload();
      } else {
        // Paid — open Safepay in new tab, go to polling page in this tab
        window.open(res.data.checkout_url, "_blank");
        window.location.href = `/payment/success?txId=${res.data.tx_id}`;
      }
    } catch (err) {
      const msg =
        err.response?.data?.error || "Something went wrong. Please try again.";
      alert(msg);
    } finally {
      setBuying(false);
    }
  }

  const histogramTotal = reviewSummary
    ? Object.values(reviewSummary.distribution || {}).reduce((s, v) => s + v, 0)
    : 0;

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  if (!course) return null;

  return (
    <div className="p-8 max-w-3xl page-enter">
      <button
        onClick={() => navigate("/student/courses")}
        className="flex items-center gap-2 text-sm mb-6"
        style={{ color: "var(--text-muted)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to courses
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1
            className="font-display text-2xl"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            {course.title}
          </h1>
          <Badge type="published">live</Badge>
        </div>
        {course.category && (
          <p
            className="text-xs mb-3"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            {course.category}
          </p>
        )}
        {course.description && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {course.description}
          </p>
        )}
      </div>

      {/* Price / Enroll / Buy card */}
      {!isEnrolled && (
        <div className="card p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            {isFree ? (
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Free
              </span>
            ) : (
              <div className="flex items-center gap-2">
                {course.discounted_price &&
                  course.discounted_price < course.price && (
                    <span
                      className="text-xs line-through"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "DM Mono, monospace",
                      }}
                    >
                      PKR {Number(course.price).toLocaleString()}
                    </span>
                  )}
                <span
                  className="text-lg font-semibold"
                  style={{
                    color: "var(--accent-text)",
                    fontFamily: "DM Mono, monospace",
                  }}
                >
                  PKR {effectivePrice.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleBuyOrEnroll}
            disabled={buying}
            className="btn-primary"
            style={{ minWidth: 140, opacity: buying ? 0.7 : 1 }}
          >
            {buying
              ? "Please wait…"
              : isFree
                ? "Enroll for free"
                : `Buy — PKR ${effectivePrice.toLocaleString()}`}
          </button>
        </div>
      )}

      {progress !== null && (
        <div className="card p-4 mb-6">
          <ProgressBar
            value={progress.progress_pct || 0}
            max={100}
            label="Your progress"
          />
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
          Course content
        </h2>
      </div>

      {/* Section Accordion */}
      <div className="card overflow-hidden mb-6">
        {content.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No content added yet.
          </div>
        ) : (
          <SectionAccordion
            sections={sections}
            flatContent={content}
            activeId={activeContent?.content_id}
            onSelect={(item) => setActiveContent(item)}
            progressMap={progressMap}
          />
        )}
      </div>

      {/* Video player */}
      {activeContent?.content_url ? (
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-medium mb-3">{activeContent.title}</h3>
          {isYoutube && youtubeId ? (
            <div
              ref={ytContainerRef}
              className="w-full"
              style={{ aspectRatio: "16 / 9", background: "var(--bg-raised)" }}
            />
          ) : /\.(mp4|webm|ogg)(\?|$)/i.test(activeContent.content_url) ? (
            <video
              controls
              src={activeContent.content_url}
              className="w-full rounded"
              onPlay={(e) =>
                activityApi
                  .log(
                    activeContent.content_id,
                    "play",
                    Math.round(e.currentTarget.currentTime),
                  )
                  .catch(() => {})
              }
              onPause={(e) =>
                activityApi
                  .log(
                    activeContent.content_id,
                    "pause",
                    Math.round(e.currentTarget.currentTime),
                  )
                  .catch(() => {})
              }
              onTimeUpdate={(e) =>
                pushProgress(
                  activeContent.content_id,
                  e.currentTarget.currentTime,
                  e.currentTarget.duration,
                )
              }
              onEnded={(e) =>
                pushProgress(
                  activeContent.content_id,
                  e.currentTarget.duration,
                  e.currentTarget.duration,
                )
              }
            />
          ) : (
            <a
              href={activeContent.content_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Open content URL
            </a>
          )}
        </div>
      ) : null}

      {/* Reviews section */}
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          Reviews
        </h2>
        {canReview && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="btn-ghost"
            style={{ fontSize: 12 }}
          >
            {myReview ? "Edit your review" : "Write a review"}
          </button>
        )}
      </div>

      <div className="card p-5 mb-6">
        {reviewSummary && reviewSummary.review_count > 0 ? (
          <>
            {/* Summary row */}
            <div className="flex items-center gap-4 mb-5">
              <span
                className="font-display text-3xl"
                style={{
                  color: "var(--accent-text)",
                  letterSpacing: "-0.02em",
                }}
              >
                ★ {Number(reviewSummary.avg_rating || 0).toFixed(1)}
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {reviewSummary.review_count || 0} review
                {reviewSummary.review_count !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Histogram */}
            {reviewSummary.distribution && (
              <div className="flex flex-col gap-2 mb-6">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewSummary.distribution[star] || 0;
                  const barPct = histogramTotal
                    ? (count / histogramTotal) * 100
                    : 0;
                  return (
                    <div
                      key={star}
                      className="flex items-center gap-3"
                      style={{ fontSize: 12 }}
                    >
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontFamily: "DM Mono, monospace",
                          width: 20,
                          textAlign: "right",
                        }}
                      >
                        {star}★
                      </span>
                      <div className="flex-1 relative" style={{ height: 6 }}>
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
                            width: `${barPct}%`,
                            background: "var(--accent)",
                            borderRadius: 99,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontFamily: "DM Mono, monospace",
                          width: 28,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            {isEnrolled
              ? "No reviews yet. Be the first to review this course!"
              : "No reviews yet."}
          </p>
        )}

        {/* Review cards */}
        {courseReviews.length > 0 && (
          <div className="flex flex-col gap-4">
            {courseReviews.slice(0, 5).map((review) => (
              <div
                key={review.review_id}
                style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <InitialsAvatar name={review.users?.full_name} size={28} />
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {review.users?.full_name || "Student"}
                  </span>
                  <StarRating value={review.rating} size={13} />
                  {myReview?.review_id === review.review_id && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--accent-dim)",
                        color: "var(--accent-text)",
                        fontFamily: "DM Mono, monospace",
                      }}
                    >
                      your review
                    </span>
                  )}
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
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {review.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showReviewModal && (
        <ReviewModal
          courseId={id}
          courseTitle={course?.title}
          existing={myReview}
          onClose={() => setShowReviewModal(false)}
          onSubmit={({ rating, body }) => {
            setShowReviewModal(false);
            // Refresh summary + list, and update myReview
            Promise.all([
              reviewsApi.summary(id),
              reviewsApi.list(id, { page: 1, limit: 10 }),
            ])
              .then(([s, r]) => {
                setReviewSummary(s.data);
                const reviews = r.data?.reviews || [];
                setCourseReviews(reviews);
                // Try to find own review in the refreshed list
                // (ReviewModal just submitted so it will be there)
                const posted = reviews.find((rv) =>
                  myReview
                    ? rv.review_id === myReview.review_id
                    : rv.rating === rating && rv.body === (body || null),
                );
                if (posted) setMyReview(posted);
              })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
