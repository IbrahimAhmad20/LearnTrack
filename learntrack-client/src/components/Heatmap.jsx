import { useState, useEffect } from "react";
import api from "../api";

/* ── helpers ── */
function toDateKey(iso) {
  return iso ? iso.slice(0, 10) : null;
}

function buildGrid() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // align end to Sunday
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0 Sun=6
  const gridEnd = new Date(today);
  gridEnd.setDate(gridEnd.getDate() - dayOfWeek + 6);

  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - 52 * 7 + 1);

  const days = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return { days, gridStart, gridEnd };
}

function monthLabels(days) {
  const labels = [];
  let lastMonth = -1;
  for (let w = 0; w < 52; w++) {
    const day = days[w * 7];
    const m = day ? day.getMonth() : -1;
    labels.push(
      m !== lastMonth ? day.toLocaleString("default", { month: "short" }) : "",
    );
    lastMonth = m;
  }
  return labels;
}

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function cellColor(count) {
  if (!count) return "var(--bg-hover)";
  if (count === 1) return "rgba(79,142,247,0.30)";
  if (count === 2) return "rgba(79,142,247,0.55)";
  if (count === 3) return "rgba(100,120,247,0.75)";
  return "rgba(124,58,237,0.90)";
}

function Tooltip({ day, count, watchMins }) {
  if (!day) return null;
  const label = day.toLocaleDateString("default", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--bg-raised)",
        border: "1px solid var(--border-light)",
        borderRadius: 6,
        padding: "5px 9px",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 10,
        fontSize: 11,
        color: "var(--text-primary)",
        lineHeight: 1.5,
      }}
    >
      <strong>{label}</strong>
      <br />
      {count === 0
        ? "No activity"
        : `${count} event${count > 1 ? "s" : ""}${watchMins ? ` · ${watchMins} min watched` : ""}`}
    </div>
  );
}

export default function Heatmap() {
  const [activityMap, setActivityMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [progressRes, attemptsRes] = await Promise.allSettled([
          api.get("/progress/me"),
          api.get("/quizzes/attempts/me"),
        ]);

        const map = {};

        const addEvent = (dateKey, watchMins = 0) => {
          if (!dateKey) return;
          if (!map[dateKey]) map[dateKey] = { count: 0, watchMins: 0 };
          map[dateKey].count += 1;
          map[dateKey].watchMins += watchMins;
        };

        if (progressRes.status === "fulfilled") {
          for (const item of progressRes.value.data || []) {
            addEvent(toDateKey(item.last_watched_at));
          }
        }

        if (attemptsRes.status === "fulfilled") {
          for (const item of attemptsRes.value.data || []) {
            addEvent(toDateKey(item.attempt_date));
          }
        }

        setActivityMap(map);
      } catch {
        // renders empty grid — not a crash
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const { days } = buildGrid();
  const months = monthLabels(days);
  const todayKey = toDateKey(new Date().toISOString());

  const totalDays = Object.keys(activityMap).length;
  const totalEvents = Object.values(activityMap).reduce(
    (s, v) => s + v.count,
    0,
  );
  const streak = (() => {
    let s = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (activityMap[toDateKey(d.toISOString())]) s++;
      else if (i > 0) break;
    }
    return s;
  })();

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Activity</h3>
        {!loading && (
          <div className="flex items-center gap-4">
            <span
              className="text-xs"
              style={{
                color: "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {totalDays}
              </span>{" "}
              active days
            </span>
            <span
              className="text-xs"
              style={{
                color: "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                {streak}
              </span>{" "}
              day streak
            </span>
            <span
              className="text-xs"
              style={{
                color: "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {totalEvents}
              </span>{" "}
              events
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 88, borderRadius: 6 }} />
      ) : (
        <div
          style={{ overflowX: "auto", overflowY: "visible", paddingBottom: 4 }}
        >
          <div style={{ display: "flex", gap: 4, minWidth: "max-content" }}>
            {/* day labels */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                paddingTop: 18,
              }}
            >
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  style={{
                    height: 11,
                    fontSize: 9,
                    lineHeight: "11px",
                    color: "var(--text-muted)",
                    fontFamily: "DM Mono, monospace",
                    textAlign: "right",
                    minWidth: 22,
                    paddingRight: 4,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* grid */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* month row */}
              <div
                style={{ display: "flex", gap: 2, marginBottom: 4, height: 14 }}
              >
                {months.map((label, wi) => (
                  <div
                    key={wi}
                    style={{
                      width: 11,
                      fontSize: 9,
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                      whiteSpace: "nowrap",
                      overflow: "visible",
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* cells */}
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: 52 }, (_, wi) => (
                  <div
                    key={wi}
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    {Array.from({ length: 7 }, (_, di) => {
                      const idx = wi * 7 + di;
                      const day = days[idx];
                      if (!day)
                        return (
                          <div key={di} style={{ width: 11, height: 11 }} />
                        );

                      const key = toDateKey(day.toISOString());
                      const info = activityMap[key] || {
                        count: 0,
                        watchMins: 0,
                      };
                      const isToday = key === todayKey;
                      const isHovered = hoveredIdx === idx;

                      return (
                        <div
                          key={di}
                          style={{ position: "relative" }}
                          onMouseEnter={() => {
                            setHovered({
                              day,
                              count: info.count,
                              watchMins: info.watchMins,
                            });
                            setHoveredIdx(idx);
                          }}
                          onMouseLeave={() => {
                            setHovered(null);
                            setHoveredIdx(null);
                          }}
                        >
                          <div
                            style={{
                              width: 11,
                              height: 11,
                              borderRadius: 2,
                              background: cellColor(info.count),
                              outline: isToday
                                ? "1.5px solid var(--accent)"
                                : isHovered
                                  ? "1px solid var(--border-light)"
                                  : "none",
                              outlineOffset: 1,
                              cursor: "default",
                            }}
                          />
                          {isHovered && (
                            <Tooltip
                              day={hovered?.day}
                              count={hovered?.count}
                              watchMins={hovered?.watchMins}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* legend */}
      <div
        className="flex items-center gap-1.5 mt-3"
        style={{ justifyContent: "flex-end" }}
      >
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)", marginRight: 4 }}
        >
          Less
        </span>
        {[0, 1, 2, 3, 4].map((v) => (
          <div
            key={v}
            style={{
              width: 11,
              height: 11,
              borderRadius: 2,
              background: cellColor(v),
            }}
          />
        ))}
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)", marginLeft: 4 }}
        >
          More
        </span>
      </div>
    </div>
  );
}
