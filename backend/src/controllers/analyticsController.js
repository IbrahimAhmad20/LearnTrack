const { supabase } = require('../db/connection');

// ── Shared: courses owned by the logged-in instructor's profile ──────────────
async function getInstructorCourseIds(userId) {
  const { data: instructor, error: instErr } = await supabase
    .from('instructors')
    .select('instructor_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (instErr) throw new Error(instErr.message);
  if (!instructor?.instructor_id) return [];

  const { data, error } = await supabase
    .from('courses')
    .select('course_id')
    .eq('instructor_id', instructor.instructor_id)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
  return (data || []).map((c) => c.course_id);
}

async function instructorOwnsCourse(userId, courseId) {
  const { data: instructor, error } = await supabase
    .from('instructors')
    .select('instructor_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!instructor?.instructor_id) return false;

  const { data: course, error: cErr } = await supabase
    .from('courses')
    .select('course_id')
    .eq('course_id', courseId)
    .eq('instructor_id', instructor.instructor_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (cErr) throw new Error(cErr.message);
  return Boolean(course);
}

/** Aggregate watch time only for learners enrolled in those courses watching content belonging to those courses. */
async function aggregateActiveStudentsForCourses(courseIds, { start, end } = {}) {
  if (!courseIds.length) return [];

  const { data: contentRows, error: cErr } = await supabase
    .from('content')
    .select('content_id, course_id')
    .in('course_id', courseIds);

  if (cErr) throw new Error(cErr.message);
  const contents = contentRows || [];
  const contentIds = contents.map((c) => c.content_id);
  if (!contentIds.length) return [];

  const contentIdToCourse = Object.fromEntries(contents.map((c) => [c.content_id, c.course_id]));

  const { data: enrollRows, error: eErr } = await supabase
    .from('enrollments')
    .select('user_id, course_id')
    .in('course_id', courseIds);

  if (eErr) throw new Error(eErr.message);
  const allowedPairs = new Set(
    (enrollRows || []).map((e) => `${e.user_id}|${e.course_id}`),
  );

  let q = supabase
    .from('activity_log')
    .select('user_id, watch_time, content_id, event_at, users!inner(full_name, role)')
    .eq('users.role', 'student')
    .in('content_id', contentIds);

  if (start) q = q.gte('event_at', start);
  if (end) q = q.lte('event_at', end);

  const { data: logs, error: lErr } = await q;
  if (lErr) throw new Error(lErr.message);

  const totals = {};
  for (const row of logs || []) {
    const courseId = contentIdToCourse[row.content_id];
    if (courseId == null) continue;
    if (!allowedPairs.has(`${row.user_id}|${courseId}`)) continue;

    const uid = row.user_id;
    if (!totals[uid]) {
      totals[uid] = {
        user_id: uid,
        full_name: row.users.full_name,
        total_watch_sec: 0,
      };
    }
    totals[uid].total_watch_sec += Number(row.watch_time) || 0;
  }

  return Object.values(totals)
    .sort((a, b) => b.total_watch_sec - a.total_watch_sec)
    .slice(0, 20);
}

async function underperformingForCourses(courseIds, threshold) {
  if (!courseIds.length) return [];

  const { data: quizRows, error: qErr } = await supabase
    .from('quiz')
    .select('quiz_id, course_id')
    .in('course_id', courseIds);

  if (qErr) throw new Error(qErr.message);
  const quizzes = quizRows || [];
  const quizIds = quizzes.map((q) => q.quiz_id);
  if (!quizIds.length) return [];

  const quizToCourse = Object.fromEntries(quizzes.map((q) => [q.quiz_id, q.course_id]));

  const { data: enrollRows, error: eErr } = await supabase
    .from('enrollments')
    .select('user_id, course_id')
    .in('course_id', courseIds);

  if (eErr) throw new Error(eErr.message);
  const allowed = new Set((enrollRows || []).map((e) => `${e.user_id}|${e.course_id}`));

  const { data: attempts, error: aErr } = await supabase
    .from('quiz_attempts')
    .select('user_id, score, quiz_id, users!inner(full_name, role)')
    .eq('users.role', 'student')
    .in('quiz_id', quizIds);

  if (aErr) throw new Error(aErr.message);

  const buckets = {};
  for (const row of attempts || []) {
    const cid = quizToCourse[row.quiz_id];
    if (cid == null) continue;
    if (!allowed.has(`${row.user_id}|${cid}`)) continue;
    const uid = row.user_id;
    if (!buckets[uid]) {
      buckets[uid] = {
        user_id: uid,
        full_name: row.users.full_name,
        scores: [],
      };
    }
    buckets[uid].scores.push(Number(row.score));
  }

  return Object.values(buckets)
    .map((b) => ({
      user_id: b.user_id,
      full_name: b.full_name,
      avg_score: b.scores.reduce((s, x) => s + x, 0) / b.scores.length,
      attempts_count: b.scores.length,
    }))
    .filter((r) => r.avg_score < threshold)
    .sort((a, b) => a.avg_score - b.avg_score);
}

async function skippedContentForCourses(courseIds, limit = 20) {
  let q = supabase
    .from('mv_skipped_content')
    .select('content_id, title, course_id, skip_count')
    .in('course_id', courseIds)
    .order('skip_count', { ascending: false })
    .limit(limit);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

// ── GET /api/v1/analytics/active-students ─────────────────────────────────────
async function activeStudents(req, res, next) {
  try {
    const { start, end } = req.query;

    if (req.user.role === 'instructor') {
      let courseIds = await getInstructorCourseIds(req.user.user_id);
      if (!courseIds.length) return res.json([]);
      if (req.query.course_id) {
        const want = Number(req.query.course_id);
        if (!courseIds.includes(want)) {
          return res.status(403).json({ error: 'Not authorized for this course' });
        }
        courseIds = [want];
      }
      const rows = await aggregateActiveStudentsForCourses(courseIds, { start, end });
      return res.json(rows);
    }

    // Admin: platform-wide — date range uses raw activity_log; default uses MV
    if (start || end) {
      let q = supabase
        .from('activity_log')
        .select('user_id, watch_time, users!inner(full_name, role)')
        .eq('users.role', 'student');

      if (start) q = q.gte('event_at', start);
      if (end) q = q.lte('event_at', end);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const totals = {};
      data.forEach((row) => {
        const uid = row.user_id;
        if (!totals[uid]) {
          totals[uid] = {
            user_id: uid,
            full_name: row.users.full_name,
            total_watch_sec: 0,
          };
        }
        totals[uid].total_watch_sec += row.watch_time;
      });

      return res.json(
        Object.values(totals)
          .sort((a, b) => b.total_watch_sec - a.total_watch_sec)
          .slice(0, 20),
      );
    }

    const { data, error } = await supabase
      .from('mv_active_students')
      .select('user_id, full_name, total_watch_sec')
      .order('total_watch_sec', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/analytics/underperforming ─────────────────────────────────────
async function underperforming(req, res, next) {
  try {
    const threshold = Number(req.query.threshold) || 50;

    if (req.user.role === 'instructor') {
      let courseIds = await getInstructorCourseIds(req.user.user_id);
      if (req.query.course_id) {
        const want = Number(req.query.course_id);
        if (!courseIds.includes(want)) {
          return res.status(403).json({ error: 'Not authorized for this course' });
        }
        courseIds = [want];
      }
      const rows = await underperformingForCourses(courseIds, threshold);
      return res.json(rows);
    }

    const { data, error } = await supabase
      .from('mv_underperforming_students')
      .select('user_id, full_name, avg_score, attempts_count')
      .lt('avg_score', threshold)
      .order('avg_score', { ascending: true });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/analytics/skipped-content ─────────────────────────────────────
async function skippedContent(req, res, next) {
  try {
    const { course_id } = req.query;

    if (req.user.role === 'instructor') {
      const mine = await getInstructorCourseIds(req.user.user_id);
      if (!mine.length) return res.json([]);
      let filterIds = mine;
      if (course_id) {
        const want = Number(course_id);
        if (!mine.includes(want)) {
          return res.status(403).json({ error: 'Not authorized for this course' });
        }
        filterIds = [want];
      }
      const rows = await skippedContentForCourses(filterIds, 20);
      return res.json(rows);
    }

    let q = supabase
      .from('mv_skipped_content')
      .select('content_id, title, course_id, skip_count')
      .order('skip_count', { ascending: false })
      .limit(20);

    if (course_id) q = q.eq('course_id', Number(course_id));
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/analytics/completion-rates ────────────────────────────────────
async function completionRates(req, res, next) {
  try {
    const { course_id } = req.query;

    let q = supabase
      .from('mv_completion_rates')
      .select('user_id, full_name, course_id, avg_completion_pct')
      .order('avg_completion_pct', { ascending: false });

    if (req.user.role === 'instructor') {
      const mine = await getInstructorCourseIds(req.user.user_id);
      if (!mine.length) return res.json([]);
      if (course_id) {
        const want = Number(course_id);
        if (!mine.includes(want)) {
          return res.status(403).json({ error: 'Not authorized for this course' });
        }
        q = q.eq('course_id', want);
      } else {
        q = q.in('course_id', mine);
      }
    } else if (course_id) {
      q = q.eq('course_id', Number(course_id));
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/analytics/performance-trend/:userId ──────────────────────────
async function performanceTrend(req, res, next) {
  try {
    const userId = req.params.userId; // UUID — do NOT cast to Number

    if (req.user.role === 'student' && req.user.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let q = supabase
      .from('quiz_attempts')
      .select('score, passed, attempt_date, users(full_name), quiz(title)')
      .eq('user_id', userId)
      .order('attempt_date', { ascending: true });

    if (req.user.role === 'instructor') {
      const courseIds = await getInstructorCourseIds(req.user.user_id);
      if (!courseIds.length) return res.json([]);

      const { data: enr, error: enrErr } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', userId)
        .in('course_id', courseIds);

      if (enrErr) throw new Error(enrErr.message);
      if (!enr || enr.length === 0) return res.json([]);

      const { data: qRows, error: quizErr } = await supabase
        .from('quiz')
        .select('quiz_id')
        .in('course_id', courseIds);

      if (quizErr) throw new Error(quizErr.message);
      const quizIds = (qRows || []).map((x) => x.quiz_id);
      if (!quizIds.length) return res.json([]);

      q = q.in('quiz_id', quizIds);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/analytics/dashboard/admin ────────────────────────────────────
async function adminDashboard(req, res, next) {
  try {
    const [
      usersRes,
      coursesRes,
      enrollRes,
      sessionRes,
      activeStudentsRes,
      courseStatsRes,
    ] = await Promise.all([
      supabase
        .from('users')
        .select('user_id', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('courses')
        .select('course_id', { count: 'exact', head: true })
        .is('deleted_at', null),
      supabase
        .from('enrollments')
        .select('enrollment_id', { count: 'exact', head: true }),
      supabase
        .from('user_sessions')
        .select('session_id', { count: 'exact', head: true })
        .is('logout_at', null),
      supabase
        .from('mv_active_students')
        .select('user_id', { count: 'exact', head: true }),
      supabase.from('mv_performance_summary').select(`
        course_id,
        avg_quiz_score,
        completion_pct
      `),
    ]);

    res.json({
      total_users:        usersRes.count,
      total_courses:      coursesRes.count,
      total_enrollments:  enrollRes.count,
      active_sessions:    sessionRes.count,
      active_students:    activeStudentsRes.count,
      course_stats:       courseStatsRes.data,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/analytics/instructor/:courseId ────────────────────────────────
async function instructorDashboard(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);

    if (req.user.role === 'instructor') {
      const ok = await instructorOwnsCourse(req.user.user_id, courseId);
      if (!ok)
        return res.status(403).json({ error: 'Not authorized for this course' });
    }

    const [enrollRes, topStudentsRes, atRiskRes] = await Promise.all([
      supabase.from('enrollments')
        .select('enrollment_id', { count: 'exact', head: true })
        .eq('course_id', courseId),

      supabase.from('mv_performance_summary')
        .select('user_id, total_watch_sec, completion_pct, users(full_name)')
        .eq('course_id', courseId)
        .order('total_watch_sec', { ascending: false })
        .limit(5),

      supabase.from('mv_performance_summary')
        .select('user_id, avg_quiz_score, completion_pct, users(full_name)')
        .eq('course_id', courseId)
        .lt('avg_quiz_score', 50)
        .order('avg_quiz_score', { ascending: true }),
    ]);

    res.json({
      enrollment_count: enrollRes.count,
      top_students:     topStudentsRes.data,
      at_risk_students: atRiskRes.data,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/analytics/refresh-summary ────────────────────────────────────
async function refreshSummary(req, res, next) {
  try {
    const { error } = await supabase.rpc('refresh_analytics_views');
    if (error) throw new Error(error.message);
    res.json({ message: 'Analytics materialized views refreshed' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  activeStudents,
  underperforming,
  skippedContent,
  completionRates,
  performanceTrend,
  adminDashboard,
  instructorDashboard,
  refreshSummary,
};
