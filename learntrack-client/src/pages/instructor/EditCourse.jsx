import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  courses as coursesApi,
  quizzes as quizzesApi,
  uploads,
} from "../../api";
import { Spinner, ErrorMessage, Badge } from "../../components/ui";
import { useToast } from "../../components";
import FileUpload from "../../components/FileUpload";

function emptyMcqOptions(n = 4) {
  return Array.from({ length: n }, (_, i) => ({
    option_text: "",
    is_correct: i === 0,
  }));
}

/** Parse pasted/uploaded JSON into a questions array. */
function normalizeImportQuestions(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
  throw new Error(
    'Expected a JSON array of questions, or { "questions": [ ... ] }',
  );
}

function validateImportQuestion(raw, index) {
  const label = `Question ${index + 1}`;
  if (!raw || typeof raw !== "object") {
    throw new Error(`${label}: invalid object`);
  }
  const type = raw.question_type;
  if (type !== "mcq" && type !== "true_false") {
    throw new Error(`${label}: question_type must be "mcq" or "true_false"`);
  }
  const text = String(raw.question_text ?? "").trim();
  if (!text) throw new Error(`${label}: question_text is required`);
  const opts = raw.options;
  if (!Array.isArray(opts) || opts.length < 2) {
    throw new Error(`${label}: options must be an array with at least 2 items`);
  }
  if (type === "true_false" && opts.length !== 2) {
    throw new Error(`${label}: true_false must have exactly 2 options`);
  }
  if (!opts.some((o) => o.is_correct === true)) {
    throw new Error(`${label}: at least one option must have is_correct: true`);
  }
  for (const o of opts) {
    if (!String(o.option_text ?? "").trim()) {
      throw new Error(`${label}: every option needs option_text`);
    }
  }
  return {
    question_type: type,
    question_text: text,
    points: Number(raw.points) > 0 ? Number(raw.points) : 1,
    options: opts.map((o) => ({
      option_text: String(o.option_text).trim(),
      is_correct: Boolean(o.is_correct),
    })),
  };
}

export default function EditCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [course, setCourse] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    discounted_price: "",
    is_published: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [newQuiz, setNewQuiz] = useState({
    title: "",
    pass_score: 70,
    allow_multiple: true,
    time_limit_min: "",
    is_published: false,
  });
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [quizDetail, setQuizDetail] = useState(null);
  const [quizDetailLoading, setQuizDetailLoading] = useState(false);

  const [questionForm, setQuestionForm] = useState({
    question_type: "mcq",
    question_text: "",
    points: 1,
    options: emptyMcqOptions(4),
  });
  const [addingQuestion, setAddingQuestion] = useState(false);

  const [quizSectionOpen, setQuizSectionOpen] = useState(true);
  const [quizImportOpen, setQuizImportOpen] = useState(false);
  const [quizImportText, setQuizImportText] = useState("");
  const [importingQuizBatch, setImportingQuizBatch] = useState(false);

  const [contentForm, setContentForm] = useState({
    title: "",
    content_type: "video",
    content_url: "",
    content_body: "",
    duration_sec: "",
    sort_order: "",
    is_published: false,
  });
  const [addingContent, setAddingContent] = useState(null);
  const [editContent, setEditContent] = useState(null);
  const [savingEditContent, setSavingEditContent] = useState(false);

  const contentLocked = addingContent !== null || savingEditContent;
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [courseFiles, setCourseFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const reloadCourse = useCallback(() => {
    return coursesApi
      .get(id)
      .then((r) => setCourse(r.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    coursesApi
      .get(id)
      .then((r) => {
        setCourse(r.data);
        setThumbnailUrl(r.data.thumbnail_url || "");
        setForm({
          title: r.data.title || "",
          description: r.data.description || "",
          category: r.data.category || "",
          price: r.data.price != null ? String(r.data.price) : "",
          discounted_price:
            r.data.discounted_price != null
              ? String(r.data.discounted_price)
              : "",
          is_published: r.data.is_published || false,
        });
      })
      .catch(() => setError("Course not found"))
      .finally(() => setLoading(false));

    // Load course files
    setLoadingFiles(true);
    uploads
      .listCourseFiles(id)
      .then((r) => {
        setCourseFiles(r.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  }, [id]);

  useEffect(() => {
    const n = course?.content?.length ?? 0;
    setContentForm((f) => ({
      ...f,
      sort_order: f.sort_order === "" ? String(n) : f.sort_order,
    }));
  }, [course?.content?.length]);

  const set = (k) => (e) => {
    const val =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await coursesApi.update(id, form);
      setSuccess(true);
      await reloadCourse();
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const submitContent = async (e) => {
    e.preventDefault();
    if (!contentForm.title.trim()) {
      showToast("Content title is required", "error");
      return;
    }
    const sort =
      contentForm.sort_order !== "" && contentForm.sort_order != null
        ? Number(contentForm.sort_order)
        : (course?.content?.length ?? 0);

    const payload = {
      title: contentForm.title.trim(),
      content_type: contentForm.content_type,
      sort_order: Number.isFinite(sort) ? sort : 0,
      is_published: contentForm.is_published,
    };
    const url = contentForm.content_url.trim();
    const body = contentForm.content_body.trim();
    if (url) payload.content_url = url;
    if (body) payload.content_body = body;
    const dur = contentForm.duration_sec;
    if (dur !== "" && dur != null && Number(dur) > 0) {
      payload.duration_sec = Number(dur);
    }

    setAddingContent("add");
    try {
      await coursesApi.addContent(id, payload);
      showToast("Content added", "success");
      setContentForm({
        title: "",
        content_type: "video",
        content_url: "",
        content_body: "",
        duration_sec: "",
        sort_order: String((course?.content?.length ?? 0) + 1),
        is_published: false,
      });
      await reloadCourse();
    } catch (err) {
      showToast(err.response?.data?.error || "Could not add content", "error");
    } finally {
      setAddingContent(null);
    }
  };

  const deleteContentRow = async (contentId, title) => {
    if (!window.confirm(`Remove "${title}" from this course?`)) return;
    setAddingContent(contentId);
    try {
      await coursesApi.deleteContent(id, contentId);
      showToast("Content removed", "success");
      if (editContent?.content_id === contentId) setEditContent(null);
      await reloadCourse();
    } catch (err) {
      showToast(
        err.response?.data?.error || "Could not remove content",
        "error",
      );
    } finally {
      setAddingContent(null);
    }
  };

  const startEditContent = (item) => {
    setEditContent({
      content_id: item.content_id,
      title: item.title || "",
      content_type: item.content_types?.type_name || "video",
      content_url: item.content_url || "",
      content_body: item.content_body || "",
      duration_sec:
        item.duration_sec != null && item.duration_sec !== ""
          ? String(item.duration_sec)
          : "",
      sort_order: item.sort_order != null ? String(item.sort_order) : "0",
      is_published: Boolean(item.is_published),
    });
  };

  const saveEditContent = async (e) => {
    e.preventDefault();
    if (!editContent?.title?.trim()) {
      showToast("Content title is required", "error");
      return;
    }
    const sortNum = Number(editContent.sort_order);
    const payload = {
      title: editContent.title.trim(),
      content_type: editContent.content_type,
      sort_order: Number.isFinite(sortNum) ? sortNum : 0,
      is_published: editContent.is_published,
      content_url: editContent.content_url.trim() || null,
      content_body: editContent.content_body.trim() || null,
    };
    const dur = editContent.duration_sec;
    if (dur !== "" && dur != null && Number(dur) > 0) {
      payload.duration_sec = Number(dur);
    } else {
      payload.duration_sec = null;
    }

    setSavingEditContent(true);
    try {
      await coursesApi.updateContent(id, editContent.content_id, payload);
      showToast("Content updated", "success");
      setEditContent(null);
      await reloadCourse();
    } catch (err) {
      showToast(
        err.response?.data?.error || "Could not update content",
        "error",
      );
    } finally {
      setSavingEditContent(false);
    }
  };

  const createQuiz = async (e) => {
    e.preventDefault();
    if (!newQuiz.title.trim()) {
      showToast("Quiz title is required", "error");
      return;
    }
    setCreatingQuiz(true);
    try {
      const createRes = await quizzesApi.create({
        course_id: Number(id),
        title: newQuiz.title.trim(),
        pass_score: Number(newQuiz.pass_score) || 50,
        allow_multiple: newQuiz.allow_multiple,
        time_limit_min: newQuiz.time_limit_min
          ? Number(newQuiz.time_limit_min)
          : undefined,
        is_published: newQuiz.is_published,
      });
      const newQuizId = createRes.data?.quiz_id;
      showToast("Quiz created — add questions below", "success");
      setNewQuiz({
        title: "",
        pass_score: 70,
        allow_multiple: true,
        time_limit_min: "",
        is_published: false,
      });
      await reloadCourse();
      setQuizSectionOpen(true);
      if (newQuizId) {
        setExpandedQuizId(newQuizId);
        setQuizDetailLoading(true);
        try {
          const detailRes = await quizzesApi.get(newQuizId);
          setQuizDetail(detailRes.data);
          setQuestionType("mcq");
        } catch {
          setExpandedQuizId(null);
          setQuizDetail(null);
        } finally {
          setQuizDetailLoading(false);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Could not create quiz", "error");
    } finally {
      setCreatingQuiz(false);
    }
  };

  const togglePublishQuiz = async (quizId, nextPublished) => {
    try {
      await quizzesApi.update(quizId, { is_published: nextPublished });
      showToast(
        nextPublished ? "Quiz is live for students" : "Quiz hidden",
        "success",
      );
      await reloadCourse();
      if (expandedQuizId === quizId && quizDetail) {
        setQuizDetail({ ...quizDetail, is_published: nextPublished });
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Update failed", "error");
    }
  };

  const openQuizBuilder = async (quizId) => {
    if (expandedQuizId === quizId) {
      setExpandedQuizId(null);
      setQuizDetail(null);
      return;
    }
    setExpandedQuizId(quizId);
    setQuizDetailLoading(true);
    try {
      const res = await quizzesApi.get(quizId);
      setQuizDetail(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || "Could not load quiz", "error");
      setExpandedQuizId(null);
      setQuizDetail(null);
    } finally {
      setQuizDetailLoading(false);
    }
  };

  const setQuestionType = (t) => {
    if (t === "true_false") {
      setQuestionForm({
        question_type: "true_false",
        question_text: "",
        points: 1,
        options: [
          { option_text: "True", is_correct: true },
          { option_text: "False", is_correct: false },
        ],
      });
    } else {
      setQuestionForm({
        question_type: "mcq",
        question_text: "",
        points: 1,
        options: emptyMcqOptions(4),
      });
    }
  };

  const updateMcqOption = (idx, field, value) => {
    setQuestionForm((f) => {
      const opts = [...f.options];
      if (field === "is_correct" && value === true) {
        opts.forEach((o, i) => {
          opts[i] = { ...o, is_correct: i === idx };
        });
      } else {
        opts[idx] = { ...opts[idx], [field]: value };
      }
      return { ...f, options: opts };
    });
  };

  const addMcqOption = () => {
    setQuestionForm((f) => ({
      ...f,
      options: [...f.options, { option_text: "", is_correct: false }],
    }));
  };

  const removeMcqOption = (idx) => {
    setQuestionForm((f) => {
      if (f.options.length <= 2) return f;
      const opts = f.options.filter((_, i) => i !== idx);
      if (!opts.some((o) => o.is_correct))
        opts[0] = { ...opts[0], is_correct: true };
      return { ...f, options: opts };
    });
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!expandedQuizId) return;
    if (!questionForm.question_text.trim()) {
      showToast("Question text is required", "error");
      return;
    }
    const opts = questionForm.options.map((o) => ({
      option_text: String(o.option_text).trim(),
      is_correct: Boolean(o.is_correct),
    }));
    if (opts.some((o) => !o.option_text)) {
      showToast("Every option needs text", "error");
      return;
    }
    if (!opts.some((o) => o.is_correct)) {
      showToast("Mark one correct answer", "error");
      return;
    }

    const sortOrder = quizDetail?.questions?.length ?? 0;

    setAddingQuestion(true);
    try {
      await quizzesApi.addQuestion(expandedQuizId, {
        question_type: questionForm.question_type,
        question_text: questionForm.question_text.trim(),
        points: Number(questionForm.points) || 1,
        sort_order: sortOrder,
        options: opts,
      });
      showToast("Question added", "success");
      const res = await quizzesApi.get(expandedQuizId);
      setQuizDetail(res.data);
      setQuestionType(questionForm.question_type);
      setQuestionForm((f) => ({
        ...f,
        question_text: "",
        points: 1,
      }));
    } catch (err) {
      showToast(err.response?.data?.error || "Could not add question", "error");
    } finally {
      setAddingQuestion(false);
    }
  };

  const runQuizImport = async () => {
    if (!expandedQuizId) return;
    const raw = quizImportText.trim();
    if (!raw) {
      showToast("Paste JSON or choose a file first", "error");
      return;
    }
    let rows;
    try {
      const parsed = JSON.parse(raw);
      rows = normalizeImportQuestions(parsed).map(validateImportQuestion);
    } catch (err) {
      showToast(err.message || "Invalid JSON", "error");
      return;
    }
    if (rows.length === 0) {
      showToast("No questions found in JSON", "error");
      return;
    }

    setImportingQuizBatch(true);
    let baseCount = quizDetail?.questions?.length ?? 0;
    try {
      for (let i = 0; i < rows.length; i++) {
        const q = rows[i];
        await quizzesApi.addQuestion(expandedQuizId, {
          question_type: q.question_type,
          question_text: q.question_text,
          points: q.points,
          sort_order: baseCount + i,
          options: q.options,
        });
      }
      const res = await quizzesApi.get(expandedQuizId);
      setQuizDetail(res.data);
      setQuizImportText("");
      setQuizImportOpen(false);
      showToast(`Imported ${rows.length} question(s)`, "success");
    } catch (err) {
      showToast(
        err.response?.data?.error || err.message || "Import failed",
        "error",
      );
    } finally {
      setImportingQuizBatch(false);
    }
  };

  const onQuizImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setQuizImportText(String(reader.result || ""));
      showToast("File loaded — review JSON, then Import", "success");
    };
    reader.onerror = () => showToast("Could not read file", "error");
    reader.readAsText(file);
    e.target.value = "";
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );

  const quizzes = course?.quizzes || [];
  const contents = course?.content || [];

  return (
    <div className="p-8 max-w-4xl page-enter pb-24">
      <button
        onClick={() => navigate("/instructor/courses")}
        className="flex items-center gap-2 text-sm mb-6"
        style={{ color: "var(--text-muted)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to courses
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1
          className="text-xl font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Edit course
        </h1>
        {course && (
          <Badge type={course.is_published ? "published" : "draft"}>
            {course.is_published ? "live" : "draft"}
          </Badge>
        )}
      </div>

      <div className="card p-6 mb-6">
        <form onSubmit={save} className="flex flex-col gap-4">
          <div>
            <label className="label">Course title *</label>
            <input
              type="text"
              className="input-field"
              value={form.title}
              onChange={set("title")}
              required
            />
          </div>
          <div>
            <label className="label">Category</label>
            <input
              type="text"
              className="input-field"
              value={form.category}
              onChange={set("category")}
              placeholder="e.g. Computer Science"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input-field"
              rows={4}
              value={form.description}
              onChange={set("description")}
              style={{ resize: "none" }}
            />
          </div>

          {/* Thumbnail upload */}
          <div>
            <FileUpload
              type="image"
              accept="image/jpeg,image/png,image/webp"
              label="Course Thumbnail"
              hint="JPG, PNG or WebP · max 10 MB · recommended 1280×720"
              preview={thumbnailUrl}
              onUpload={async (file) => {
                const res = await uploads.thumbnail(id, file);
                setThumbnailUrl(res.data?.thumbnail_url || "");
                showToast("Thumbnail updated", "success");
              }}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Price (PKR)</label>
              <input
                type="number"
                className="input-field"
                value={form.price}
                onChange={set("price")}
                placeholder="0 for free"
                min="0"
                step="1"
              />
            </div>
            <div className="flex-1">
              <label className="label">Discounted price (PKR)</label>
              <input
                type="number"
                className="input-field"
                value={form.discounted_price}
                onChange={set("discounted_price")}
                placeholder="Leave blank if no discount"
                min="0"
                step="1"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={set("is_published")}
              style={{ accentColor: "var(--accent)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Published (visible to students)
            </span>
          </label>

          <ErrorMessage message={error} />

          {success && (
            <div
              className="rounded px-3 py-2 text-sm"
              style={{
                background: "rgba(61,158,110,0.12)",
                border: "1px solid rgba(61,158,110,0.3)",
                color: "#5ec99a",
              }}
            >
              Saved successfully
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => navigate("/instructor/courses")}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? <Spinner size={15} /> : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Course Files ─────────────────────────────────────────────────── */}
      <div className="card p-6 mb-6">
        <h2
          className="text-sm font-medium mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Course Files
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Attach PDFs, slide decks, videos, or other resources for enrolled
          students.
        </p>

        <FileUpload
          type="file"
          accept=".pdf,.mp4,.webm,.pptx,.ppt,.docx,.doc,.zip,.txt,video/*,application/pdf"
          hint="PDF, MP4, PPTX, DOCX, ZIP · max 500 MB"
          onUpload={async (file) => {
            const res = await uploads.courseFile(id, file);
            setCourseFiles((prev) => [...prev, res.data]);
            showToast("File uploaded", "success");
          }}
        />

        {loadingFiles ? (
          <div className="flex justify-center pt-4">
            <Spinner size={20} />
          </div>
        ) : courseFiles.length > 0 ? (
          <div
            className="mt-4"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {courseFiles.map((f, i) => (
              <div
                key={f.file_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom:
                    i < courseFiles.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  background: "var(--bg-raised)",
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>
                  {f.mime_type?.startsWith("video")
                    ? "🎬"
                    : f.mime_type === "application/pdf"
                      ? "📄"
                      : f.mime_type?.includes("presentation")
                        ? "📊"
                        : "📁"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="text-sm truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {f.file_name}
                  </p>
                  <p
                    className="text-xs"
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {f.file_size
                      ? `${(f.file_size / (1024 * 1024)).toFixed(1)} MB`
                      : ""}
                  </p>
                </div>
                <a
                  href={f.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: "2px 10px" }}
                >
                  View
                </a>
                <button
                  onClick={async () => {
                    try {
                      await uploads.deleteCourseFile(id, f.file_id);
                      setCourseFiles((prev) =>
                        prev.filter((x) => x.file_id !== f.file_id),
                      );
                      showToast("File removed", "success");
                    } catch {
                      showToast("Failed to delete file", "error");
                    }
                  }}
                  className="btn-ghost"
                  style={{
                    fontSize: 11,
                    padding: "2px 10px",
                    color: "var(--error, #e07a73)",
                    borderColor: "var(--error, #e07a73)",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card p-6 mb-6">
        <h2
          className="text-sm font-medium mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Course content
        </h2>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Add lessons students see in the course outline (videos, readings,
          etc.). Publish each item when it is ready.
        </p>

        <form onSubmit={submitContent} className="flex flex-col gap-3 mb-6">
          <div>
            <label className="label">Title *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Lecture 1: Introduction"
              value={contentForm.title}
              onChange={(e) =>
                setContentForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input-field"
              value={contentForm.content_type}
              onChange={(e) =>
                setContentForm((f) => ({
                  ...f,
                  content_type: e.target.value,
                }))
              }
            >
              <option value="video">Video</option>
              <option value="document">Document</option>
              <option value="quiz">Quiz syllabus item</option>
            </select>
          </div>
          <div>
            <label className="label">
              Resource URL (YouTube or direct video link)
            </label>
            <input
              type="url"
              className="input-field"
              placeholder="https://…"
              value={contentForm.content_url}
              onChange={(e) =>
                setContentForm((f) => ({ ...f, content_url: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Notes / pasted text (optional)</label>
            <textarea
              className="input-field text-sm"
              rows={3}
              placeholder="Short description or reading text"
              value={contentForm.content_body}
              onChange={(e) =>
                setContentForm((f) => ({ ...f, content_body: e.target.value }))
              }
              style={{ resize: "none" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">
                Duration (seconds, optional)
              </label>
              <input
                type="number"
                min={1}
                className="input-field"
                placeholder="600"
                value={contentForm.duration_sec}
                onChange={(e) =>
                  setContentForm((f) => ({
                    ...f,
                    duration_sec: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="label text-xs">Sort order</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={contentForm.sort_order}
                onChange={(e) =>
                  setContentForm((f) => ({
                    ...f,
                    sort_order: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contentForm.is_published}
              onChange={(e) =>
                setContentForm((f) => ({
                  ...f,
                  is_published: e.target.checked,
                }))
              }
              style={{ accentColor: "var(--accent)" }}
            />
            <span
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Published (visible in course with a published course)
            </span>
          </label>
          <button
            type="submit"
            className="btn-primary text-sm self-start"
            disabled={contentLocked}
          >
            {addingContent === "add" ? <Spinner size={14} /> : "Add content"}
          </button>
        </form>

        <p
          className="text-xs font-medium uppercase tracking-wide mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Current outline ({contents.length})
        </p>
        {contents.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No lessons yet — add one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {contents.map((item) => {
              const typeName = item.content_types?.type_name ?? "?";
              const editing = editContent?.content_id === item.content_id;

              if (editing) {
                return (
                  <li
                    key={item.content_id}
                    className="rounded-lg px-4 py-3 border"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg-secondary)",
                    }}
                  >
                    <form
                      onSubmit={saveEditContent}
                      className="flex flex-col gap-3"
                    >
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Edit lesson
                      </p>
                      <input
                        type="text"
                        className="input-field"
                        value={editContent.title}
                        onChange={(e) =>
                          setEditContent((f) =>
                            f ? { ...f, title: e.target.value } : f,
                          )
                        }
                      />
                      <select
                        className="input-field"
                        value={editContent.content_type}
                        onChange={(e) =>
                          setEditContent((f) =>
                            f ? { ...f, content_type: e.target.value } : f,
                          )
                        }
                      >
                        <option value="video">Video</option>
                        <option value="document">Document</option>
                        <option value="quiz">Quiz syllabus item</option>
                      </select>
                      <input
                        type="url"
                        className="input-field"
                        placeholder="Resource URL"
                        value={editContent.content_url}
                        onChange={(e) =>
                          setEditContent((f) =>
                            f ? { ...f, content_url: e.target.value } : f,
                          )
                        }
                      />
                      <textarea
                        className="input-field text-sm"
                        rows={2}
                        placeholder="Notes"
                        value={editContent.content_body}
                        onChange={(e) =>
                          setEditContent((f) =>
                            f ? { ...f, content_body: e.target.value } : f,
                          )
                        }
                        style={{ resize: "none" }}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          min={1}
                          className="input-field"
                          placeholder="Duration (sec)"
                          value={editContent.duration_sec}
                          onChange={(e) =>
                            setEditContent((f) =>
                              f ? { ...f, duration_sec: e.target.value } : f,
                            )
                          }
                        />
                        <input
                          type="number"
                          min={0}
                          className="input-field"
                          placeholder="Sort order"
                          value={editContent.sort_order}
                          onChange={(e) =>
                            setEditContent((f) =>
                              f ? { ...f, sort_order: e.target.value } : f,
                            )
                          }
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editContent.is_published}
                          onChange={(e) =>
                            setEditContent((f) =>
                              f
                                ? {
                                    ...f,
                                    is_published: e.target.checked,
                                  }
                                : f,
                            )
                          }
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span
                          className="text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Published
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className="btn-primary text-sm"
                          disabled={contentLocked}
                        >
                          {savingEditContent ? <Spinner size={14} /> : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-sm"
                          disabled={contentLocked}
                          onClick={() => setEditContent(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </li>
                );
              }

              return (
                <li
                  key={item.content_id}
                  className="flex flex-wrap items-center gap-3 justify-between rounded-lg px-4 py-3 border"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg-secondary)",
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {typeName} · order {item.sort_order ?? 0}{" "}
                      {item.is_published ? "· live" : "· draft"}
                    </p>
                    {item.content_url && (
                      <a
                        href={item.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs mt-1 inline-block hover:underline"
                        style={{ color: "var(--accent-text)" }}
                      >
                        Open link
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="btn-ghost text-xs py-1 px-2"
                      disabled={contentLocked}
                      onClick={() => startEditContent(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs py-1 px-2"
                      style={{ color: "var(--danger)" }}
                      disabled={contentLocked}
                      onClick={() =>
                        deleteContentRow(item.content_id, item.title)
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-4 text-left mb-4"
          onClick={() => setQuizSectionOpen((v) => !v)}
          style={{ color: "var(--text-primary)" }}
          aria-expanded={quizSectionOpen}
        >
          <div>
            <h2 className="text-sm font-medium">Quizzes</h2>
            <p
              className="text-xs mt-1 font-normal"
              style={{ color: "var(--text-muted)" }}
            >
              Optional — skip this if your course does not need tests. (
              {quizzes.length} {quizzes.length === 1 ? "quiz" : "quizzes"})
            </p>
          </div>
          <span className="text-lg" style={{ color: "var(--text-muted)" }}>
            {quizSectionOpen ? "−" : "+"}
          </span>
        </button>

        {quizSectionOpen && (
          <>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              When you add quizzes, students only see those marked{" "}
              <span style={{ color: "var(--text-secondary)" }}>live</span>.
            </p>

            <form
              onSubmit={createQuiz}
              className="flex flex-col gap-3 mb-6 pb-6"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                New quiz
              </p>
              <input
                type="text"
                className="input-field"
                placeholder="Quiz title"
                value={newQuiz.title}
                onChange={(e) =>
                  setNewQuiz((q) => ({ ...q, title: e.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Pass score (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input-field"
                    value={newQuiz.pass_score}
                    onChange={(e) =>
                      setNewQuiz((q) => ({ ...q, pass_score: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="label text-xs">
                    Time limit (min, optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    placeholder="—"
                    value={newQuiz.time_limit_min}
                    onChange={(e) =>
                      setNewQuiz((q) => ({
                        ...q,
                        time_limit_min: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newQuiz.allow_multiple}
                  onChange={(e) =>
                    setNewQuiz((q) => ({
                      ...q,
                      allow_multiple: e.target.checked,
                    }))
                  }
                  style={{ accentColor: "var(--accent)" }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Allow multiple attempts
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newQuiz.is_published}
                  onChange={(e) =>
                    setNewQuiz((q) => ({
                      ...q,
                      is_published: e.target.checked,
                    }))
                  }
                  style={{ accentColor: "var(--accent)" }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Visible to students
                </span>
              </label>
              <button
                type="submit"
                className="btn-primary text-sm self-start"
                disabled={creatingQuiz}
              >
                {creatingQuiz ? <Spinner size={14} /> : "Create quiz"}
              </button>
            </form>

            {quizzes.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No quizzes yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {quizzes.map((q) => (
                  <li
                    key={q.quiz_id}
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className="flex items-center justify-between gap-2 px-4 py-3"
                      style={{ background: "var(--bg-secondary)" }}
                    >
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {q.title}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Pass {q.pass_score}% ·{" "}
                          {q.allow_multiple
                            ? "retakes allowed"
                            : "single attempt"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge type={q.is_published ? "published" : "draft"}>
                          {q.is_published ? "live" : "draft"}
                        </Badge>
                        <button
                          type="button"
                          className="btn-ghost text-xs py-1 px-2"
                          onClick={() =>
                            togglePublishQuiz(q.quiz_id, !q.is_published)
                          }
                        >
                          {q.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          className="btn-primary text-xs py-1 px-2"
                          onClick={() => openQuizBuilder(q.quiz_id)}
                        >
                          {expandedQuizId === q.quiz_id ? "Close" : "Questions"}
                        </button>
                      </div>
                    </div>

                    {expandedQuizId === q.quiz_id && (
                      <div
                        className="p-4 border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {quizDetailLoading ? (
                          <div className="flex justify-center py-6">
                            <Spinner />
                          </div>
                        ) : quizDetail ? (
                          <>
                            <p
                              className="text-xs mb-4 rounded px-3 py-2"
                              style={{
                                background: "var(--bg-hover)",
                                color: "var(--text-secondary)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              Add <strong>multiple choice</strong> or{" "}
                              <strong>true/false</strong> using the form below,
                              or <strong>import many at once</strong> from a
                              JSON file. Download a sample:{" "}
                              <a
                                href="/quiz-import-template.json"
                                download="quiz-import-template.json"
                                className="underline"
                                style={{ color: "var(--accent)" }}
                              >
                                quiz-import-template.json
                              </a>
                              .
                            </p>
                            <p
                              className="text-xs font-medium uppercase tracking-wide mb-3"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Existing questions (
                              {quizDetail.questions?.length || 0})
                            </p>
                            <ul className="flex flex-col gap-3 mb-6">
                              {(quizDetail.questions || []).map((qq, idx) => (
                                <li
                                  key={qq.question_id}
                                  className="text-sm rounded p-3"
                                  style={{
                                    background: "var(--bg-hover)",
                                    border: "1px solid var(--border)",
                                  }}
                                >
                                  <span
                                    className="text-xs font-mono mr-2"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    {idx + 1}.
                                  </span>
                                  <span
                                    style={{ color: "var(--text-primary)" }}
                                  >
                                    {qq.question_text}
                                  </span>
                                  <span
                                    className="block text-xs mt-2"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    {(
                                      qq.question_types?.type_name || "mcq"
                                    ).replace("_", " ")}{" "}
                                    · {qq.points} pt
                                  </span>
                                  <ul className="mt-2 ml-4 list-disc space-y-1">
                                    {(qq.question_options || []).map((opt) => (
                                      <li
                                        key={opt.option_id}
                                        style={{
                                          color: opt.is_correct
                                            ? "var(--accent)"
                                            : "var(--text-secondary)",
                                        }}
                                      >
                                        {opt.option_text}
                                        {opt.is_correct ? " ✓" : ""}
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>

                            <form
                              onSubmit={submitQuestion}
                              className="flex flex-col gap-3"
                            >
                              <p
                                className="text-xs font-medium uppercase tracking-wide"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Add question
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className={`btn-ghost text-xs py-1 px-2 ${questionForm.question_type === "mcq" ? "ring-1 ring-[var(--accent)]" : ""}`}
                                  onClick={() => setQuestionType("mcq")}
                                >
                                  Multiple choice
                                </button>
                                <button
                                  type="button"
                                  className={`btn-ghost text-xs py-1 px-2 ${questionForm.question_type === "true_false" ? "ring-1 ring-[var(--accent)]" : ""}`}
                                  onClick={() => setQuestionType("true_false")}
                                >
                                  True / false
                                </button>
                              </div>
                              <textarea
                                className="input-field text-sm"
                                rows={2}
                                placeholder="Question"
                                value={questionForm.question_text}
                                onChange={(e) =>
                                  setQuestionForm((f) => ({
                                    ...f,
                                    question_text: e.target.value,
                                  }))
                                }
                              />
                              <div>
                                <label className="label text-xs">Points</label>
                                <input
                                  type="number"
                                  min={0.25}
                                  step={0.25}
                                  className="input-field max-w-[120px]"
                                  value={questionForm.points}
                                  onChange={(e) =>
                                    setQuestionForm((f) => ({
                                      ...f,
                                      points: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              {questionForm.question_type === "mcq" ? (
                                <div className="flex flex-col gap-2">
                                  {questionForm.options.map((opt, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2"
                                    >
                                      <label className="flex items-center gap-1.5 shrink-0 mt-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name="mcq-correct"
                                          checked={opt.is_correct}
                                          onChange={() =>
                                            updateMcqOption(
                                              idx,
                                              "is_correct",
                                              true,
                                            )
                                          }
                                        />
                                        <span
                                          className="text-xs"
                                          style={{ color: "var(--text-muted)" }}
                                        >
                                          Correct
                                        </span>
                                      </label>
                                      <input
                                        type="text"
                                        className="input-field flex-1 text-sm"
                                        placeholder={`Option ${idx + 1}`}
                                        value={opt.option_text}
                                        onChange={(e) =>
                                          updateMcqOption(
                                            idx,
                                            "option_text",
                                            e.target.value,
                                          )
                                        }
                                      />
                                      <button
                                        type="button"
                                        className="btn-ghost text-xs px-2 mt-1 shrink-0"
                                        onClick={() => removeMcqOption(idx)}
                                        disabled={
                                          questionForm.options.length <= 2
                                        }
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className="btn-ghost text-xs self-start"
                                    onClick={addMcqOption}
                                  >
                                    + Add option
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {questionForm.options.map((opt, idx) => (
                                    <label
                                      key={idx}
                                      className="flex items-center gap-2 cursor-pointer text-sm"
                                      style={{ color: "var(--text-primary)" }}
                                    >
                                      <input
                                        type="radio"
                                        name="tf-correct"
                                        checked={opt.is_correct}
                                        onChange={() =>
                                          setQuestionForm((f) => {
                                            const opts = f.options.map(
                                              (o, i) => ({
                                                ...o,
                                                is_correct: i === idx,
                                              }),
                                            );
                                            return { ...f, options: opts };
                                          })
                                        }
                                      />
                                      {opt.option_text}
                                    </label>
                                  ))}
                                </div>
                              )}

                              <button
                                type="submit"
                                className="btn-primary text-sm self-start"
                                disabled={addingQuestion}
                              >
                                {addingQuestion ? (
                                  <Spinner size={14} />
                                ) : (
                                  "Add to quiz"
                                )}
                              </button>
                            </form>

                            <div
                              className="mt-6 pt-6"
                              style={{ borderTop: "1px solid var(--border)" }}
                            >
                              <button
                                type="button"
                                className="w-full flex items-center justify-between gap-2 text-left mb-3"
                                onClick={() => setQuizImportOpen((v) => !v)}
                                style={{ color: "var(--text-primary)" }}
                                aria-expanded={quizImportOpen}
                              >
                                <span
                                  className="text-xs font-medium uppercase tracking-wide"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Import questions (JSON)
                                </span>
                                <span
                                  className="text-lg"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {quizImportOpen ? "−" : "+"}
                                </span>
                              </button>
                              {quizImportOpen && (
                                <div className="flex flex-col gap-3">
                                  <p
                                    className="text-xs"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    Paste an array of questions, or use{" "}
                                    <code className="text-[11px]">{`{ "questions": [ ... ] }`}</code>
                                    . Each needs{" "}
                                    <code className="text-[11px]">
                                      question_type
                                    </code>
                                    ,{" "}
                                    <code className="text-[11px]">
                                      question_text
                                    </code>
                                    ,{" "}
                                    <code className="text-[11px]">options</code>{" "}
                                    (min 2; one{" "}
                                    <code className="text-[11px]">
                                      is_correct: true
                                    </code>
                                    ).
                                  </p>
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <label className="btn-ghost text-xs cursor-pointer py-1.5 px-3">
                                      Choose .json file
                                      <input
                                        type="file"
                                        accept=".json,application/json"
                                        className="hidden"
                                        onChange={onQuizImportFile}
                                      />
                                    </label>
                                  </div>
                                  <textarea
                                    className="input-field text-xs font-mono"
                                    rows={10}
                                    placeholder='[ { "question_type": "mcq", "question_text": "...", "points": 1, "options": [ ... ] } ]'
                                    value={quizImportText}
                                    onChange={(e) =>
                                      setQuizImportText(e.target.value)
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="btn-primary text-sm self-start"
                                    disabled={importingQuizBatch}
                                    onClick={runQuizImport}
                                  >
                                    {importingQuizBatch ? (
                                      <Spinner size={14} />
                                    ) : (
                                      "Import into this quiz"
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
