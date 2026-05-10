import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { analytics } from "../../api";
import { StatCard, SkeletonCard } from "../../components/ui";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, courses: 0, active: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics
      .adminDashboard()
      .then((r) => {
        const d = r.data || {};
        setStats({
          users: d.total_users ?? 0,
          courses: d.total_courses ?? 0,
          active: d.active_students ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-4xl page-enter">
      <div className="mb-8">
        <h1
          className="font-display text-3xl mb-1"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Admin{" "}
          <span className="italic" style={{ color: "var(--accent)" }}>
            overview
          </span>
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Platform-wide health and activity.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Total users"
          value={loading ? "—" : stats.users}
          sub="registered"
        />
        <StatCard
          label="Total courses"
          value={loading ? "—" : stats.courses}
          sub="all instructors"
          accent
        />
        <StatCard
          label="Active students"
          value={loading ? "—" : stats.active}
          sub="with watch activity"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          {
            to: "/admin/users",
            label: "Manage users",
            desc: "Activate, deactivate, delete accounts",
          },
          {
            to: "/admin/courses",
            label: "All courses",
            desc: "Browse and delete any course",
          },
          {
            to: "/admin/analytics",
            label: "Analytics",
            desc: "Platform-wide engagement data",
          },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card p-5 flex flex-col gap-1 transition-colors duration-150"
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--border-light)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          >
            <p
              className="font-medium text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              {item.label}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {item.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
