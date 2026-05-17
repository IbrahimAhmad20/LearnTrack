import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { ErrorMessage, Spinner } from "../../components/ui";
import api from "../../api";

function InitialsAvatar({ name = "", size = 80 }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--accent-dim)",
        border: "2px solid var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--accent-text)",
        fontSize: size * 0.35,
        fontWeight: 600,
        fontFamily: "DM Mono, monospace",
        flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast?.();

  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
  });
  const [original, setOriginal] = useState({ ...form });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarErr, setAvatarErr] = useState(false);

  useEffect(() => {
    if (user) {
      const init = {
        full_name: user.full_name || "",
        bio: user.bio || "",
        avatar_url: user.avatar_url || "",
      };
      setForm(init);
      setOriginal(init);
    }
  }, [user]);

  const isDirty =
    form.full_name !== original.full_name ||
    form.bio !== original.bio ||
    form.avatar_url !== original.avatar_url;

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.put("/users/me", {
        full_name: form.full_name.trim(),
        bio: form.bio.trim(),
        avatar_url: form.avatar_url.trim() || null,
      });
      await refreshUser();
      setOriginal({ ...form });
      toast?.success?.("Profile updated");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const showAvatar = form.avatar_url && !avatarErr;

  return (
    <div className="p-8 page-enter">
      <h1
        className="font-display text-2xl mb-8"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        Profile
      </h1>

      <div style={{ maxWidth: 560 }}>
        {/* Avatar section */}
        <div className="card p-6 mb-4">
          <h2
            className="text-xs uppercase tracking-widest mb-4"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            Avatar
          </h2>
          <div className="flex items-center gap-5 mb-4">
            {showAvatar ? (
              <img
                src={form.avatar_url}
                alt="Avatar preview"
                onError={() => setAvatarErr(true)}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid var(--accent)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <InitialsAvatar
                name={form.full_name || user?.full_name}
                size={80}
              />
            )}
            <div className="flex-1">
              <label className="label">Avatar URL</label>
              <input
                type="url"
                value={form.avatar_url}
                onChange={(e) => {
                  setAvatarErr(false);
                  setForm((p) => ({ ...p, avatar_url: e.target.value }));
                }}
                placeholder="https://example.com/your-photo.jpg"
                className="input-field"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Paste an image URL to update your avatar
              </p>
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="card p-6 mb-4">
          <h2
            className="text-xs uppercase tracking-widest mb-4"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            Personal Info
          </h2>

          <div className="mb-4">
            <label className="label">
              Full Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, full_name: e.target.value }))
              }
              className="input-field"
              placeholder="Your full name"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="label" style={{ marginBottom: 0 }}>
                Bio
              </label>
              <span
                className="text-xs"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "DM Mono, monospace",
                }}
              >
                {form.bio.length}/500
              </span>
            </div>
            <textarea
              value={form.bio}
              onChange={(e) =>
                setForm((p) => ({ ...p, bio: e.target.value.slice(0, 500) }))
              }
              className="input-field"
              rows={4}
              placeholder="Tell students a bit about yourself…"
              style={{ resize: "vertical", minHeight: 90 }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorMessage message={error} />
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="btn-primary"
            style={{
              opacity: !isDirty || saving ? 0.5 : 1,
              cursor: !isDirty || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving && <Spinner size={14} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
