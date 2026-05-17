const { supabase } = require("../db/connection");

// ── GET /api/v1/reviews/course/:courseId ──────────────────────────────────────
// Public — paginated list of reviews for a course, newest first
async function getReviewsByCourse(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("reviews")
      .select(
        `
        review_id, rating, body, created_at,
        users ( user_id, full_name, avatar_url )
      `,
        { count: "exact" },
      )
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    res.json({
      reviews: data || [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/reviews/course/:courseId/summary ──────────────────────────────
// Public — star histogram + avg rating (cheap read from courses table)
async function getCourseSummary(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);

    // avg_rating and review_count are denormalized on courses (maintained by DB trigger)
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("avg_rating, review_count")
      .eq("course_id", courseId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!course) return res.status(404).json({ error: "Course not found" });

    // Histogram — count per star (1-5)
    const { data: histogram, error: hErr } = await supabase
      .from("reviews")
      .select("rating")
      .eq("course_id", courseId);

    if (hErr) throw new Error(hErr.message);

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (histogram || []).forEach((r) => {
      dist[r.rating] = (dist[r.rating] || 0) + 1;
    });

    res.json({
      avg_rating: Number(course.avg_rating) || 0,
      review_count: course.review_count || 0,
      distribution: dist,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/reviews/course/:courseId ─────────────────────────────────────
// Student only — create a review (must be enrolled; one per student per course)
async function createReview(req, res, next) {
  try {
    const courseId = Number(req.params.courseId);
    const userId = req.user.user_id;
    const { rating, body } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: "Rating must be an integer between 1 and 5" });
    }

    // Must be enrolled to leave a review
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("enrollment_id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!enrollment) {
      return res
        .status(403)
        .json({ error: "You must be enrolled to review this course" });
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: userId,
        course_id: courseId,
        rating: Number(rating),
        body: body?.trim() || null,
      })
      .select("review_id")
      .single();

    if (error) {
      // UNIQUE violation — student already reviewed this course
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ error: "You have already reviewed this course" });
      }
      throw new Error(error.message);
    }

    res.status(201).json({ review_id: data.review_id });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/reviews/:reviewId ──────────────────────────────────────────
// Student — update their own review; admin can update any
async function updateReview(req, res, next) {
  try {
    const reviewId = Number(req.params.reviewId);
    const userId = req.user.user_id;

    // Fetch review to check ownership
    const { data: review } = await supabase
      .from("reviews")
      .select("review_id, user_id")
      .eq("review_id", reviewId)
      .maybeSingle();

    if (!review) return res.status(404).json({ error: "Review not found" });

    if (req.user.role !== "admin" && review.user_id !== userId) {
      return res.status(403).json({ error: "Not your review" });
    }

    const updates = {};
    const { rating, body } = req.body;
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ error: "Rating must be between 1 and 5" });
      }
      updates.rating = Number(rating);
    }
    if (body !== undefined) updates.body = body?.trim() || null;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { error } = await supabase
      .from("reviews")
      .update(updates)
      .eq("review_id", reviewId);

    if (error) throw new Error(error.message);
    res.json({ message: "Review updated" });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/reviews/:reviewId ─────────────────────────────────────────
// Student deletes own review; admin can delete any
async function deleteReview(req, res, next) {
  try {
    const reviewId = Number(req.params.reviewId);
    const userId = req.user.user_id;

    const { data: review } = await supabase
      .from("reviews")
      .select("review_id, user_id")
      .eq("review_id", reviewId)
      .maybeSingle();

    if (!review) return res.status(404).json({ error: "Review not found" });

    if (req.user.role !== "admin" && review.user_id !== userId) {
      return res.status(403).json({ error: "Not your review" });
    }

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("review_id", reviewId);

    if (error) throw new Error(error.message);
    res.json({ message: "Review deleted" });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/reviews/instructor/mine ──────────────────────────────────────
// Instructor only — all reviews across their courses (for Reviews.jsx page)
async function getInstructorReviews(req, res, next) {
  try {
    const userId = req.user.user_id;

    const { data: instructor } = await supabase
      .from("instructors")
      .select("instructor_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instructor)
      return res.status(403).json({ error: "Not a registered instructor" });

    // Get course IDs owned by this instructor
    const { data: courses } = await supabase
      .from("courses")
      .select("course_id, title")
      .eq("instructor_id", instructor.instructor_id)
      .is("deleted_at", null);

    const courseIds = (courses || []).map((c) => c.course_id);
    if (!courseIds.length) return res.json([]);

    const courseMap = Object.fromEntries(
      (courses || []).map((c) => [c.course_id, c.title]),
    );

    const { data: reviews, error } = await supabase
      .from("reviews")
      .select(
        `
        review_id, course_id, rating, body, created_at,
        users ( full_name, avatar_url )
      `,
      )
      .in("course_id", courseIds)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const enriched = (reviews || []).map((r) => ({
      ...r,
      course_title: courseMap[r.course_id] || null,
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReviewsByCourse,
  getCourseSummary,
  createReview,
  updateReview,
  deleteReview,
  getInstructorReviews,
};
