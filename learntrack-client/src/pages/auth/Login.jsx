import { useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function IconBooks() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function IconCertificate() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="6" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function IconHelpSquare() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye({ off }) {
  if (off) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function BtnSpinner() {
  return (
    <div
      className="rounded-full shrink-0 animate-spin"
      style={{
        width: 15,
        height: 15,
        border: "2px solid rgba(14,14,15,0.3)",
        borderTopColor: "#0e0e0f",
      }}
      aria-hidden
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
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div
      className="min-h-[100dvh] w-full box-border flex flex-col items-stretch overflow-x-hidden overflow-y-auto lg:h-[100dvh] lg:overflow-hidden py-3 px-3 sm:py-4 sm:px-4 lg:p-0"
      style={{ background: "#0e0e0f" }}
    >
      <h1 className="sr-only">
        LearnTrack login — platform overview and sign-in form
      </h1>

      <div
        className="flex flex-col lg:flex-row w-full max-lg:max-w-[560px] max-lg:mx-auto rounded-xl lg:rounded-none overflow-hidden border lg:border-0 lg:flex-1 lg:min-h-0 flex-shrink-0 lg:shadow-none"
        style={{
          background: "#0e0e0f",
          borderColor: "#2a2a2e",
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 14,
          color: "#f0efea",
        }}
      >
        {/* Left — marketing */}
        <div
          className="flex-1 flex flex-col justify-center min-h-0 min-w-0 lg:overflow-y-auto lg:justify-center px-7 py-8 sm:px-9 sm:py-10 lg:px-14 lg:py-12 xl:px-20 lg:min-h-[100dvh]"
          style={{
            background: "#0e0e0f",
            borderColor: "#2a2a2e",
          }}
        >
          <div className="flex items-baseline gap-1 mb-6 sm:mb-8 lg:mb-10">
            <span
              className="text-xl italic font-medium"
              style={{
                color: "#e8a838",
                letterSpacing: "-0.02em",
              }}
            >
              Learn
            </span>
            <span
              className="text-xl font-medium"
              style={{ color: "#f0efea", letterSpacing: "-0.02em" }}
            >
              Track
            </span>
          </div>

          <div
            className="text-[26px] font-medium italic leading-snug mb-3.5"
            style={{ color: "#f0efea", letterSpacing: "-0.03em" }}
          >
            The place where
            <br />
            <span style={{ color: "#e8a838" }}>learning gets done.</span>
          </div>
          <p
            className="text-sm leading-relaxed mb-6 sm:mb-8 lg:mb-10 max-w-[320px] lg:max-w-md"
            style={{ color: "#9d9b94", lineHeight: 1.7 }}
          >
            LearnTrack connects students with world-class instructors. Take
            courses at your own pace, prove what you know, and earn certificates
            that actually mean something.
          </p>

          <div className="flex flex-wrap gap-2 mb-6 sm:mb-8 lg:mb-10">
            {[
              { Icon: IconBooks, label: "Expert-led courses" },
              { Icon: IconCertificate, label: "Verified certificates" },
              { Icon: IconChart, label: "Track your progress" },
              { Icon: IconHelpSquare, label: "Quizzes & assessments" },
            ].map(({ Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border"
                style={{
                  borderColor: "#2a2a2e",
                  color: "#9d9b94",
                  background: "#161618",
                }}
              >
                <span className="inline-flex shrink-0" style={{ color: "#e8a838" }}>
                  <Icon />
                </span>
                {label}
              </div>
            ))}
          </div>

          <div
            className="border-l-2 pl-4"
            style={{ borderColor: "#e8a838" }}
          >
            <p
              className="text-[13px] italic mb-2 leading-relaxed"
              style={{ color: "#9d9b94", lineHeight: 1.7 }}
            >
              &quot;I finished my data analysis course in 3 weeks and landed an
              internship the month after. LearnTrack made it click.&quot;
            </p>
            <p
              className="text-xs font-mono"
              style={{ color: "#5a5855", fontFamily: '"DM Mono", monospace' }}
            >
              Aisha S. — Computer Science student
            </p>
          </div>
        </div>

        {/* Right — form */}
        <div
          className="w-full lg:w-[min(420px,38vw)] lg:min-w-[320px] lg:max-w-[440px] flex items-center justify-center min-h-0 min-w-0 lg:overflow-y-auto lg:border-l px-7 py-8 sm:px-9 sm:py-10 lg:px-12 lg:min-h-[100dvh]"
          style={{ background: "#161618", borderColor: "#2a2a2e" }}
        >
          <div className="w-full max-w-[340px] lg:max-w-none mx-auto">
            <div
              className="text-base font-medium mb-1"
              style={{ color: "#f0efea" }}
            >
              Sign in
            </div>
            <div className="text-[13px] mb-6" style={{ color: "#5a5855" }}>
              Student or instructor — same door.
            </div>

            {error ? (
              <div
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs mb-3.5"
                style={{
                  background: "rgba(192,83,74,0.12)",
                  border: "1px solid rgba(192,83,74,0.3)",
                  color: "#e07a73",
                }}
              >
                <span className="shrink-0 inline-flex">
                  <IconAlertCircle />
                </span>
                <span>{error}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="mb-3.5">
                <label
                  htmlFor="login-email"
                  className="block text-[11px] uppercase mb-1.5 font-mono"
                  style={{
                    color: "#9d9b94",
                    letterSpacing: "0.04em",
                    fontFamily: '"DM Mono", monospace',
                  }}
                >
                  Email
                </label>
                <div className="relative">
                  <span
                    className="absolute left-[11px] top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "#5a5855" }}
                  >
                    <IconMail />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@university.edu"
                    autoComplete="email"
                    value={form.email}
                    onChange={set("email")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        passwordRef.current?.focus();
                      }
                    }}
                    className="w-full rounded-[7px] outline-none transition-colors text-[13px] focus:border-[#e8a838] focus:shadow-[0_0_0_3px_#2d2215]"
                    style={{
                      background: "#1e1e21",
                      border: "1px solid #2a2a2e",
                      padding: "9px 12px 9px 34px",
                      color: "#f0efea",
                      fontFamily: '"DM Sans", sans-serif',
                    }}
                  />
                </div>
              </div>

              <div className="mb-2">
                <label
                  htmlFor="login-password"
                  className="block text-[11px] uppercase mb-1.5 font-mono"
                  style={{
                    color: "#9d9b94",
                    letterSpacing: "0.04em",
                    fontFamily: '"DM Mono", monospace',
                  }}
                >
                  Password
                </label>
                <div className="relative">
                  <span
                    className="absolute left-[11px] top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "#5a5855" }}
                  >
                    <IconLock />
                  </span>
                  <input
                    ref={passwordRef}
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={set("password")}
                    className="w-full rounded-[7px] outline-none transition-colors text-[13px] focus:border-[#e8a838] focus:shadow-[0_0_0_3px_#2d2215]"
                    style={{
                      background: "#1e1e21",
                      border: "1px solid #2a2a2e",
                      padding: "9px 36px 9px 34px",
                      color: "#f0efea",
                      fontFamily: '"DM Sans", sans-serif',
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0 border-0 bg-transparent cursor-pointer flex"
                    style={{ color: "#5a5855" }}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <IconEye off={showPassword} />
                  </button>
                </div>
                <button
                  type="button"
                  className="block w-full text-right text-xs mt-1.5 bg-transparent border-0 cursor-pointer p-0 font-inherit"
                  style={{ color: "#5a5855" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#f5c05a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#5a5855";
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                aria-label="Sign in"
                className="w-full rounded-[7px] border-0 cursor-pointer font-medium flex items-center justify-center gap-2 mt-2 py-2.5 text-sm transition-[filter,transform] duration-150 disabled:opacity-70 hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: "#e8a838",
                  color: "#0e0e0f",
                  fontFamily: '"DM Sans", sans-serif',
                }}
              >
                {loading ? <BtnSpinner /> : <span>Sign in</span>}
              </button>
            </form>

            <p
              className="text-center text-xs mt-[18px]"
              style={{ color: "#5a5855" }}
            >
              New here?{" "}
              <Link
                to="/register"
                className="no-underline hover:underline"
                style={{ color: "#f5c05a", cursor: "pointer" }}
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
