import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { certificates as certificatesApi } from "../api";

function Spinner() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2a10 10 0 0 1 0 20" />
    </svg>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function CertificateVerify() {
  const { hash } = useParams();
  const [state, setState] = useState("loading"); // loading | valid | invalid
  const [cert, setCert] = useState(null);

  useEffect(() => {
    if (!hash) {
      setState("invalid");
      return;
    }
    certificatesApi
      .verify(hash)
      .then((r) => {
        const data = r.data;
        if (data?.valid) {
          setCert(data);
          setState("valid");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, [hash]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <style>{`
        :root {
          --bg-base: #0b0d10;
          --bg-surface: #13161c;
          --bg-raised: #1c2028;
          --border: rgba(255,255,255,0.07);
          --text-primary: #f0f2f5;
          --text-secondary: #8a9ab5;
          --text-muted: #4a5568;
          --accent: #4f8ef7;
          --accent-text: #7eb3ff;
          --accent-dim: rgba(79,142,247,0.12);
          --success: #1d9e75;
          --danger: #c0534a;
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: "DM Sans", sans-serif; background: var(--bg-base); color: var(--text-primary); }
      `}</style>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "48px 40px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}
      >
        {state === "loading" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Spinner />
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              Verifying certificate…
            </p>
          </div>
        )}

        {state === "valid" && cert && (
          <>
            {/* Green checkmark */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(29,158,117,0.15)",
                border: "2px solid rgba(29,158,117,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1d9e75"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 11,
                color: "#1d9e75",
                letterSpacing: "0.1em",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Certificate Verified ✓
            </p>

            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: "0 0 6px",
                fontFamily: "Syne, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {cert.holder_name}
            </h1>

            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              successfully completed
            </p>

            <p
              style={{
                color: "var(--accent-text)",
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              {cert.course}
            </p>

            <div
              style={{
                background: "var(--bg-raised)",
                borderRadius: 8,
                padding: "10px 16px",
                display: "inline-block",
                marginBottom: 28,
              }}
            >
              <span
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Issued {formatDate(cert.issued_at)}
              </span>
            </div>

            <div>
              <Link
                to="/"
                style={{
                  color: "var(--accent-text)",
                  fontSize: 13,
                  textDecoration: "none",
                  borderBottom: "1px solid var(--accent)",
                  paddingBottom: 1,
                }}
              >
                ← Back to LearnTrack
              </Link>
            </div>
          </>
        )}

        {state === "invalid" && (
          <>
            {/* Red X */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(192,83,74,0.12)",
                border: "2px solid rgba(192,83,74,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#c0534a"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>

            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 11,
                color: "#c0534a",
                letterSpacing: "0.1em",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Not Found
            </p>

            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: "0 0 12px",
                fontFamily: "Syne, sans-serif",
              }}
            >
              Certificate Not Found
            </h1>

            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 14,
                lineHeight: 1.6,
                marginBottom: 28,
                maxWidth: 320,
                margin: "0 auto 28px",
              }}
            >
              This certificate link is invalid, has been revoked, or does not
              exist. If you believe this is an error, please contact support.
            </p>

            <Link
              to="/"
              style={{
                color: "var(--accent-text)",
                fontSize: 13,
                textDecoration: "none",
                borderBottom: "1px solid var(--accent)",
                paddingBottom: 1,
              }}
            >
              ← Back to LearnTrack
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
