import { useMemo, useState } from "react";

export default function DataTable({
  columns = [],
  rows = [],
  pageSize = 8,
  rowKey = "id",
}) {
  const [sortBy, setSortBy] = useState(columns[0]?.key || null);
  const [direction, setDirection] = useState("asc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortBy) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av === bv) return 0;
      if (direction === "asc") return av > bv ? 1 : -1;
      return av < bv ? 1 : -1;
    });
    return copy;
  }, [rows, sortBy, direction]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pagedRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setDirection("asc");
    }
  };

  return (
    <div className="card p-4">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className="py-2 text-left text-xs uppercase tracking-widest cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                onClick={() => toggleSort(col.key)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((row, idx) => (
            <tr key={row[rowKey] || idx} style={{ borderBottom: "1px solid var(--border)" }}>
              {columns.map((col) => (
                <td key={col.key} className="py-2">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {pagedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-6 text-center text-sm">
                No rows available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="flex justify-between items-center pt-3">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            className="btn-ghost py-1 px-2 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="btn-ghost py-1 px-2 text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
