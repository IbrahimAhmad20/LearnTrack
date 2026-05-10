import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  courses as coursesApi,
  enrollments as enrollmentsApi,
  progress as progressApi,
  activity as activityApi,
} from "../../api";
import { ProgressBar, Spinner, Badge } from "../../components/ui";

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeContent, setActiveContent] = useState(null);
  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const watchIntervalRef = useRef(null);
  const lastPercentRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    Promise.all([coursesApi.get(id), enrollmentsApi.progress(id)])
      .then(([c, p]) => {
        setCourse(c.data);
        setProgress(p.data);
        setActiveContent((c.data.content || [])[0] || null);
      })
      .catch(() => navigate("/student/courses"))
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
    const percent = Math.max(0, Math.min(100, Math.round((currentSec / durationSec) * 100)));
    if (percent >= lastPercentRef.current + 3 || percent === 100) {
      lastPercentRef.current = percent;
      progressApi.update(contentId, percent).catch(() => {});
      if (percent >= 95 && !completedRef.current) {
        completedRef.current = true;
        activityApi.log(contentId, "complete", Math.round(currentSec)).catch(() => {});
      }
    }
  };

  useEffect(() => {
    stopTracking();
    completedRef.current = false;
    lastPercentRef.current = 0;
    if (!activeContent?.content_id || !isYoutube || !youtubeId || !ytContainerRef.current)
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
                .log(activeContent.content_id, "play", Math.round(ytPlayerRef.current.getCurrentTime()))
                .catch(() => {});
              stopTracking();
              watchIntervalRef.current = window.setInterval(() => {
                const current = ytPlayerRef.current?.getCurrentTime?.() || 0;
                const duration = ytPlayerRef.current?.getDuration?.() || 0;
                pushProgress(activeContent.content_id, current, duration);
              }, 8000);
            } else if (event.data === YT.PlayerState.PAUSED) {
              activityApi
                .log(activeContent.content_id, "pause", Math.round(ytPlayerRef.current.getCurrentTime()))
                .catch(() => {});
              stopTracking();
            } else if (event.data === YT.PlayerState.ENDED) {
              stopTracking();
              pushProgress(activeContent.content_id, ytPlayerRef.current.getDuration(), ytPlayerRef.current.getDuration());
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

      <div className="card overflow-hidden mb-6">
        {content.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No content added yet.
          </div>
        ) : (
          content.map((item, i) => (
            <button
              key={item.content_id}
              onClick={() => setActiveContent(item)}
              className="flex items-center gap-4 px-5 py-3.5 w-full text-left"
              style={{
                background:
                  activeContent?.content_id === item.content_id
                    ? "var(--bg-hover)"
                    : "transparent",
                borderBottom:
                  i < content.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span
                className="text-xs"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "DM Mono, monospace",
                  minWidth: 24,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.title}
                </p>
                {item.content_type && (
                  <p
                    className="text-xs mt-0.5"
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {item.content_types?.type_name || item.content_type}
                  </p>
                )}
                {item.content_url ? (
                  <a
                    href={item.content_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs mt-1 inline-block hover:underline"
                    style={{ color: "var(--accent-text)" }}
                  >
                    Open lesson resource
                  </a>
                ) : null}
                {item.content_body ? (
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {item.content_body}
                  </p>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>

      {activeContent?.content_url ? (
        <div className="card p-4">
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
                activityApi.log(activeContent.content_id, "play", Math.round(e.currentTarget.currentTime)).catch(() => {})
              }
              onPause={(e) =>
                activityApi.log(activeContent.content_id, "pause", Math.round(e.currentTarget.currentTime)).catch(() => {})
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
    </div>
  );
}
