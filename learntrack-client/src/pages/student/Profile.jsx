import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { ErrorMessage, Spinner } from "../../components/ui";
import FileUpload from "../../components/FileUpload";
import api, { uploads } from "../../api";

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
  });
  const [original, setOriginal] = useState({ ...form });
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      const init = { full_name: user.full_name || "", bio: user.bio || "" };
      setForm(init);
      setOriginal(init);
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  const isDirty =
    form.full_name !== original.full_name || form.bio !== original.bio;

  // Called by FileUpload when user picks an avatar image
  async function handleAvatarUpload(file) {
    const res = await uploads.avatar(file);
    const url = res.data?.avatar_url;
    setAvatarUrl(url || "");
    await refreshUser();
    toast?.success?.("Avatar updated");
  }

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

  return (
    <div className="p-8 page-enter">
      <h1
        className="font-display text-2xl mb-8"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        Profile
      </h1>

      <div style={{ maxWidth: 560 }}>
        {/* Avatar */}
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
          <div className="flex items-start gap-5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
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
            <div style={{ flex: 1 }}>
              <FileUpload
                type="image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                label=""
                hint="JPG, PNG, WebP or GIF · max 5 MB"
                onUpload={handleAvatarUpload}
              />
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
              placeholder="Tell others a bit about yourself…"
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
