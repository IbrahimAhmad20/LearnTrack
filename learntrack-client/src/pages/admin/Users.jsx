import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { admin as adminApi } from "../../api";
import { Badge, Spinner, EmptyState, SkeletonCard } from "../../components/ui";
import { ConfirmDialog, DataTable, useToast } from "../../components";

export default function AdminUsers() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .users()
      .then((r) => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  const toggleStatus = async (user) => {
    setToggling(user.user_id);
    try {
      await adminApi.updateUserStatus(user.user_id, !user.is_active);
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === user.user_id ? { ...u, is_active: !u.is_active } : u,
        ),
      );
    } catch (err) {
      showToast(
        err.response?.data?.error || "Could not update user status",
        "error",
      );
    } finally {
      setToggling(null);
    }
  };

  const requestDeleteUser = (user) => {
    setDeleteTarget(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    const userId = deleteTarget.user_id;
    setDeleting(userId);
    try {
      await adminApi.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      showToast("User removed", "success");
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err.response?.data?.error || "Could not delete user",
        "error",
      );
    } finally {
      setDeleting(null);
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-8 page-enter">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => {
          if (v) return;
          if (deleting) return;
          setDeleteTarget(null);
        }}
        title="Delete user?"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.full_name || "this user"} (${deleteTarget.email})? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        confirmLoading={Boolean(deleting && deleteTarget)}
        onConfirm={confirmDeleteUser}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Users
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {users.length} total accounts
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          className="input-field"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            const sp = new URLSearchParams(searchParams);
            if (!next) sp.delete("q");
            else sp.set("q", next);
            setSearchParams(sp, { replace: true });
          }}
          style={{ maxWidth: 280 }}
        />
        <div
          className="flex gap-1 p-0.5 rounded"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
          }}
        >
          {["all", "student", "instructor", "admin"].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className="px-3 py-1.5 rounded text-xs transition-all duration-150"
              style={{
                background:
                  filterRole === r ? "var(--bg-hover)" : "transparent",
                color:
                  filterRole === r
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card p-3 flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="◉"
            title="No users found"
            description="Try adjusting your search or filter"
          />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: "full_name", label: "Name" },
            { key: "email", label: "Email" },
            {
              key: "role",
              label: "Role",
              render: (value) => (
                <Badge type={value === "admin" ? "accent" : "default"}>{value}</Badge>
              ),
            },
            {
              key: "is_active",
              label: "Status",
              render: (value) => (
                <Badge type={value ? "published" : "draft"}>
                  {value ? "active" : "inactive"}
                </Badge>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (_, row) => (
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleStatus(row)}
                    disabled={toggling === row.user_id}
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    {toggling === row.user_id ? (
                      <Spinner size={12} />
                    ) : row.is_active ? (
                      "Deactivate"
                    ) : (
                      "Activate"
                    )}
                  </button>
                  <button
                    onClick={() => requestDeleteUser(row)}
                    disabled={deleting === row.user_id}
                    className="btn-ghost text-xs py-1 px-2"
                    style={{ color: "var(--danger)" }}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
          rowKey="user_id"
          pageSize={10}
        />
      )}
    </div>
  );
}
