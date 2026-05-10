import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), 2400);
  };

  const value = useMemo(() => ({ showToast }), []);

  const color =
    toast?.type === "error"
      ? "var(--danger)"
      : toast?.type === "success"
        ? "var(--success)"
        : "var(--info)";

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className="fixed right-5 bottom-5 px-4 py-2 rounded text-sm z-50 shadow-lg"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: `1px solid ${color}`,
          }}
        >
          {toast.message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
