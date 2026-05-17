import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { transactions as transactionsApi } from "../api";
import { Spinner } from "../components/ui";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("polling"); // polling | success | error
  const [courseId, setCourseId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [attempts, setAttempts] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // ── Case 1: Backend callback already verified (tunnel/webhook worked) ─────
    if (searchParams.get("verified") === "1") {
      const cid = searchParams.get("courseId");
      if (cid) setCourseId(Number(cid));
      setStatus("success");
      return;
    }

    // ── Case 2: Error passed from callback ────────────────────────────────────
    if (searchParams.get("error")) {
      setErrorMsg(`Payment error: ${searchParams.get("error")}`);
      setStatus("error");
      return;
    }

    // ── Case 3: Poll mode — txId in URL, check status every 3s ───────────────
    // Frontend redirects here with ?txId=XX after opening Safepay checkout.
    // We poll until Safepay confirms payment, then enroll + show success.
    const txId = searchParams.get("txId");
    if (!txId) {
      setErrorMsg("Missing transaction ID. Please contact support.");
      setStatus("error");
      return;
    }

    const MAX_ATTEMPTS = 40; // 40 × 3s = 2 minutes max

    const poll = async () => {
      try {
        const res = await transactionsApi.status(txId);
        const { status: txStatus, course_id } = res.data;

        setAttempts((a) => a + 1);

        if (txStatus === "completed") {
          clearInterval(intervalRef.current);
          setCourseId(course_id);
          setStatus("success");
          return;
        }

        if (txStatus === "failed") {
          clearInterval(intervalRef.current);
          setErrorMsg("Payment was not completed. Please try again.");
          setStatus("error");
          return;
        }

        // Still pending — keep polling unless we've hit the limit
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(intervalRef.current);
          setErrorMsg(
            "Payment confirmation timed out. If you were charged, please contact support — your enrollment will be activated manually.",
          );
          setStatus("error");
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    };

    poll(); // immediate first check
    intervalRef.current = setInterval(poll, 3000);
    return () => clearInterval(intervalRef.current);
  }, [searchParams]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="card p-10 max-w-md w-full text-center">
        {status === "polling" && (
          <>
            <Spinner />
            <h2
              className="mt-4 font-display text-xl"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Confirming your payment…
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Complete the payment in the Safepay window, then come back here.
              This page will update automatically.
            </p>
            <div
              className="mt-4 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Checking every 3 seconds…
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--accent-dim)" }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-text)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1
              className="font-display text-2xl mb-2"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Payment successful
            </h1>
            <p
              className="text-sm mb-8"
              style={{ color: "var(--text-secondary)" }}
            >
              You're enrolled! Start learning right away.
            </p>
            <button
              onClick={() =>
                navigate(
                  courseId
                    ? `/student/courses/${courseId}`
                    : "/student/courses",
                )
              }
              className="btn-primary w-full"
            >
              Go to course
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "#fee2e2" }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1
              className="font-display text-2xl mb-2"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Payment error
            </h1>
            <p
              className="text-sm mb-8"
              style={{ color: "var(--text-secondary)" }}
            >
              {errorMsg}
            </p>
            <button
              onClick={() => navigate("/student/courses")}
              className="btn-ghost w-full"
            >
              Back to courses
            </button>
          </>
        )}
      </div>
    </div>
  );
}
