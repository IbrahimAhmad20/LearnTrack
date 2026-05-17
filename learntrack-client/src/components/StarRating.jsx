import { useState } from "react";

/**
 * StarRating
 *
 * Props:
 *   value       {number}   — current rating (0–5, decimals ok for display)
 *   max         {number}   — always 5
 *   interactive {boolean}  — if true, renders clickable stars
 *   onChange    {fn}       — called with new integer rating (1–5)
 *   size        {number}   — star size in px (default 16)
 *   showValue   {boolean}  — show numeric value next to stars
 *   count       {number}   — review count to show alongside (e.g. "4.2 · 128 reviews")
 */
export default function StarRating({
  value = 0,
  max = 5,
  interactive = false,
  onChange,
  size = 16,
  showValue = false,
  count,
}) {
  const [hovered, setHovered] = useState(null);

  const display = hovered ?? value;

  function Star({ index }) {
    const filled = display >= index;
    const halfFilled = !filled && display >= index - 0.5;
    const id = `half-${index}-${size}`;

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          cursor: interactive ? "pointer" : "default",
          transition: "transform 0.1s ease",
          transform:
            interactive && hovered === index ? "scale(1.2)" : "scale(1)",
          flexShrink: 0,
        }}
        onMouseEnter={interactive ? () => setHovered(index) : undefined}
        onMouseLeave={interactive ? () => setHovered(null) : undefined}
        onClick={interactive ? () => onChange?.(index) : undefined}
      >
        {halfFilled && (
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="var(--accent)" />
              <stop offset="50%" stopColor="var(--bg-hover)" />
            </linearGradient>
          </defs>
        )}
        <polygon
          points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          fill={
            filled
              ? "var(--accent)"
              : halfFilled
                ? `url(#${id})`
                : "var(--bg-hover)"
          }
          stroke={
            filled || halfFilled ? "var(--accent)" : "var(--border-light)"
          }
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: max }, (_, i) => (
          <Star key={i + 1} index={i + 1} />
        ))}
      </div>
      {(showValue || count !== undefined) && (
        <span
          style={{
            fontSize: size * 0.8,
            color: "var(--text-secondary)",
            fontFamily: "DM Mono, monospace",
            lineHeight: 1,
          }}
        >
          {showValue && value > 0 && Number(value).toFixed(1)}
          {count !== undefined && (
            <span style={{ color: "var(--text-muted)" }}>
              {showValue && value > 0 ? " · " : ""}
              {count.toLocaleString()} {count === 1 ? "review" : "reviews"}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
