const { supabase } = require("../db/connection");

// ── GET /api/v1/courses ───────────────────────────────────────────────────────
async function listCourses(req, res, next) {
  try {
    const { category, search } = req.query;

    let q = supabase
      .from("courses")
      .select(
        `
        course_id, title, description, category,
        is_published, created_at,
        instructors (
          instructor_id,
          users ( full_name )
        )
      `,
      )
      .eq("is_published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (category) q = q.ilike("category", category);
    if (search)
      q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/courses/mine ───────────────────────────────────────────────────
// Courses owned by the logged-in instructor (or admin tied to one instructor row).
// Not the same as GET /courses (public catalogue of published courses).
async function listMyCourses(req, res, next) {
  try {
    const { data: instructor, error: instErr } = await supabase
      .from("instructors")
      .select("instructor_id")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (instErr) throw new Error(instErr.message);
    if (!instructor) return res.json([]);

    const { data, error } = await supabase
      .from("courses")
      .select(
        `
        course_id, title, description, category,
        is_published, created_at,
        instructors (
          instructor_id,
          users ( full_name )
        )
      `,
      )
      .eq("instructor_id", instructor.instructor_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/courses/:id ───────────────────────────────────────────────────
// NEW: single course detail with full content + quiz list
async function getCourse(req, res, next) {
  try {
    const courseId = Number(req.params.id);

    const { data: course, error } = await supabase
      .from("courses")
      .select(
        `
        course_id, title, description, category, thumbnail_url,
        is_published, created_at, updated_at,
        instructors (
          instructor_id,
          department,
          qualification,
          users ( full_name, bio, avatar_url )
        )
      `,
      )
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .single();

    if (error || !course)
      return res.status(404).json({ error: "Course not found" });

    // Only return unpublished courses to instructors/admins
    if (
      !course.is_published &&
      !["instructor", "admin"].includes(req.user.role)
    ) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Fetch content list
    const { data: content } = await supabase
      .from("content")
      .select(
        "content_id, title, content_url, content_body, duration_sec, sort_order, is_published, content_types(type_name)",
      )
      .eq("course_id", courseId)
      .order("sort_order");

    // Fetch quizzes for this course
    const { data: quizzesRaw } = await supabase
      .from("quiz")
      .select(
        "quiz_id, title, time_limit_min, pass_score, allow_multiple, is_published",
      )
      .eq("course_id", courseId)
      .order("created_at");

    let quizzes = quizzesRaw || [];
    if (req.user.role === "student") {
      quizzes = quizzes.filter((q) => q.is_published);
    }

    res.json({ ...course, content: content || [], quizzes });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/courses ──────────────────────────────────────────────────────
async function createCourse(req, res, next) {
  try {
    const { title, description, category, is_published = false } = req.body;

    let instructorId;

    if (req.user.role === 'admin') {
      // Admins can create courses without an instructors row.
      // Use their user entry from the instructors table if one exists,
      // otherwise find or create one.
      const { data: existing } = await supabase
        .from('instructors')
        .select('instructor_id')
        .eq('user_id', req.user.user_id)
        .maybeSingle();

      if (existing) {
        instructorId = existing.instructor_id;
      } else {
        const { data: created, error: cErr } = await supabase
          .from('instructors')
          .insert({ user_id: req.user.user_id })
          .select('instructor_id')
          .single();
        if (cErr) {
          console.error('createCourse admin instructors insert error:', `code=${cErr.code} msg=${cErr.message} details=${cErr.details} hint=${cErr.hint}`);
          // If trigger rejected it (e.g. user row not yet visible), return 403 not 500
          return res.status(403).json({ error: 'Could not create instructor profile for admin: ' + cErr.message });
        }
        instructorId = created.instructor_id;
      }
    } else {
      // Instructor path: look up their instructors row.
      // If missing (timing race during registration), create it here as a self-heal.
      let { data: instructor, error: instErr } = await supabase
        .from('instructors')
        .select('instructor_id')
        .eq('user_id', req.user.user_id)
        .maybeSingle();

      if (!instructor) {
        console.warn(`createCourse: no instructors row for user_id=${req.user.user_id} (${instErr?.message || 'not found'}), attempting self-heal insert`);
        const { data: created, error: createErr } = await supabase
          .from('instructors')
          .insert({ user_id: req.user.user_id })
          .select('instructor_id')
          .single();

        if (createErr) {
          console.warn(`createCourse self-heal insert failed: code=${createErr.code} msg=${createErr.message} details=${createErr.details}`);
          // If it's a duplicate (race between retries), try reading again
          if (createErr.code === '23505') {
            const { data: retry } = await supabase
              .from('instructors')
              .select('instructor_id')
              .eq('user_id', req.user.user_id)
              .maybeSingle();
            instructor = retry;
          }
        } else {
          instructor = created;
        }
      }

      if (!instructor) {
        return res.status(403).json({
          error: 'You must be a registered instructor to create courses',
        });
      }
      instructorId = instructor.instructor_id;
    }

    const { data, error } = await supabase
      .from('courses')
      .insert({
        instructor_id: instructorId,
        title,
        description,
        category,
        is_published,
      })
      .select('course_id')
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ course_id: data.course_id });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/v1/courses/:id ───────────────────────────────────────────────────
async function updateCourse(req, res, next) {
  try {
    const { title, description, category, is_published, thumbnail_url } =
      req.body;
    const id = Number(req.params.id);

    if (req.user.role === "instructor") {
      let { data: instructor } = await supabase
        .from("instructors")
        .select("instructor_id")
        .eq("user_id", req.user.user_id)
        .maybeSingle();

      // Self-heal: if instructor profile is missing, create it and retry lookup.
      if (!instructor) {
        const { data: created, error: createErr } = await supabase
          .from("instructors")
          .insert({ user_id: req.user.user_id })
          .select("instructor_id")
          .maybeSingle();

        if (!createErr && created) {
          instructor = created;
        } else if (createErr?.code === "23505") {
          const { data: retry } = await supabase
            .from("instructors")
            .select("instructor_id")
            .eq("user_id", req.user.user_id)
            .maybeSingle();
          instructor = retry;
        }
      }

      if (!instructor)
        return res.status(403).json({ error: "Not a registered instructor" });

      const { data: own } = await supabase
        .from("courses")
        .select("course_id")
        .eq("course_id", id)
        .eq("instructor_id", instructor.instructor_id)
        .is("deleted_at", null)
        .single();

      if (!own) return res.status(403).json({ error: "Not your course" });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (is_published !== undefined) updates.is_published = is_published;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;

    const { error } = await supabase
      .from("courses")
      .update(updates)
      .eq("course_id", id)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);
    res.json({ message: "Course updated" });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/courses/:id  (admin only) ─────────────────────────────────
async function deleteCourse(req, res, next) {
  try {
    const { error } = await supabase
      .from("courses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("course_id", Number(req.params.id));

    if (error) throw new Error(error.message);
    res.json({ message: "Course deleted" });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/courses/:id/content ──────────────────────────────────────────
async function getCourseContent(req, res, next) {
  try {
    const { data, error } = await supabase
      .from("content")
      .select(
        "content_id, title, content_url, content_body, duration_sec, sort_order, is_published, content_types(type_id, type_name)",
      )
      .eq("course_id", Number(req.params.id))
      .order("sort_order");

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/courses/:id/content ─────────────────────────────────────────
async function addContent(req, res, next) {
  try {
    const {
      title,
      content_type,
      content_url,
      content_body,
      duration_sec,
      sort_order = 0,
      is_published = false,
    } = req.body;

    const { data: typeRow, error: typeErr } = await supabase
      .from("content_types")
      .select("type_id")
      .eq("type_name", content_type)
      .single();

    if (typeErr || !typeRow) {
      return res.status(400).json({
        error: `Unknown content type: "${content_type}". Valid values: video, document, quiz`,
      });
    }

    const { data, error } = await supabase
      .from("content")
      .insert({
        course_id: Number(req.params.id),
        content_type_id: typeRow.type_id,
        title,
        content_url: content_url || null,
        content_body: content_body || null,
        duration_sec: duration_sec || null,
        sort_order,
        is_published,
      })
      .select("content_id")
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ content_id: data.content_id });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/v1/courses/:id/content/:contentId ───────────────────────────────
// NEW: edit a content item (title, sort_order, duration, publish toggle)
async function updateContent(req, res, next) {
  try {
    const courseId = Number(req.params.id);
    const contentId = Number(req.params.contentId);
    const {
      title,
      sort_order,
      duration_sec,
      is_published,
      content_type,
      content_url,
      content_body,
    } =
      req.body;

    // Confirm content belongs to this course
    const { data: existing } = await supabase
      .from("content")
      .select("content_id")
      .eq("content_id", contentId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!existing)
      return res
        .status(404)
        .json({ error: "Content item not found in this course" });

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (sort_order !== undefined) updates.sort_order = Number(sort_order);
    if (duration_sec !== undefined) updates.duration_sec = duration_sec || null;
    if (is_published !== undefined) updates.is_published = is_published;
    if (content_url !== undefined) updates.content_url = content_url || null;
    if (content_body !== undefined) updates.content_body = content_body || null;

    // Allow changing content type
    if (content_type !== undefined) {
      const { data: typeRow, error: typeErr } = await supabase
        .from("content_types")
        .select("type_id")
        .eq("type_name", content_type)
        .single();

      if (typeErr || !typeRow) {
        return res
          .status(400)
          .json({ error: `Unknown content type: "${content_type}"` });
      }
      updates.content_type_id = typeRow.type_id;
    }

    const { error } = await supabase
      .from("content")
      .update(updates)
      .eq("content_id", contentId);

    if (error) throw new Error(error.message);
    res.json({ message: "Content updated" });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/courses/:id/content/:contentId ────────────────────────────
// NEW: remove a content item from a course
async function deleteContent(req, res, next) {
  try {
    const courseId = Number(req.params.id);
    const contentId = Number(req.params.contentId);

    // Confirm content belongs to this course before deleting
    const { data: existing } = await supabase
      .from("content")
      .select("content_id")
      .eq("content_id", contentId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!existing)
      return res
        .status(404)
        .json({ error: "Content item not found in this course" });

    const { error } = await supabase
      .from("content")
      .delete()
      .eq("content_id", contentId);

    if (error) throw new Error(error.message);
    res.json({ message: "Content deleted" });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/courses/:id/students  (instructor + admin) ───────────────────
// NEW: list all students enrolled in a course with their progress and status
async function getCourseStudents(req, res, next) {
  try {
    const courseId = Number(req.params.id);

    // Instructors can only view students in their own courses
    if (req.user.role === "instructor") {
      const { data: instructor } = await supabase
        .from("instructors")
        .select("instructor_id")
        .eq("user_id", req.user.user_id)
        .single();

      const { data: own } = await supabase
        .from("courses")
        .select("course_id")
        .eq("course_id", courseId)
        .eq("instructor_id", instructor?.instructor_id)
        .maybeSingle();

      if (!own) return res.status(403).json({ error: "Not your course" });
    }

    const { data, error } = await supabase
      .from("enrollments")
      .select(
        `
        enrollment_id, enrolled_at,
        enrollment_statuses ( status_name ),
        users (
          user_id, full_name, email, avatar_url
        )
      `,
      )
      .eq("course_id", courseId)
      .order("enrolled_at", { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCourses,
  listMyCourses,
  getCourse, // new
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseContent,
  addContent,
  updateContent, // new
  deleteContent, // new
  getCourseStudents, // new
};
