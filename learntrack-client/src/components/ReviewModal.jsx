import { useState } from "react";
import { Modal } from "./ui";
import StarRating from "./StarRating";
import api from "../api";

/**
 * ReviewModal
 *
 * Props:
 *   courseId    {number}   — course being reviewed
 *   courseTitle {string}   — shown in the modal header
 *   onClose     {fn}       — called when modal should close
 *   onSubmit    {fn}       — called with { rating, body } after successful save
 *   existing    {object}   — { review_id, rating, body } if editing an existing review
 */
export default function ReviewModal({
  courseId,
  courseTitle,
  onClose,
  onSubmit,
  existing,
}) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [body, setBody] = useState(existing?.body || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  async function handleSubmit() {
    if (!rating) {
      setError("Please select a star rating before submitting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (existing?.review_id) {
        await api.patch(`/reviews/${existing.review_id}`, {
          rating,
          body: body.trim() || null,
        });
      } else {
        await api.post(`/reviews/course/${courseId}`, {
          rating,
          body: body.trim() || null,
        });
      }
      onSubmit?.({ rating, body });
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to save review. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={existing ? "Edit your review" : "Leave a review"}
      onClose={onClose}
      width={500}
    >
      {/* Course name */}
      <p
        className="text-xs mb-5 truncate"
        style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
      >
        {courseTitle}
      </p>

      {/* Star picker */}
      <div
        className="flex flex-col items-center gap-2 py-6 rounded-lg mb-5"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <StarRating value={rating} interactive onChange={setRating} size={36} />
        <p
          className="text-sm font-medium h-5 transition-all"
          style={{ color: rating ? "var(--accent-text)" : "var(--text-muted)" }}
        >
          {LABELS[rating] || "Tap to rate"}
        </p>
      </div>

      {/* Review body */}
      <div className="mb-5">
        <label
          className="block text-xs mb-2 uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          Review (optional)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your experience with this course…"
          rows={4}
          maxLength={2000}
          style={{
            width: "100%",
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 13,
            padding: "10px 12px",
            resize: "vertical",
            outline: "none",
            lineHeight: 1.6,
            fontFamily: "DM Sans, sans-serif",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
        <p
          className="text-right text-xs mt-1"
          style={{
            color: "var(--text-muted)",
            fontFamily: "DM Mono, monospace",
          }}
        >
          {body.length} / 2000
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded px-3 py-2 text-sm mb-4"
          style={{
            background: "rgba(192,83,74,0.12)",
            border: "1px solid rgba(192,83,74,0.3)",
            color: "#e07a73",
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 13,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !rating}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            background: saving || !rating ? "var(--bg-hover)" : "var(--accent)",
            color: saving || !rating ? "var(--text-muted)" : "#fff",
            cursor: saving || !rating ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {saving ? "Saving…" : existing ? "Update review" : "Submit review"}
        </button>
      </div>
    </Modal>
  );
}
