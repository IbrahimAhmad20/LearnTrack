import { useState } from "react";

/**
 * SectionAccordion
 *
 * Replaces the flat content list in CourseDetail.jsx.
 * Renders sections as expandable rows; each section expands to reveal its lessons.
 * Lessons without a section are grouped under an "Other lessons" catch-all at the bottom.
 *
 * Props:
 *   sections      {Array}  — from GET /sections/course/:id
 *                           [{ section_id, title, sort_order, content: [...] }]
 *   flatContent   {Array}  — full course.content array (used for unsectioned lessons)
 *   activeId      {number} — currently playing content_id
 *   onSelect      {fn}     — called with a content item when a lesson is clicked
 *   progressMap   {object} — { [content_id]: progress_percent } (optional)
 */
export default function SectionAccordion({
  sections = [],
  flatContent = [],
  activeId,
  onSelect,
  progressMap = {},
}) {
  // Start with first section open (or "other" if no sections)
  const firstKey = sections.length ? `s-${sections[0]?.section_id}` : "other";
  const [open, setOpen] = useState(new Set([firstKey]));

  function toggle(key) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Lessons that have no section_id — rendered at the bottom
  const sectionedIds = new Set(
    sections.flatMap((s) => s.content.map((c) => c.content_id)),
  );
  const unsectioned = flatContent.filter(
    (c) => !sectionedIds.has(c.content_id),
  );

  const allGroups = [
    ...sections.map((s) => ({
      key: `s-${s.section_id}`,
      title: s.title,
      items: s.content,
      count: s.content.length,
    })),
    ...(unsectioned.length
      ? [
          {
            key: "other",
            title: "Other lessons",
            items: unsectioned,
            count: unsectioned.length,
          },
        ]
      : []),
  ];

  if (!allGroups.length) {
    return (
      <p
        className="text-sm"
        style={{ color: "var(--text-muted)", padding: "12px 0" }}
      >
        No content yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {allGroups.map(({ key, title, items, count }) => {
        const isOpen = open.has(key);
        const doneCount = items.filter(
          (c) => (progressMap[c.content_id] || 0) >= 95,
        ).length;

        return (
          <div
            key={key}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--bg-surface)",
            }}
          >
            {/* Section header */}
            <button
              onClick={() => toggle(key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                {/* Chevron */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    transition: "transform 0.2s ease",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {title}
                </span>
              </div>

              {/* Meta: lesson count + progress */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                {doneCount > 0 && (
                  <span style={{ color: "var(--success)" }}>
                    {doneCount}/{count}
                  </span>
                )}
                <span>
                  {count} {count === 1 ? "lesson" : "lessons"}
                </span>
              </div>
            </button>

            {/* Section content */}
            {isOpen && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                }}
              >
                {items.length === 0 ? (
                  <p
                    className="text-xs px-10 py-3"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No lessons in this section yet.
                  </p>
                ) : (
                  items.map((item, idx) => {
                    const isActive = item.content_id === activeId;
                    const pct = progressMap[item.content_id] || 0;
                    const isDone = pct >= 95;
                    const typeName = item.content_types?.type_name || "video";

                    return (
                      <button
                        key={item.content_id}
                        onClick={() => onSelect?.(item)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px 10px 36px",
                          background: isActive
                            ? "var(--accent-dim)"
                            : "transparent",
                          border: "none",
                          borderTop:
                            idx > 0 ? "1px solid var(--border)" : "none",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive)
                            e.currentTarget.style.background =
                              "var(--bg-raised)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Type icon */}
                        <TypeIcon
                          type={typeName}
                          done={isDone}
                          active={isActive}
                        />

                        {/* Title + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            className="text-xs font-medium truncate"
                            style={{
                              color: isActive
                                ? "var(--accent-text)"
                                : "var(--text-primary)",
                              lineHeight: 1.4,
                            }}
                          >
                            {item.title}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginTop: 2,
                            }}
                          >
                            {item.duration_sec > 0 && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                  fontFamily: "DM Mono, monospace",
                                }}
                              >
                                {formatDuration(item.duration_sec)}
                              </span>
                            )}
                            {item.is_free_preview && !isActive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "var(--success)",
                                  fontFamily: "DM Mono, monospace",
                                }}
                              >
                                Preview
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress dot / checkmark */}
                        {isDone ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--success)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0 }}
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : pct > 0 ? (
                          <div
                            style={{
                              width: 28,
                              height: 3,
                              borderRadius: 2,
                              background: "var(--border-light)",
                              flexShrink: 0,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: "var(--accent)",
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function TypeIcon({ type, done, active }) {
  const color = done
    ? "var(--success)"
    : active
      ? "var(--accent)"
      : "var(--text-muted)";

  if (type === "document") {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
  if (type === "quiz") {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  // default: video
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function formatDuration(sec) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
