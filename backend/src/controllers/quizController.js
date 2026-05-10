const { supabase } = require("../db/connection");

async function resolveInstructorId(userId) {
  let { data: instructor } = await supabase
    .from("instructors")
    .select("instructor_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!instructor) {
    const { data: created, error: createErr } = await supabase
      .from("instructors")
      .insert({ user_id: userId })
      .select("instructor_id")
      .maybeSingle();

    if (!createErr && created) {
      instructor = created;
    } else if (createErr?.code === "23505") {
      const { data: retry } = await supabase
        .from("instructors")
        .select("instructor_id")
        .eq("user_id", userId)
        .maybeSingle();
      instructor = retry;
    }
  }

  return instructor?.instructor_id ?? null;
}

/** @returns {Promise<{ status: number, error: string } | null>} */
async function assertAdminOrCourseInstructor(req, courseId) {
  if (req.user.role === "admin") return null;
  if (req.user.role !== "instructor") {
    return { status: 403, error: "Insufficient permissions" };
  }

  const instructorId = await resolveInstructorId(req.user.user_id);
  if (!instructorId) {
    return { status: 403, error: "Not a registered instructor" };
  }

  const { data: own } = await supabase
    .from("courses")
    .select("course_id")
    .eq("course_id", courseId)
    .eq("instructor_id", instructorId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!own) return { status: 403, error: "Not your course" };
  return null;
}

/** @returns {Promise<{ status: number, error: string } | null>} */
async function assertStudentQuizAccess(userId, quiz) {
  if (!quiz.is_published) {
    return { status: 403, error: "Quiz not available" };
  }

  const { data: enr } = await supabase
    .from("enrollments")
    .select("enrollment_id, enrollment_statuses ( status_name )")
    .eq("user_id", userId)
    .eq("course_id", quiz.course_id)
    .maybeSingle();

  if (!enr) return { status: 403, error: "Not enrolled in this course" };
  const st = enr.enrollment_statuses?.status_name;
  if (st !== "active") {
    return { status: 403, error: "Enrollment not active" };
  }
  return null;
}

// ── GET /api/v1/quizzes/:id ───────────────────────────────────────────────────
// Returns quiz metadata + questions + options.
// correct answers (is_correct) are stripped before sending to the student.
async function getQuiz(req, res, next) {
  try {
    const { data: quiz, error } = await supabase
      .from("quiz")
      .select(
        "quiz_id, course_id, title, time_limit_min, pass_score, allow_multiple, is_published",
      )
      .eq("quiz_id", Number(req.params.id))
      .single();

    if (error || !quiz)
      return res.status(404).json({ error: "Quiz not found" });

    if (req.user.role === "student") {
      const deny = await assertStudentQuizAccess(req.user.user_id, quiz);
      if (deny) return res.status(deny.status).json({ error: deny.error });
    } else if (req.user.role === "instructor") {
      const deny = await assertAdminOrCourseInstructor(req, quiz.course_id);
      if (deny) return res.status(deny.status).json({ error: deny.error });
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const showAnswers =
      req.user.role === "admin" || req.user.role === "instructor";
    const optionSelect = showAnswers
      ? `question_options ( option_id, option_text, sort_order, is_correct )`
      : `question_options ( option_id, option_text, sort_order )`;

    const { data: questions, error: qErr } = await supabase
      .from("quiz_questions")
      .select(
        `
        question_id,
        question_text,
        sort_order,
        points,
        question_types ( type_id, type_name ),
        ${optionSelect}
      `,
      )
      .eq("quiz_id", quiz.quiz_id)
      .order("sort_order");

    if (qErr) throw new Error(qErr.message);

    const questionsFormatted = (questions || []).map((q) => ({
      ...q,
      question_options: (q.question_options || []).sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }));

    res.json({ ...quiz, questions: questionsFormatted });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/quizzes ──────────────────────────────────────────────────────
async function createQuiz(req, res, next) {
  try {
    const courseId = Number(req.body.course_id);
    const deny = await assertAdminOrCourseInstructor(req, courseId);
    if (deny) return res.status(deny.status).json({ error: deny.error });

    const {
      title,
      time_limit_min,
      pass_score = 50,
      allow_multiple = true,
      is_published = false,
    } = req.body;

    const { data, error } = await supabase
      .from("quiz")
      .insert({
        course_id: courseId,
        title,
        time_limit_min: time_limit_min || null,
        pass_score: Number(pass_score),
        allow_multiple: Boolean(allow_multiple),
        is_published: Boolean(is_published),
      })
      .select("quiz_id")
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ quiz_id: data.quiz_id });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/quizzes/:id/questions ───────────────────────────────────────
// v2 body shape:
// {
//   question_type: 'mcq' | 'true_false',
//   question_text: 'What is ...?',
//   points: 1,
//   sort_order: 0,
//   options: [
//     { option_text: 'Paris',  is_correct: true  },
//     { option_text: 'London', is_correct: false },
//     { option_text: 'Berlin', is_correct: false },
//     { option_text: 'Rome',   is_correct: false }
//   ]
// }
async function addQuestion(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    const { data: quizRow, error: quizFindErr } = await supabase
      .from("quiz")
      .select("quiz_id, course_id")
      .eq("quiz_id", quizId)
      .maybeSingle();

    if (quizFindErr || !quizRow)
      return res.status(404).json({ error: "Quiz not found" });

    const deny = await assertAdminOrCourseInstructor(req, quizRow.course_id);
    if (deny) return res.status(deny.status).json({ error: deny.error });

    const {
      question_type,
      question_text,
      options = [],
      sort_order = 0,
      points = 1,
    } = req.body;

    // Validate that at least one option is marked correct
    const hasCorrect = options.some((o) => o.is_correct === true);
    if (!hasCorrect) {
      return res
        .status(400)
        .json({
          error:
            "At least one option must be marked as correct (is_correct: true)",
        });
    }

    // Validate true_false has exactly 2 options
    if (question_type === "true_false" && options.length !== 2) {
      return res
        .status(400)
        .json({ error: "true_false questions must have exactly 2 options" });
    }

    // Resolve question_type name → type_id
    const { data: typeRow, error: typeErr } = await supabase
      .from("question_types")
      .select("type_id")
      .eq("type_name", question_type)
      .single();

    if (typeErr || !typeRow) {
      return res.status(400).json({
        error: `Unknown question type: "${question_type}". Valid values: mcq, true_false`,
      });
    }

    // Insert the question first
    const { data: question, error: qErr } = await supabase
      .from("quiz_questions")
      .insert({
        quiz_id: quizId,
        question_type_id: typeRow.type_id,
        question_text,
        sort_order: Number(sort_order),
        points: Number(points),
      })
      .select("question_id")
      .single();

    if (qErr) throw new Error(qErr.message);

    // Insert all options for this question
    const optionRows = options.map((opt, i) => ({
      question_id: question.question_id,
      option_text: opt.option_text,
      is_correct: Boolean(opt.is_correct),
      sort_order: i,
    }));

    const { error: optErr } = await supabase
      .from("question_options")
      .insert(optionRows);

    if (optErr) throw new Error(optErr.message);

    res.status(201).json({ question_id: question.question_id });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/quizzes/question-types ───────────────────────────────────────
async function getQuestionTypes(req, res, next) {
  try {
    const { data, error } = await supabase
      .from("question_types")
      .select("type_id, type_name, description")
      .order("type_id");

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/quizzes/attempts/me ───────────────────────────────────────────
// Student-facing quiz history with score, pass/fail and course info.
async function listMyAttempts(req, res, next) {
  try {
    const userId = req.user.user_id;
    const courseId =
      req.query.course_id !== undefined ? Number(req.query.course_id) : null;

    let q = supabase
      .from("quiz_attempts")
      .select(
        `
        attempt_id,
        quiz_id,
        score,
        passed,
        attempt_date,
        quiz (
          quiz_id,
          title,
          course_id,
          courses ( title )
        )
      `,
      )
      .eq("user_id", userId)
      .order("attempt_date", { ascending: false });

    if (Number.isFinite(courseId)) {
      q = q.eq("quiz.course_id", courseId);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/quizzes/:id/attempt ─────────────────────────────────────────
// v2 body shape:
// {
//   answers: [
//     { question_id: 1, option_id: 3 },
//     { question_id: 2, option_id: 7 }
//   ]
// }
// The client sends the option_id the student selected.
// Grading is done server-side by looking up is_correct on the option.
async function submitAttempt(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    const userId = req.user.user_id;
    const { answers = [] } = req.body;

    const { data: quiz, error: quizErr } = await supabase
      .from("quiz")
      .select(
        "allow_multiple, pass_score, course_id, is_published",
      )
      .eq("quiz_id", quizId)
      .single();

    if (quizErr || !quiz)
      return res.status(404).json({ error: "Quiz not found" });

    const deny = await assertStudentQuizAccess(userId, quiz);
    if (deny) return res.status(deny.status).json({ error: deny.error });

    // Enforce single-attempt rule
    if (!quiz.allow_multiple) {
      const { data: prev } = await supabase
        .from("quiz_attempts")
        .select("attempt_id")
        .eq("user_id", userId)
        .eq("quiz_id", quizId)
        .maybeSingle();

      if (prev)
        return res
          .status(409)
          .json({ error: "Only one attempt allowed for this quiz" });
    }

    // Fetch all questions with their correct options for this quiz
    const { data: questions, error: qErr } = await supabase
      .from("quiz_questions")
      .select("question_id, points, question_options ( option_id, is_correct )")
      .eq("quiz_id", quizId);

    if (qErr) throw new Error(qErr.message);

    // Build a lookup: option_id → is_correct
    const optionCorrectMap = {};
    // Build a lookup: question_id → points
    const questionPointsMap = {};

    questions.forEach((q) => {
      questionPointsMap[q.question_id] = Number(q.points);
      (q.question_options || []).forEach((opt) => {
        optionCorrectMap[opt.option_id] = opt.is_correct;
      });
    });

    // Grade each submitted answer
    let earnedPoints = 0;
    let totalPoints = 0;
    let correctCount = 0;

    questions.forEach((q) => {
      totalPoints += questionPointsMap[q.question_id];
    });

    const gradedAnswers = answers.map((a) => {
      const isCorrect = optionCorrectMap[a.option_id] === true;
      if (isCorrect) {
        earnedPoints += questionPointsMap[a.question_id] || 1;
        correctCount++;
      }
      return {
        question_id: a.question_id,
        option_id: a.option_id,
        is_correct: isCorrect,
      };
    });

    const score =
      totalPoints > 0
        ? Math.round((earnedPoints / totalPoints) * 10000) / 100
        : 0;

    const passed = score >= Number(quiz.pass_score);

    // Insert the attempt record
    const { data: attempt, error: attemptErr } = await supabase
      .from("quiz_attempts")
      .insert({ user_id: userId, quiz_id: quizId, score, passed })
      .select("attempt_id")
      .single();

    if (attemptErr) throw new Error(attemptErr.message);

    // Store each individual answer for analytics / review
    if (gradedAnswers.length > 0) {
      const answerRows = gradedAnswers.map((a) => ({
        attempt_id: attempt.attempt_id,
        question_id: a.question_id,
        option_id: a.option_id,
        is_correct: a.is_correct,
      }));

      const { error: ansErr } = await supabase
        .from("quiz_answers")
        .insert(answerRows);

      if (ansErr) throw new Error(ansErr.message);
    }

    res.status(201).json({
      attempt_id: attempt.attempt_id,
      score,
      passed,
      correct_count: correctCount,
      total_questions: questions.length,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/quizzes/attempts/:attemptId ───────────────────────────────────
// NEW in v2 – returns a full attempt review with per-question breakdown.
// Only the owner of the attempt can access it (enforced via RLS + user_id check).
async function getAttemptReview(req, res, next) {
  try {
    const attemptId = Number(req.params.attemptId);
    const userId = req.user.user_id;

    // Fetch the attempt (ownership check included)
    const { data: attempt, error: aErr } = await supabase
      .from("quiz_attempts")
      .select("attempt_id, quiz_id, score, passed, attempt_date, user_id")
      .eq("attempt_id", attemptId)
      .single();

    if (aErr || !attempt)
      return res.status(404).json({ error: "Attempt not found" });
    if (attempt.user_id !== userId)
      return res.status(403).json({ error: "Forbidden" });

    // Fetch the answers with question text and selected option text
    const { data: answers, error: ansErr } = await supabase
      .from("quiz_answers")
      .select(
        `
        answer_id,
        is_correct,
        quiz_questions ( question_id, question_text, points ),
        question_options ( option_id, option_text )
      `,
      )
      .eq("attempt_id", attemptId);

    if (ansErr) throw new Error(ansErr.message);

    res.json({ ...attempt, answers });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/quizzes/:id ────────────────────────────────────────────────
async function updateQuiz(req, res, next) {
  try {
    const quizId = Number(req.params.id);
    const { data: quizRow, error: quizFindErr } = await supabase
      .from("quiz")
      .select("quiz_id, course_id")
      .eq("quiz_id", quizId)
      .maybeSingle();

    if (quizFindErr || !quizRow)
      return res.status(404).json({ error: "Quiz not found" });

    const deny = await assertAdminOrCourseInstructor(req, quizRow.course_id);
    if (deny) return res.status(deny.status).json({ error: deny.error });

    const updates = {};
    const {
      title,
      pass_score,
      allow_multiple,
      time_limit_min,
      is_published,
    } = req.body;

    if (title !== undefined) updates.title = title;
    if (pass_score !== undefined) updates.pass_score = Number(pass_score);
    if (allow_multiple !== undefined)
      updates.allow_multiple = Boolean(allow_multiple);
    if (time_limit_min !== undefined)
      updates.time_limit_min =
        time_limit_min === null || time_limit_min === ""
          ? null
          : Number(time_limit_min);
    if (is_published !== undefined)
      updates.is_published = Boolean(is_published);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { error } = await supabase
      .from("quiz")
      .update(updates)
      .eq("quiz_id", quizId);

    if (error) throw new Error(error.message);
    res.json({ message: "Quiz updated" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQuiz,
  createQuiz,
  addQuestion,
  getQuestionTypes,
  listMyAttempts,
  submitAttempt,
  getAttemptReview,
  updateQuiz,
};
