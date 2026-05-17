const { supabase } = require("../db/connection");

// ── Helper: verify instructor owns the course ─────────────────────────────────
async function instructorOwnsCourse(courseId, userId) {
  const { data: instructor } = await supabase
    .from("instructors")
    .select("instructor_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!instructor) return false;

  const { data: course } = await supabase
    .from("courses")
    .select("course_id")
    .eq("course_id", courseId)
    .eq("instructor_id", instructor.instructor_id)
    .is("deleted_at", null)
    .maybeSingle();

  return !!course;
}

// ── GET /api/v1/sections/course/:courseId ─────────────────────────────────────
// Public — returns all sections with their content items ordered by sort_order
async function getSectionsByCourse(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);

    const { data: sections, error } = await supabase
      .from("sections")
      .select(
        `
        section_id, title, sort_order, created_at,
        content (
          content_id, title, content_url, duration_sec,
          sort_order, is_free_preview,
          content_types ( type_name )
        )
      `,
      )
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    // Sort content within each section by sort_order
    const sorted = (sections || []).map((s) => ({
      ...s,
      content: (s.content || []).sort((a, b) => a.sort_order - b.sort_order),
    }));

    res.json(sorted);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/sections/course/:courseId ────────────────────────────────────
// Instructor only — create a new section
async function createSection(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);
    const { title, sort_order } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Section title is required" });
    }

    if (req.user.role !== "admin") {
      const owns = await instructorOwnsCourse(courseId, req.user.user_id);
      if (!owns) return res.status(403).json({ error: "Not your course" });
    }

    const { data, error } = await supabase
      .from("sections")
      .insert({
        course_id: courseId,
        title: title.trim(),
        sort_order: sort_order ?? 0,
      })
      .select("section_id")
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ section_id: data.section_id });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/sections/:sectionId ────────────────────────────────────────
// Instructor only — update title or sort_order
async function updateSection(req, res, next) {
  try {
    const sectionId = Number(req.params.sectionId);

    // Resolve section → course for ownership check
    const { data: section } = await supabase
      .from("sections")
      .select("course_id")
      .eq("section_id", sectionId)
      .maybeSingle();

    if (!section) return res.status(404).json({ error: "Section not found" });

    if (req.user.role !== "admin") {
      const owns = await instructorOwnsCourse(
        section.course_id,
        req.user.user_id,
      );
      if (!owns) return res.status(403).json({ error: "Not your course" });
    }

    const updates = {};
    const { title, sort_order } = req.body;
    if (title !== undefined) updates.title = title.trim();
    if (sort_order !== undefined) updates.sort_order = sort_order;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { error } = await supabase
      .from("sections")
      .update(updates)
      .eq("section_id", sectionId);

    if (error) throw new Error(error.message);
    res.json({ message: "Section updated" });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/sections/:sectionId ───────────────────────────────────────
// Instructor / admin — delete a section (content rows get section_id = NULL via ON DELETE SET NULL)
async function deleteSection(req, res, next) {
  try {
    const sectionId = Number(req.params.sectionId);

    const { data: section } = await supabase
      .from("sections")
      .select("course_id")
      .eq("section_id", sectionId)
      .maybeSingle();

    if (!section) return res.status(404).json({ error: "Section not found" });

    if (req.user.role !== "admin") {
      const owns = await instructorOwnsCourse(
        section.course_id,
        req.user.user_id,
      );
      if (!owns) return res.status(403).json({ error: "Not your course" });
    }

    const { error } = await supabase
      .from("sections")
      .delete()
      .eq("section_id", sectionId);

    if (error) throw new Error(error.message);
    res.json({ message: "Section deleted — its lessons are now unsectioned" });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/sections/content/:contentId/assign ─────────────────────────
// Instructor only — assign or unassign a content item to a section
async function assignContentToSection(req, res, next) {
  try {
    const contentId = Number(req.params.contentId);
    const { section_id } = req.body; // null = remove from section

    // Resolve content → course for ownership check
    const { data: content } = await supabase
      .from("content")
      .select("course_id")
      .eq("content_id", contentId)
      .maybeSingle();

    if (!content) return res.status(404).json({ error: "Content not found" });

    if (req.user.role !== "admin") {
      const owns = await instructorOwnsCourse(
        content.course_id,
        req.user.user_id,
      );
      if (!owns) return res.status(403).json({ error: "Not your course" });
    }

    // If assigning to a section, verify section belongs to the same course
    if (section_id !== null && section_id !== undefined) {
      const { data: sec } = await supabase
        .from("sections")
        .select("course_id")
        .eq("section_id", section_id)
        .maybeSingle();

      if (!sec) return res.status(404).json({ error: "Section not found" });
      if (sec.course_id !== content.course_id) {
        return res
          .status(400)
          .json({ error: "Section belongs to a different course" });
      }
    }

    const { error } = await supabase
      .from("content")
      .update({ section_id: section_id ?? null })
      .eq("content_id", contentId);

    if (error) throw new Error(error.message);
    res.json({
      message: section_id
        ? "Content assigned to section"
        : "Content removed from section",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSectionsByCourse,
  createSection,
  updateSection,
  deleteSection,
  assignContentToSection,
};
