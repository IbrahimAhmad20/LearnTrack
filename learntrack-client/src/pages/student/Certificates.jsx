import { useState, useEffect } from "react";
import { certificates as certificatesApi } from "../../api";
import { Spinner, SkeletonCard, EmptyState } from "../../components/ui";

function CertCard({ cert: initialCert }) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [cert, setCert] = useState(initialCert);

  const { courses: course, issued_at, cert_url, verify_hash, cert_id } = cert;

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const handleCopy = async () => {
    const link = `${window.location.origin}/verify/${verify_hash}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // First click: call generate endpoint, get back the URL, then open it.
  // Subsequent clicks: cert_url is already set, goes straight to the <a> tag.
  const handleDownload = async () => {
    if (cert_url) return; // shouldn't reach here — button is an <a> when url exists
    try {
      setGenerating(true);
      const res = await certificatesApi.generate(cert_id);
      const url = res.data?.cert_url;
      if (url) {
        setCert((prev) => ({ ...prev, cert_url: url }));
        window.open(url, "_blank", "noreferrer");
      }
    } catch {
      // leave button in place — user can retry
    } finally {
      setGenerating(false);
    }
  };

  const instructorName = course?.instructors?.users?.full_name || "Instructor";
  const thumbnailUrl = course?.thumbnail_url;

  return (
    <div
      className="card overflow-hidden relative flex flex-col"
      style={{ transition: "box-shadow 0.2s" }}
    >
      {/* Green ribbon */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "rgba(29,158,117,0.18)",
          color: "#1d9e75",
          border: "1px solid rgba(29,158,117,0.3)",
          borderRadius: 4,
          padding: "2px 8px",
          fontSize: 11,
          fontFamily: "DM Mono, monospace",
          letterSpacing: "0.04em",
          zIndex: 1,
        }}
      >
        ✦ Certified
      </div>

      {/* Thumbnail */}
      <div
        style={{
          height: 140,
          background: thumbnailUrl ? undefined : "var(--bg-raised)",
          borderBottom: "1px solid var(--border)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={course?.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 32, opacity: 0.15, color: "var(--accent)" }}>
            ✦
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <h3
            className="font-medium text-sm truncate mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {course?.title || "Untitled Course"}
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            by {instructorName}
          </p>
        </div>

        <p
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          Issued {formatDate(issued_at)}
        </p>

        <div className="flex gap-2 mt-auto pt-1">
          {cert_url ? (
            // Already generated — plain anchor, instant download
            <a
              href={cert_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
            >
              <DownloadIcon />
              Download
            </a>
          ) : (
            // Not yet generated — button triggers generation
            <button
              onClick={handleDownload}
              disabled={generating}
              className="btn-primary"
              style={{
                flex: 1,
                justifyContent: "center",
                fontSize: 12,
                opacity: generating ? 0.7 : 1,
                cursor: generating ? "wait" : "pointer",
              }}
            >
              {generating ? (
                <>
                  <SpinnerIcon />
                  Generating…
                </>
              ) : (
                <>
                  <DownloadIcon />
                  Download
                </>
              )}
            </button>
          )}

          <button
            onClick={handleCopy}
            className="btn-ghost"
            style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animation: "spin 0.7s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2a10 10 0 0 1 0 20" />
    </svg>
  );
}

export default function Certificates() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    certificatesApi
      .mine()
      .then((r) => setCerts(r.data || []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-display text-2xl"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            My Certificates
          </h1>
          {!loading && certs.length > 0 && (
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {certs.length} certificate{certs.length !== 1 ? "s" : ""} earned
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : certs.length === 0 ? (
        <EmptyState
          icon="✦"
          title="No certificates yet"
          description="Complete a course to earn your first certificate"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {certs.map((cert) => (
            <CertCard key={cert.cert_id} cert={cert} />
          ))}
        </div>
      )}
    </div>
  );
}
