const { supabase } = require("../db/connection");

// ── GET /api/v1/instructors/me ────────────────────────────────────────────────
async function getMyProfile(req, res, next) {
  try {
    const userId = req.user.user_id;

    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("user_id, full_name, email, bio, avatar_url, created_at")
      .eq("user_id", userId)
      .single();

    if (uErr || !user) return res.status(404).json({ error: "User not found" });

    const { data: instructor, error: iErr } = await supabase
      .from("instructors")
      .select("instructor_id, department, qualification, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (iErr) throw new Error(iErr.message);
    if (!instructor)
      return res.status(404).json({ error: "No instructor profile found" });

    const { data: courses } = await supabase
      .from("courses")
      .select(
        `
        course_id, title, description, thumbnail_url,
        is_published, created_at, avg_rating, review_count,
        categories ( name ),
        enrollments ( enrollment_id )
      `,
      )
      .eq("instructor_id", instructor.instructor_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const enrichedCourses = (courses || []).map((c) => ({
      course_id: c.course_id,
      title: c.title,
      description: c.description,
      thumbnail_url: c.thumbnail_url,
      is_published: c.is_published,
      created_at: c.created_at,
      avg_rating: Number(c.avg_rating) || 0,
      review_count: c.review_count || 0,
      enrollment_count: (c.enrollments || []).length,
      category: c.categories?.name || null,
    }));

    const totalStudents = enrichedCourses.reduce(
      (s, c) => s + c.enrollment_count,
      0,
    );

    res.json({
      ...user,
      instructor_id: instructor.instructor_id,
      department: instructor.department,
      qualification: instructor.qualification,
      member_since: instructor.created_at,
      stats: {
        total_courses: enrichedCourses.length,
        total_students: totalStudents,
        avg_rating: enrichedCourses.length
          ? (
              enrichedCourses.reduce((s, c) => s + c.avg_rating, 0) /
              enrichedCourses.length
            ).toFixed(1)
          : null,
      },
      courses: enrichedCourses,
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/v1/instructors/me ────────────────────────────────────────────────
async function updateMyProfile(req, res, next) {
  try {
    const { department, qualification } = req.body;

    const updates = {};
    if (department !== undefined)
      updates.department =
        department === null ? null : String(department).trim() || null;
    if (qualification !== undefined)
      updates.qualification =
        qualification === null ? null : String(qualification).trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("instructors")
      .update(updates)
      .eq("user_id", req.user.user_id)
      .select("instructor_id, department, qualification")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data)
      return res.status(404).json({ error: "No instructor profile found" });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/instructors/:instructorId/public ──────────────────────────────
async function getPublicProfile(req, res, next) {
  try {
    const instructorId = Number(req.params.instructorId);

    const { data: instructor, error: iErr } = await supabase
      .from("instructors")
      .select(
        `
        instructor_id, department, qualification, created_at,
        users ( full_name, bio, avatar_url )
      `,
      )
      .eq("instructor_id", instructorId)
      .maybeSingle();

    if (iErr) throw new Error(iErr.message);
    if (!instructor)
      return res.status(404).json({ error: "Instructor not found" });

    const { data: courses } = await supabase
      .from("courses")
      .select(
        `
        course_id, title, description, thumbnail_url,
        avg_rating, review_count,
        categories ( name ),
        enrollments ( enrollment_id )
      `,
      )
      .eq("instructor_id", instructorId)
      .eq("is_published", true)
      .is("deleted_at", null)
      .order("avg_rating", { ascending: false });

    const enrichedCourses = (courses || []).map((c) => ({
      course_id: c.course_id,
      title: c.title,
      description: c.description,
      thumbnail_url: c.thumbnail_url,
      avg_rating: Number(c.avg_rating) || 0,
      review_count: c.review_count || 0,
      enrollment_count: (c.enrollments || []).length,
      category: c.categories?.name || null,
    }));

    res.json({
      instructor_id: instructor.instructor_id,
      full_name: instructor.users?.full_name,
      bio: instructor.users?.bio,
      avatar_url: instructor.users?.avatar_url,
      department: instructor.department,
      qualification: instructor.qualification,
      member_since: instructor.created_at,
      stats: {
        total_courses: enrichedCourses.length,
        total_students: enrichedCourses.reduce(
          (s, c) => s + c.enrollment_count,
          0,
        ),
        avg_rating: enrichedCourses.length
          ? (
              enrichedCourses.reduce((s, c) => s + c.avg_rating, 0) /
              enrichedCourses.length
            ).toFixed(1)
          : null,
      },
      courses: enrichedCourses,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProfile, updateMyProfile, getPublicProfile };
