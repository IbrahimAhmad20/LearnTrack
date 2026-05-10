import { useEffect, useId, useRef } from "react";
import { Spinner } from "./ui";

/**
 * Accessible confirmation modal (browser confirm replacement).
 *
 * @param {boolean} open
 * @param {function} onOpenChange — (false) when cancel/backdrop/Escape closes
 * @param {function} [onConfirm] — async/sync; modal stays open until it resolves if you disable via loading from parent
 * @param {string} [title]
 * @param {string} [message]
 * @param {string} [confirmLabel]
 * @param {string} [cancelLabel]
 * @param {'default'|'danger'} [variant] — danger styles the confirm button destructive
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Confirm",
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  variant = "default",
  confirmLoading = false,
}) {
  const titleId = useId();
  const descId = useId();
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !confirmLoading) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onOpenChange, confirmLoading]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
      }}
      role="presentation"
      onMouseDown={(e) => {
        if (confirmLoading) return;
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className="card-raised w-full max-w-md p-6 shadow-xl"
        style={{
          animation: "confirmPop 0.18s ease",
        }}
      >
        <style>{`
          @keyframes confirmPop {
            from { opacity: 0; transform: scale(0.97) translateY(6px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
        <h2
          id={titleId}
          className="text-base font-medium mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        {message ? (
          <p
            id={descId}
            className="text-sm mb-6 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {message}
          </p>
        ) : (
          <div className="mb-6" />
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost px-4 py-2 text-sm"
            onClick={() => onOpenChange(false)}
            disabled={confirmLoading}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`px-4 py-2 rounded text-sm font-medium transition-opacity border-0 cursor-pointer disabled:opacity-60 ${
              variant === "danger" ? "" : "btn-primary"
            }`}
            style={
              variant === "danger"
                ? {
                    background: "var(--danger)",
                    color: "#fff",
                  }
                : undefined
            }
            onClick={handleConfirm}
            disabled={confirmLoading}
          >
            {confirmLoading ? <Spinner size={16} /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
