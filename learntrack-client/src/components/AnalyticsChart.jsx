function Bars({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <div className="text-xs truncate w-28" style={{ color: "var(--text-muted)" }}>
            {row.label}
          </div>
          <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: "var(--bg-hover)" }}>
            <div
              className="h-full rounded"
              style={{
                width: `${Math.round((row.value / max) * 100)}%`,
                background: row.color || "var(--accent)",
              }}
            />
          </div>
          <div className="text-xs font-mono w-10 text-right">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function Line({ data }) {
  const width = 420;
  const height = 160;
  const pad = 12;
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const points = data.map((d, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(data.length - 1, 1);
    const y = height - pad - ((d.value - min) * (height - pad * 2)) / Math.max(max - min, 1);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        points={points.join(" ")}
      />
      {points.map((p, idx) => {
        const [cx, cy] = p.split(",");
        return <circle key={data[idx].label} cx={cx} cy={cy} r="3" fill="var(--accent)" />;
      })}
    </svg>
  );
}

export default function AnalyticsChart({ title, type = "bar", data = [] }) {
  return (
    <div className="card p-4">
      {title ? <h3 className="text-sm font-medium mb-3">{title}</h3> : null}
      {type === "line" ? <Line data={data} /> : <Bars data={data} />}
    </div>
  );
}
