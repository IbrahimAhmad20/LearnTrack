import { useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Login.css";

/* ── Icons ── */
function IconBooks() {
  return (
    <svg
      width="13"
      height="13"
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
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}
function IconCertificate() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
function IconQuiz() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}
function IconMail() {
  return (
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function IconLock() {
  return (
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
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconEye({ off }) {
  if (off)
    return (
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
    );
  return (
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
}
function IconAlert() {
  return (
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
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
function Spinner() {
  return (
    <div
      aria-hidden
      style={{
        width: 15,
        height: 15,
        border: "2px solid rgba(14,14,15,0.25)",
        borderTopColor: "#0e0e0f",
        borderRadius: "50%",
        animation: "lg-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;
  const passwordRef = useRef(null);

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const email = form.email.trim();
    const pw = form.password;
    if (!email || !pw) {
      setError("Please fill in all fields.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, pw);
      const dest =
        user.role === "admin"
          ? "/admin"
          : user.role === "instructor"
            ? "/instructor"
            : "/student";
      navigate(from && from !== "/login" ? from : dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const pills = [
    { Icon: IconBooks, label: "Expert-led courses" },
    { Icon: IconCertificate, label: "Verified certificates" },
    { Icon: IconChart, label: "Progress tracking" },
    { Icon: IconQuiz, label: "Quizzes & assessments" },
  ];

  return (
    <>
      <div className="lg-root">
        <h1 className="sr-only">LearnTrack — Sign in</h1>

        {/* ── LEFT ── */}
        <div className="lg-left">
          <div className="lg-left-orb1"></div>
          <div className="lg-left-orb2"></div>

          <div className="lg-brand">
            LearnTrack
            <span className="lg-brand-badge">LIVE</span>
          </div>

          <div className="lg-left-body">
            <div className="lg-left-tag">
              <span className="lg-left-tag-dot"></span>
              Trusted by students worldwide
            </div>

            <h2 className="lg-left-heading">
              The place where
              <br />
              <span>learning gets done.</span>
            </h2>

            <p className="lg-left-sub">
              Connect with world-class instructors, take courses at your own
              pace, and earn certificates that actually mean something.
            </p>

            <div className="lg-perks">
              {pills.map(({ Icon, label }) => (
                <div className="lg-perk" key={label}>
                  <div className="lg-perk-icon">
                    <Icon />
                  </div>

                  <div className="lg-perk-text">{label}</div>
                </div>
              ))}
            </div>

            <div className="lg-quote">
              <p className="lg-quote-text">
                "I finished my data analysis course in 3 weeks and landed an
                internship the month after. LearnTrack made it click."
              </p>

              <p className="lg-quote-author">
                Aisha S. — Computer Science student
              </p>
            </div>
          </div>

          <div className="lg-left-footer">© 2026 LearnTrack</div>
        </div>

        {/* ── RIGHT ── */}
        <div className="lg-right">
          <div className="lg-form-wrap">
            <div>
              <div className="lg-form-heading">Welcome back.</div>
              <div className="lg-form-sub">
                Student or instructor — same door.
              </div>
            </div>

            {error && (
              <div className="lg-error">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="lg-field">
                <label htmlFor="login-email" className="lg-label">
                  Email
                </label>
                <div
                  className={`lg-input-wrap${focused === "email" ? " focused" : ""}`}
                >
                  <span className="lg-input-icon-left">
                    <IconMail />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@university.edu"
                    autoComplete="email"
                    value={form.email}
                    onChange={set("email")}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        passwordRef.current?.focus();
                      }
                    }}
                    className="lg-input"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="lg-field">
                <label htmlFor="login-password" className="lg-label">
                  Password
                </label>
                <div
                  className={`lg-input-wrap${focused === "password" ? " focused" : ""}`}
                >
                  <span className="lg-input-icon-left">
                    <IconLock />
                  </span>
                  <input
                    ref={passwordRef}
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={set("password")}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    className="lg-input has-right-icon"
                  />
                  <button
                    type="button"
                    className="lg-input-icon-right"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((v) => !v)}
                  >
                    <IconEye off={showPw} />
                  </button>
                </div>
                <button type="button" className="lg-forgot">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="lg-submit"
              >
                {loading ? <Spinner /> : "Sign in →"}
              </button>
            </form>

            <p className="lg-foot">
              New here? <Link to="/register">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
