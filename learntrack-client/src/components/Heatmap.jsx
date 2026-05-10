export default function Heatmap({ values = [] }) {
  const normalized =
    values.length > 0
      ? values
      : Array.from({ length: 52 }, () => Math.floor(Math.random() * 5));

  const tone = (value) => {
    if (value <= 0) return "var(--bg-hover)";
    if (value === 1) return "#58452a";
    if (value === 2) return "#7a5f35";
    if (value === 3) return "#a07b3f";
    return "var(--accent)";
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium mb-3">Activity Heatmap</h3>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(26, minmax(0, 1fr))" }}
      >
        {normalized.map((value, idx) => (
          <div
            key={idx}
            className="h-3 rounded-sm"
            style={{ background: tone(value) }}
            title={`Intensity ${value}`}
          />
        ))}
      </div>
    </div>
  );
}
