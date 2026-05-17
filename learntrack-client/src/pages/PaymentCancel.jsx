import { useNavigate } from "react-router-dom";

export default function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="card p-10 max-w-md w-full text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "var(--bg-raised)" }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </div>
        <h1
          className="font-display text-2xl mb-2"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Payment cancelled
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          No charge was made. You can go back and try again whenever you're
          ready.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="btn-primary w-full mb-3"
        >
          Go back
        </button>
        <button
          onClick={() => navigate("/student/courses")}
          className="btn-ghost w-full"
        >
          Browse courses
        </button>
      </div>
    </div>
  );
}
