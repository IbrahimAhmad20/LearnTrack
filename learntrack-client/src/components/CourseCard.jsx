import { Badge, ProgressBar } from "./ui";

const PLACEHOLDER_COLORS = [
  ["#1a2a4a", "#4f8ef7"],
  ["#1a1a3a", "#7c3aed"],
  ["#0f2a2a", "#1d9e75"],
  ["#2a1a2a", "#a855f7"],
  ["#1a2a1a", "#22c55e"],
  ["#2a1a1a", "#ef4444"],
];

function thumbnailColor(title = "") {
  const idx =
    title.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    PLACEHOLDER_COLORS.length;
  return PLACEHOLDER_COLORS[idx];
}

function CourseThumbnail({ url, title }) {
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        className="h-24 w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.nextSibling.style.display = "flex";
        }}
      />
    );
  }

  const [bg, accent] = thumbnailColor(title);
  const initial = (title || "?")[0].toUpperCase();

  return (
    <div
      className="h-24 w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: bg }}
    >
      {/* subtle grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle, ${accent}22 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      />
      {/* glow */}
      <div
        style={{
          position: "absolute",
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`,
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: "2rem",
          color: accent,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {initial}
      </span>
    </div>
  );
}

export default function CourseCard({
  title,
  instructor,
  status = "available",
  progress = 0,
  thumbnail, // legacy icon/symbol — ignored if thumbnail_url present
  thumbnail_url, // real image URL from DB
  description,
  onClick,
  action,
}) {
  const badgeType =
    status === "enrolled" || status === "published"
      ? "published"
      : status === "draft"
        ? "draft"
        : "accent";

  return (
    <div
      onClick={onClick}
      className="card text-left w-full overflow-hidden transition-transform duration-150 hover:-translate-y-0.5"
      style={{ borderColor: "var(--border-light)" }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <CourseThumbnail url={thumbnail_url} title={title} />

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-5">{title}</p>
          <Badge type={badgeType}>{status}</Badge>
        </div>
        {instructor ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {instructor}
          </p>
        ) : null}
        {description ? (
          <p
            className="text-xs line-clamp-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {description}
          </p>
        ) : null}
        <ProgressBar value={progress} max={100} />
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
