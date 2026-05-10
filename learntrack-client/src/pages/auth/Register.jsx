import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Spinner, ErrorMessage } from "../../components/ui";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    role: "instructor",
    department: "",
    qualification: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.role === "instructor" && {
          department: form.department.trim() || undefined,
          qualification: form.qualification.trim() || undefined,
        }),
      });
      navigate(form.role === "student" ? "/student" : "/instructor", {
        replace: true,
      });
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 page-enter"
      style={{ background: "var(--bg-base)" }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="flex items-baseline gap-1 mb-10">
          <span
            className="font-display text-2xl italic"
            style={{ color: "var(--accent)" }}
          >
            Learn
          </span>
          <span
            className="font-display text-2xl"
            style={{ color: "var(--text-primary)" }}
          >
            Track
          </span>
        </div>

        <h1
          className="text-xl font-medium mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Create your account
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Join LearnTrack as an instructor or student
        </p>

        {/* Role selector */}
        <div className="flex gap-2 mb-6">
          {["instructor", "student"].map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role }))}
              className="flex-1 py-2 rounded text-sm font-medium transition-all duration-150"
              style={{
                background:
                  form.role === role ? "var(--accent-dim)" : "var(--bg-raised)",
                border: `1px solid ${form.role === role ? "var(--accent)" : "var(--border)"}`,
                color:
                  form.role === role
                    ? "var(--accent-text)"
                    : "var(--text-secondary)",
              }}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label">Full name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Dr. Jane Smith"
              value={form.full_name}
              onChange={set("full_name")}
              required
            />
          </div>

          {form.role === "instructor" && (
            <>
              <div>
                <label className="label">Department (optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Engineering"
                  value={form.department}
                  onChange={set("department")}
                />
              </div>
              <div>
                <label className="label">Qualification (optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. PhD Computer Science"
                  value={form.qualification}
                  onChange={set("qualification")}
                />
              </div>
            </>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="you@university.edu"
              value={form.email}
              onChange={set("email")}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={set("password")}
              required
            />
          </div>

          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={form.confirm}
              onChange={set("confirm")}
              required
            />
          </div>

          <ErrorMessage message={error} />

          <button
            type="submit"
            className="btn-primary justify-center mt-1"
            disabled={loading}
            style={{ height: 38, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <Spinner size={16} /> : `Create ${form.role} account`}
          </button>
        </form>

        <p
          className="text-sm mt-6 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            style={{ color: "var(--accent-text)" }}
            className="hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
