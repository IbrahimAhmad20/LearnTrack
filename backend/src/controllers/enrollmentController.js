const { supabase } = require('../db/connection');

// ── GET /api/v1/enrollments/my ────────────────────────────────────────────────
// Student sees all courses they are enrolled in
async function getMyEnrollments(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        enrollment_id, enrolled_at,
        enrollment_statuses ( status_name ),
        courses (
          course_id, title, description, category, thumbnail_url,
          instructors ( users ( full_name ) )
        )
      `)
      .eq('user_id', req.user.user_id)
      .order('enrolled_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/enrollments/:courseId ───────────────────────────────────────
// Student enrolls in a course
async function enroll(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);
    const userId   = req.user.user_id;

    // Course must exist and be published
    const { data: course } = await supabase
      .from('courses')
      .select('course_id, is_published')
      .eq('course_id', courseId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!course)            return res.status(404).json({ error: 'Course not found' });
    if (!course.is_published) return res.status(400).json({ error: 'Course is not open for enrollment' });

    // Prevent duplicate enrollments
    const { data: existing } = await supabase
      .from('enrollments')
      .select('enrollment_id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Already enrolled in this course' });

    // Resolve 'active' status_id from lookup table
    const { data: statusRow } = await supabase
      .from('enrollment_statuses')
      .select('status_id')
      .eq('status_name', 'active')
      .single();

    const { data, error } = await supabase
      .from('enrollments')
      .insert({ user_id: userId, course_id: courseId, status_id: statusRow.status_id })
      .select('enrollment_id')
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ enrollment_id: data.enrollment_id });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/enrollments/:enrollmentId/status ───────────────────────────
// Student can drop their own enrollment; admin can set any status
async function updateEnrollmentStatus(req, res, next) {
  try {
    const enrollmentId = Number(req.params.enrollmentId);
    const { status_name } = req.body;

    // Students can only update their own enrollments
    if (req.user.role === 'student') {
      const { data: own } = await supabase
        .from('enrollments')
        .select('enrollment_id')
        .eq('enrollment_id', enrollmentId)
        .eq('user_id', req.user.user_id)
        .maybeSingle();

      if (!own) return res.status(403).json({ error: 'Not your enrollment' });
    }

    // Resolve status name → status_id
    const { data: statusRow, error: sErr } = await supabase
      .from('enrollment_statuses')
      .select('status_id')
      .eq('status_name', status_name)
      .maybeSingle();

    if (sErr || !statusRow) {
      return res.status(400).json({ error: `Unknown status: "${status_name}". Valid: active, completed, dropped` });
    }

    const { error } = await supabase
      .from('enrollments')
      .update({ status_id: statusRow.status_id })
      .eq('enrollment_id', enrollmentId);

    if (error) throw new Error(error.message);
    res.json({ message: 'Enrollment status updated' });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/enrollments/:enrollmentId  (admin only) ───────────────────
async function unenroll(req, res, next) {
  try {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('enrollment_id', Number(req.params.enrollmentId));

    if (error) throw new Error(error.message);
    res.json({ message: 'Enrollment removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyEnrollments, enroll, updateEnrollmentStatus, unenroll };
