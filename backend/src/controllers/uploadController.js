const { supabase } = require("../db/connection");
const {
  uploadToS3,
  deleteFromS3,
  keyFromUrl,
} = require("../middleware/upload");

// ── GET /api/v1/uploads/courses/:courseId/files ───────────────────────────────
async function listCourseFiles(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);

    const { data, error } = await supabase
      .from("course_files")
      .select("file_id, file_name, file_url, mime_type, file_size, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/uploads/avatar ───────────────────────────────────────────────
// Uploads an image to S3 and updates users.avatar_url
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Fetch old avatar URL so we can delete from S3 after success
    const { data: user } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      folder: `avatars/${req.user.user_id}`,
    });

    const { error } = await supabase
      .from("users")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("user_id", req.user.user_id);

    if (error) {
      // Roll back the S3 upload if DB fails
      await deleteFromS3(key);
      throw new Error(error.message);
    }

    // Delete the old avatar from S3 (best-effort)
    const oldKey = keyFromUrl(user?.avatar_url);
    if (oldKey && !oldKey.includes("default")) await deleteFromS3(oldKey);

    res.json({ avatar_url: url });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/uploads/courses/:courseId/thumbnail ─────────────────────────
// Uploads a course thumbnail to S3 and updates courses.thumbnail_url
async function uploadThumbnail(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const courseId = Number(req.params.courseId);

    // Verify the instructor owns this course (admin bypasses)
    const { data: course } = await supabase
      .from("courses")
      .select("course_id, thumbnail_url, instructors ( user_id )")
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!course) return res.status(404).json({ error: "Course not found" });

    if (
      req.user.role !== "admin" &&
      course.instructors?.user_id !== req.user.user_id
    ) {
      return res.status(403).json({ error: "Not your course" });
    }

    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      folder: `thumbnails/course-${courseId}`,
    });

    const { error } = await supabase
      .from("courses")
      .update({ thumbnail_url: url, updated_at: new Date().toISOString() })
      .eq("course_id", courseId);

    if (error) {
      await deleteFromS3(key);
      throw new Error(error.message);
    }

    // Remove old thumbnail (best-effort)
    const oldKey = keyFromUrl(course.thumbnail_url);
    if (oldKey) await deleteFromS3(oldKey);

    res.json({ thumbnail_url: url });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/uploads/courses/:courseId/files ──────────────────────────────
// Uploads a course content file (PDF, video, etc.) and stores metadata in DB
async function uploadCourseFile(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const courseId = Number(req.params.courseId);

    // Verify ownership
    const { data: course } = await supabase
      .from("courses")
      .select("course_id, instructors ( user_id )")
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!course) return res.status(404).json({ error: "Course not found" });

    if (
      req.user.role !== "admin" &&
      course.instructors?.user_id !== req.user.user_id
    ) {
      return res.status(403).json({ error: "Not your course" });
    }

    const { url, key } = await uploadToS3({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      folder: `course-files/course-${courseId}`,
    });

    // Store file metadata in course_files table
    const { data: fileRecord, error } = await supabase
      .from("course_files")
      .insert({
        course_id: courseId,
        file_name: req.file.originalname,
        file_url: url,
        s3_key: key,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        uploaded_by: req.user.user_id,
      })
      .select("file_id, file_name, file_url, mime_type, file_size, created_at")
      .single();

    if (error) {
      await deleteFromS3(key);
      throw new Error(error.message);
    }

    res.status(201).json(fileRecord);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/uploads/courses/:courseId/files/:fileId ───────────────────
async function deleteCourseFile(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);
    const fileId = Number(req.params.fileId);

    const { data: file } = await supabase
      .from("course_files")
      .select("file_id, s3_key, courses ( instructors ( user_id ) )")
      .eq("file_id", fileId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!file) return res.status(404).json({ error: "File not found" });

    if (
      req.user.role !== "admin" &&
      file.courses?.instructors?.user_id !== req.user.user_id
    ) {
      return res.status(403).json({ error: "Not your course" });
    }

    await deleteFromS3(file.s3_key);

    const { error } = await supabase
      .from("course_files")
      .delete()
      .eq("file_id", fileId);

    if (error) throw new Error(error.message);

    res.json({ message: "File deleted" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCourseFiles,
  uploadAvatar,
  uploadThumbnail,
  uploadCourseFile,
  deleteCourseFile,
};
