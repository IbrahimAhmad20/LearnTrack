import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../../components/ui";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    role: "student",
    department: "",
    qualification: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

  const roles = [
    {
      id: "student",
      label: "Student",
      desc: "Browse & enroll in courses",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      ),
    },
    {
      id: "instructor",
      label: "Instructor",
      desc: "Create & manage courses",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8M8 11h5" />
        </svg>
      ),
    },
  ];

  const EyeIcon = ({ off }) =>
    off ? (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ) : (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );

  const perks = [
    { icon: "📖", text: "Access 100+ expert-built courses" },
    { icon: "🏆", text: "Earn verifiable certificates" },
    { icon: "📈", text: "Track progress with real-time analytics" },
    { icon: "🧠", text: "Practice with adaptive quizzes" },
  ];

  return (
    <>
      <style>{`
        .rg-root {
          min-height: 100dvh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: var(--bg-base);
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Left panel ── */
        .rg-left {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          background: linear-gradient(145deg, #0d0f18 0%, #111827 60%, #0f1320 100%);
          border-right: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .rg-left-orb1 {
          position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
          width: 380px; height: 380px;
          background: rgba(79,142,247,0.12);
          top: -80px; right: -80px;
        }
        .rg-left-orb2 {
          position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
          width: 300px; height: 300px;
          background: rgba(124,58,237,0.1);
          bottom: 40px; left: -60px;
        }
        .rg-brand {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.3rem;
          letter-spacing: -0.02em; color: #f0f2f5; text-decoration: none;
          position: relative; z-index: 1;
        }
        .rg-brand-badge {
          background: linear-gradient(135deg,#4f8ef7,#7c3aed);
          color: white; font-size: 0.62rem; font-weight: 700;
          padding: 2px 7px; border-radius: 20px; letter-spacing: 0.04em;
        }
        .rg-left-body { position: relative; z-index: 1; }
        .rg-left-tag {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(79,142,247,0.1); color: #7eb3ff;
          border: 1px solid rgba(79,142,247,0.2);
          padding: 5px 12px; border-radius: 30px;
          font-size: 0.75rem; font-weight: 500;
          margin-bottom: 24px;
        }
        .rg-left-tag-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4f8ef7;
          animation: rg-pulse 2s ease-in-out infinite;
        }
        @keyframes rg-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(0.65); }
        }
        .rg-left-heading {
          font-family: 'Syne', sans-serif; font-size: 2.4rem; font-weight: 800;
          line-height: 1.15; letter-spacing: -0.03em; color: #f0f2f5;
          margin-bottom: 16px;
        }
        .rg-left-heading span {
          background: linear-gradient(135deg,#4f8ef7,#7c3aed);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .rg-left-sub {
          font-size: 0.92rem; color: #8a9ab5; font-weight: 300;
          line-height: 1.7; margin-bottom: 40px; max-width: 340px;
        }
        .rg-perks { display: flex; flex-direction: column; gap: 14px; }
        .rg-perk {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
        }
        .rg-perk-icon {
          font-size: 1.1rem; width: 36px; height: 36px;
          border-radius: 8px; background: rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .rg-perk-text { font-size: 0.85rem; color: #8a9ab5; font-weight: 300; }
        .rg-left-footer {
          font-size: 0.75rem; color: rgba(255,255,255,0.2);
          position: relative; z-index: 1;
        }

        /* ── Right panel ── */
        .rg-right {
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          padding: 48px 56px;
          overflow-y: auto;
        }
        .rg-form-wrap { width: 100%; max-width: 400px; }

        .rg-top-link {
          font-size: 0.82rem; color: var(--text-secondary);
          margin-bottom: 36px; text-align: right;
        }
        .rg-top-link a { color: #4f8ef7; text-decoration: none; font-weight: 500; }
        .rg-top-link a:hover { text-decoration: underline; }

        .rg-heading {
          font-family: 'Syne', sans-serif; font-size: 1.75rem; font-weight: 800;
          letter-spacing: -0.03em; color: var(--text-primary);
          margin-bottom: 6px; line-height: 1.2;
        }
        .rg-sub {
          font-size: 0.875rem; color: var(--text-secondary);
          font-weight: 300; margin-bottom: 28px;
        }

        /* ── Role selector ── */
        .rg-role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
        .rg-role-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-raised);
          cursor: pointer; transition: all 0.2s;
          text-align: left;
        }
        .rg-role-btn:hover { border-color: var(--border-light); }
        .rg-role-btn.active {
          border-color: #4f8ef7;
          background: rgba(79,142,247,0.08);
        }
        .rg-role-icon {
          width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg-hover); color: var(--text-secondary);
          transition: all 0.2s;
        }
        .rg-role-btn.active .rg-role-icon {
          background: rgba(79,142,247,0.15); color: #4f8ef7;
        }
        .rg-role-label {
          font-size: 0.82rem; font-weight: 500; color: var(--text-primary);
          margin-bottom: 1px;
        }
        .rg-role-desc { font-size: 0.72rem; color: var(--text-secondary); font-weight: 300; }

        /* ── Divider ── */
        .rg-divider {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 20px;
        }
        .rg-divider-line { flex: 1; height: 1px; background: var(--border); }
        .rg-divider-text { font-size: 0.72rem; color: var(--text-muted); font-family: 'DM Mono', monospace; letter-spacing: 0.06em; }

        /* ── Fields ── */
        .rg-fields { display: flex; flex-direction: column; gap: 14px; }
        .rg-field { display: flex; flex-direction: column; gap: 5px; }
        .rg-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em;
          color: var(--text-secondary); font-family: 'Fraunces', serif;
          text-transform: uppercase;
        }
        .rg-input-wrap { position: relative; }
        .rg-input {
          width: 100%; padding: 10px 14px; border-radius: 8px;
          background: var(--bg-raised); border: 1px solid var(--border);
          color: var(--text-primary); font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .rg-input::placeholder { color: var(--text-muted); }
        .rg-input:focus {
          border-color: #4f8ef7;
          box-shadow: 0 0 0 3px rgba(79,142,247,0.12);
        }
        .rg-input-icon {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          color: var(--text-muted); cursor: pointer;
          background: none; border: none; padding: 2px;
          display: flex; align-items: center;
          transition: color 0.15s;
        }
        .rg-input-icon:hover { color: var(--text-primary); }
        .rg-input.has-icon { padding-right: 36px; }

        /* ── Two-col row ── */
        .rg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        /* ── Error ── */
        .rg-error {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px; border-radius: 8px;
          background: rgba(192,83,74,0.08);
          border: 1px solid rgba(192,83,74,0.25);
          font-size: 0.8rem; color: #e07a73;
        }

        /* ── Submit ── */
        .rg-submit {
          width: 100%; padding: 12px;
          border-radius: 10px; border: none;
          background: linear-gradient(135deg,#4f8ef7,#7c3aed);
          color: white; font-family: 'Syne', sans-serif;
          font-size: 0.9rem; font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 6px;
        }
        .rg-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .rg-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .rg-signin {
          text-align: center; font-size: 0.82rem;
          color: var(--text-muted); margin-top: 20px;
        }
        .rg-signin a { color: #4f8ef7; text-decoration: none; font-weight: 500; }
        .rg-signin a:hover { text-decoration: underline; }

        /* ── Optional badge ── */
        .rg-optional {
          display: inline-block; font-size: 0.65rem; font-weight: 400;
          color: var(--text-muted); font-family: 'DM Mono', monospace;
          margin-left: 6px; letter-spacing: 0.04em; text-transform: none;
          vertical-align: middle;
        }

        /* ── Responsive ── */
        @media (max-width: 820px) {
          .rg-root { grid-template-columns: 1fr; }
          .rg-left { display: none; }
          .rg-right { padding: 32px 24px; }
        }
      `}</style>

      <div className="rg-root page-enter">
        {/* ══ LEFT PANEL ══ */}
        <div className="rg-left">
          <div className="rg-left-orb1" />
          <div className="rg-left-orb2" />

          <Link to="/" className="rg-brand">
            LearnTrack <span className="rg-brand-badge">v2</span>
          </Link>

          <div className="rg-left-body">
            <div className="rg-left-tag">
              <div className="rg-left-tag-dot" />
              Start learning today
            </div>
            <h2 className="rg-left-heading">
              Your learning
              <br />
              journey starts
              <br />
              <span>here.</span>
            </h2>
            <p className="rg-left-sub">
              Join thousands of students and instructors on LearnTrack — built
              for real learning, not just certificates.
            </p>
            <div className="rg-perks">
              {perks.map(({ icon, text }) => (
                <div className="rg-perk" key={text}>
                  <div className="rg-perk-icon">{icon}</div>
                  <span className="rg-perk-text">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rg-left-footer">
            LearnTrack v2 · DBMS Project · 2026
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="rg-right">
          <div className="rg-form-wrap">
            <div className="rg-top-link">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>

            <h1 className="rg-heading">Create account</h1>
            <p className="rg-sub">Choose your role to get started</p>

            {/* Role selector */}
            <div className="rg-role-grid">
              {roles.map(({ id, label, desc, icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`rg-role-btn${form.role === id ? " active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, role: id }))}
                >
                  <div className="rg-role-icon">{icon}</div>
                  <div>
                    <div className="rg-role-label">{label}</div>
                    <div className="rg-role-desc">{desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="rg-divider">
              <div className="rg-divider-line" />
              <span className="rg-divider-text">FILL IN YOUR DETAILS</span>
              <div className="rg-divider-line" />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="rg-fields">
                {/* Full name */}
                <div className="rg-field">
                  <label className="rg-label">Full name</label>
                  <div className="rg-input-wrap">
                    <input
                      type="text"
                      className="rg-input"
                      placeholder="Dr. Jane Smith"
                      value={form.full_name}
                      onChange={set("full_name")}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Instructor-only fields */}
                {form.role === "instructor" && (
                  <div className="rg-row">
                    <div className="rg-field">
                      <label className="rg-label">
                        Department
                        <span className="rg-optional">optional</span>
                      </label>
                      <input
                        type="text"
                        className="rg-input"
                        placeholder="Engineering"
                        value={form.department}
                        onChange={set("department")}
                      />
                    </div>
                    <div className="rg-field">
                      <label className="rg-label">
                        Qualification
                        <span className="rg-optional">optional</span>
                      </label>
                      <input
                        type="text"
                        className="rg-input"
                        placeholder="PhD CS"
                        value={form.qualification}
                        onChange={set("qualification")}
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="rg-field">
                  <label className="rg-label">Email address</label>
                  <div className="rg-input-wrap">
                    <input
                      type="email"
                      className="rg-input"
                      placeholder="you@university.edu"
                      value={form.email}
                      onChange={set("email")}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Passwords */}
                <div className="rg-row">
                  <div className="rg-field">
                    <label className="rg-label">Password</label>
                    <div className="rg-input-wrap">
                      <input
                        type={showPass ? "text" : "password"}
                        className="rg-input has-icon"
                        placeholder="Min 8 chars"
                        value={form.password}
                        onChange={set("password")}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="rg-input-icon"
                        onClick={() => setShowPass((v) => !v)}
                        aria-label={
                          showPass ? "Hide password" : "Show password"
                        }
                      >
                        <EyeIcon off={showPass} />
                      </button>
                    </div>
                  </div>
                  <div className="rg-field">
                    <label className="rg-label">Confirm</label>
                    <div className="rg-input-wrap">
                      <input
                        type={showConfirm ? "text" : "password"}
                        className="rg-input has-icon"
                        placeholder="••••••••"
                        value={form.confirm}
                        onChange={set("confirm")}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="rg-input-icon"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={
                          showConfirm ? "Hide password" : "Show password"
                        }
                      >
                        <EyeIcon off={showConfirm} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="rg-error">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button type="submit" className="rg-submit" disabled={loading}>
                  {loading ? (
                    <Spinner size={16} />
                  ) : (
                    <>
                      Create {form.role} account
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="rg-signin">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
