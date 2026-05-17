import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { ErrorMessage, Spinner, StatCard, Badge } from "../../components/ui";
import FileUpload from "../../components/FileUpload";
import StarRating from "../../components/StarRating";
import api, { uploads, instructorProfile as instructorApi } from "../../api";

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

export default function InstructorProfile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast?.();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");

  // Separate form state for user fields vs instructor fields
  const [userForm, setUserForm] = useState({ full_name: "", bio: "" });
  const [instructorForm, setInstructorForm] = useState({
    department: "",
    qualification: "",
  });
  const [originalUser, setOriginalUser] = useState({});
  const [originalInst, setOriginalInst] = useState({});

  const [savingUser, setSavingUser] = useState(false);
  const [savingInst, setSavingInst] = useState(false);
  const [userError, setUserError] = useState("");
  const [instError, setInstError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await instructorApi.me();
      const p = res.data;
      setProfile(p);
      setAvatarUrl(p.avatar_url || "");

      const uf = { full_name: p.full_name || "", bio: p.bio || "" };
      const inf = {
        department: p.department || "",
        qualification: p.qualification || "",
      };
      setUserForm(uf);
      setOriginalUser(uf);
      setInstructorForm(inf);
      setOriginalInst(inf);
    } catch {
      // silently set empty
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarUpload(file) {
    const res = await uploads.avatar(file);
    const url = res.data?.avatar_url;
    setAvatarUrl(url || "");
    await refreshUser();
    toast?.success?.("Avatar updated");
  }

  const isUserDirty =
    userForm.full_name !== originalUser.full_name ||
    userForm.bio !== originalUser.bio;
  const isInstDirty =
    instructorForm.department !== originalInst.department ||
    instructorForm.qualification !== originalInst.qualification;

  async function handleSaveUser() {
    if (!userForm.full_name.trim()) {
      setUserError("Full name is required.");
      return;
    }
    setSavingUser(true);
    setUserError("");
    try {
      await api.put("/users/me", {
        full_name: userForm.full_name.trim(),
        bio: userForm.bio.trim(),
      });
      await refreshUser();
      setOriginalUser({ ...userForm });
      toast?.success?.("Profile updated");
    } catch (err) {
      setUserError(err?.response?.data?.error || "Failed to save.");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleSaveInstructor() {
    setSavingInst(true);
    setInstError("");
    try {
      await instructorApi.update({
        department: instructorForm.department.trim() || null,
        qualification: instructorForm.qualification.trim() || null,
      });
      setOriginalInst({ ...instructorForm });
      toast?.success?.("Instructor profile updated");
    } catch (err) {
      setInstError(err?.response?.data?.error || "Failed to save.");
    } finally {
      setSavingInst(false);
    }
  }

  if (loading) {
    return (
      <div
        className="p-8 flex items-center justify-center"
        style={{ minHeight: 200 }}
      >
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="p-8 page-enter">
      <h1
        className="font-display text-2xl mb-2"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        My Profile
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        This information is visible to students on your public profile.
      </p>

      {/* Stats row */}
      {profile?.stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Courses" value={profile.stats.total_courses} />
          <StatCard label="Students" value={profile.stats.total_students} />
          <StatCard
            label="Avg Rating"
            value={
              profile.stats.avg_rating ? `★ ${profile.stats.avg_rating}` : "—"
            }
            accent
          />
        </div>
      )}

      <div
        style={{
          maxWidth: 600,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Avatar */}
        <div className="card p-6">
          <h2
            className="text-xs uppercase tracking-widest mb-4"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            Profile Photo
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
                name={userForm.full_name || user?.full_name}
                size={80}
              />
            )}
            <div style={{ flex: 1 }}>
              <FileUpload
                type="image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hint="JPG, PNG, WebP · max 5 MB"
                onUpload={handleAvatarUpload}
              />
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="card p-6">
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
              value={userForm.full_name}
              onChange={(e) =>
                setUserForm((p) => ({ ...p, full_name: e.target.value }))
              }
              className="input-field"
              placeholder="Your full name"
            />
          </div>

          <div className="mb-4">
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
                {userForm.bio.length}/500
              </span>
            </div>
            <textarea
              value={userForm.bio}
              onChange={(e) =>
                setUserForm((p) => ({
                  ...p,
                  bio: e.target.value.slice(0, 500),
                }))
              }
              className="input-field"
              rows={4}
              placeholder="Tell students about your experience and teaching style…"
              style={{ resize: "vertical", minHeight: 90 }}
            />
          </div>

          {userError && (
            <div className="mb-3">
              <ErrorMessage message={userError} />
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSaveUser}
              disabled={!isUserDirty || savingUser}
              className="btn-primary"
              style={{
                opacity: !isUserDirty || savingUser ? 0.5 : 1,
                cursor: !isUserDirty || savingUser ? "not-allowed" : "pointer",
              }}
            >
              {savingUser && <Spinner size={14} />}
              {savingUser ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Instructor fields */}
        <div className="card p-6">
          <h2
            className="text-xs uppercase tracking-widest mb-4"
            style={{
              color: "var(--text-muted)",
              fontFamily: "DM Mono, monospace",
            }}
          >
            Instructor Details
          </h2>

          <div className="mb-4">
            <label className="label">Department</label>
            <input
              type="text"
              value={instructorForm.department}
              onChange={(e) =>
                setInstructorForm((p) => ({ ...p, department: e.target.value }))
              }
              className="input-field"
              placeholder="e.g. Computer Science"
            />
          </div>

          <div className="mb-4">
            <label className="label">Qualification / Credentials</label>
            <input
              type="text"
              value={instructorForm.qualification}
              onChange={(e) =>
                setInstructorForm((p) => ({
                  ...p,
                  qualification: e.target.value,
                }))
              }
              className="input-field"
              placeholder="e.g. PhD in Machine Learning, AWS Certified"
            />
          </div>

          {instError && (
            <div className="mb-3">
              <ErrorMessage message={instError} />
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSaveInstructor}
              disabled={!isInstDirty || savingInst}
              className="btn-primary"
              style={{
                opacity: !isInstDirty || savingInst ? 0.5 : 1,
                cursor: !isInstDirty || savingInst ? "not-allowed" : "pointer",
              }}
            >
              {savingInst && <Spinner size={14} />}
              {savingInst ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Course list */}
        {profile?.courses?.length > 0 && (
          <div className="card overflow-hidden">
            <div
              className="px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2
                className="text-xs uppercase tracking-widest"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "DM Mono, monospace",
                }}
              >
                My Courses
              </h2>
            </div>
            {profile.courses.map((c, i) => (
              <div
                key={c.course_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom:
                    i < profile.courses.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                {c.thumbnail_url ? (
                  <img
                    src={c.thumbnail_url}
                    alt={c.title}
                    style={{
                      width: 48,
                      height: 36,
                      objectFit: "cover",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 36,
                      borderRadius: 4,
                      background: "var(--bg-raised)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>📚</span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {c.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <StarRating value={c.avg_rating} size={11} />
                    <span
                      className="text-xs"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "DM Mono, monospace",
                      }}
                    >
                      {c.enrollment_count} students
                    </span>
                    <Badge type={c.is_published ? "published" : "draft"}>
                      {c.is_published ? "published" : "draft"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
