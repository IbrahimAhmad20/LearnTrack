import { useRef, useState } from "react";

const ICONS = {
  image: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  file: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FileUpload — reusable drag-and-drop upload widget.
 *
 * Props:
 *   accept      string   — MIME types or extensions, e.g. "image/*" or ".pdf,.mp4"
 *   label       string   — displayed above the dropzone
 *   hint        string   — small helper text
 *   onUpload    async (file) => { url }  — called when file selected; receives File
 *   preview     string   — current URL shown as preview (image types)
 *   type        "image" | "file"
 *   disabled    boolean
 */
export default function FileUpload({
  accept = "*/*",
  label = "Upload file",
  hint = "",
  onUpload,
  preview,
  type = "file",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [localPreview, setLocalPreview] = useState(null);

  const currentPreview = localPreview || preview;

  async function handleFile(file) {
    if (!file || !onUpload) return;
    setError("");
    setUploading(true);
    setProgress(10);

    // Optimistic local preview for images
    if (type === "image") {
      setLocalPreview(URL.createObjectURL(file));
    }

    try {
      // Fake progress ticks while upload runs
      const ticker = setInterval(() => {
        setProgress((p) => Math.min(p + 15, 85));
      }, 400);

      await onUpload(file);

      clearInterval(ticker);
      setProgress(100);
      setTimeout(() => setProgress(0), 800);
    } catch (err) {
      setLocalPreview(null);
      setError(err?.response?.data?.error || err.message || "Upload failed");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      {label && (
        <label className="label" style={{ display: "block", marginBottom: 6 }}>
          {label}
        </label>
      )}

      {/* Image preview */}
      {type === "image" && currentPreview && (
        <div style={{ marginBottom: 10 }}>
          <img
            src={currentPreview}
            alt="Preview"
            style={{
              width: "100%",
              maxWidth: 240,
              height: 140,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid var(--border)",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Dropzone */}
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 8,
          padding: "20px 16px",
          textAlign: "center",
          cursor: disabled || uploading ? "not-allowed" : "pointer",
          background: dragging ? "var(--accent-dim)" : "var(--bg-raised)",
          transition: "border-color 0.15s, background 0.15s",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>
          {ICONS[type] ?? ICONS.file}
        </div>
        {uploading ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Uploading… {progress}%
          </p>
        ) : (
          <>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 2,
              }}
            >
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            {hint && (
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</p>
            )}
          </>
        )}
      </div>

      {/* Progress bar */}
      {uploading && progress > 0 && (
        <div
          style={{
            marginTop: 6,
            height: 3,
            borderRadius: 2,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "var(--accent)",
              transition: "width 0.3s",
            }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p
          style={{ fontSize: 12, color: "var(--error, #e07a73)", marginTop: 5 }}
        >
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onInputChange}
        style={{ display: "none" }}
        disabled={disabled || uploading}
      />
    </div>
  );
}
