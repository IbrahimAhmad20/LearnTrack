import { useState } from "react";

export default function ContentPlayer({ src, title, onEvent }) {
  const [status, setStatus] = useState("idle");

  const emit = (type) => {
    setStatus(type);
    onEvent?.({ event_type: type, watch_time: 0 });
  };

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title || "Course content"}</h3>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {status}
        </span>
      </div>

      <div className="aspect-video" style={{ background: "var(--bg-raised)" }}>
        {src ? (
          <iframe
            title={title || "LearnTrack content player"}
            src={src}
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-center px-6">
            Add a content URL to render the player.
          </div>
        )}
      </div>

      <div className="p-3 flex flex-wrap gap-2">
        <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => emit("play")}>
          Play
        </button>
        <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => emit("pause")}>
          Pause
        </button>
        <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => emit("skip")}>
          Skip
        </button>
      </div>
    </section>
  );
}
