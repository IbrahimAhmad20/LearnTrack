import { Badge, ProgressBar } from "./ui";

export default function CourseCard({
  title,
  instructor,
  status = "available",
  progress = 0,
  thumbnail = "◈",
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
      <div
        className="h-24 flex items-center justify-center text-2xl"
        style={{ background: "var(--bg-raised)" }}
      >
        {thumbnail}
      </div>
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
          <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        ) : null}
        <ProgressBar value={progress} max={100} />
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
