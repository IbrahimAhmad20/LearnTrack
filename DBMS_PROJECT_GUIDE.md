# LearnTrack DBMS Documentation (Team Guide)

This document explains the database part of the project in a way that teammates can present confidently, even if they did not build it.

---

## 1) Project Database Overview

LearnTrack uses **PostgreSQL (Supabase)** as the core DBMS.

- Main schema file: `backend/src/db/ddl.sql`
- DB connection layer: `backend/src/db/connection.js`
- API server entry: `backend/src/app.js`

Important design points:

- `users.user_id` is **UUID** (matches Supabase Auth `auth.users.id`).
- Most other table primary keys are `SERIAL` integers.
- Role-based access is enforced by:
  - backend middleware (`verifyToken`, `requireRole`)
  - plus DB-level **Row Level Security (RLS)** policies.

---

## 2) All Tables and What They Do

### Core identity tables

1. `users`
- Stores platform users (student, instructor, admin).
- Soft delete via `deleted_at`.

2. `instructors`
- Profile extension for users who are instructor/admin.
- `user_id` has a unique FK to `users.user_id`.

### Lookup/reference tables

3. `activity_types` (`play`, `pause`, `skip`, `seek`, `complete`)
4. `content_types` (`video`, `document`, `quiz`)
5. `enrollment_statuses` (`active`, `completed`, `dropped`)
6. `question_types` (`mcq`, `true_false`)

### Course and learning flow tables

7. `courses`
- Course metadata, publishing status, soft delete.
- Owned by an instructor (`instructor_id` FK).

8. `enrollments`
- Student-to-course relation.
- One user can enroll once per course (`UNIQUE(user_id, course_id)`).

9. `content`
- Learning units inside a course (video/document/quiz content item).

10. `activity_log`
- Event stream per learner/content (watch time + event type + timestamp).

11. `content_progress`
- Per learner/content percentage progress (0 to 100).

### Quiz subsystem tables

12. `quiz`
13. `quiz_questions`
14. `question_options`
15. `quiz_attempts`
16. `quiz_answers`

These support full quiz lifecycle: definition, options, attempt, grading storage.

### Session/security table

17. `user_sessions`
- Stores token hash and session lifecycle details.

---

## 3) Table Connections (Relationships)

You can explain the ER structure in this chain:

- `users` 1--1 `instructors` (for instructor/admin users)
- `instructors` 1--many `courses`
- `users` many--many `courses` via `enrollments`
- `courses` 1--many `content`
- `content` 1--many `activity_log`
- `users` 1--many `activity_log`
- `users` 1--many `content_progress`
- `courses` 1--many `quiz`
- `quiz` 1--many `quiz_questions`
- `quiz_questions` 1--many `question_options`
- `users` 1--many `quiz_attempts`
- `quiz_attempts` 1--many `quiz_answers`

This is a strong normalized design:
- lookup tables remove repeated text values,
- FKs enforce referential integrity,
- unique constraints prevent duplicates.

---

## 4) Joins Used in This Project (and Why)

## A) SQL joins in materialized views (`ddl.sql`)

### `mv_performance_summary`
Uses:
- `enrollments e`
- `LEFT JOIN content c`
- `LEFT JOIN activity_log al`
- `LEFT JOIN content_progress cp`
- `LEFT JOIN quiz q`
- `LEFT JOIN quiz_attempts qa`

Why:
- produce per-student-per-course KPI row:
  - total watch seconds,
  - avg quiz score,
  - completion percent.

Why `LEFT JOIN`:
- keep enrollment row even if user has no logs or no quiz yet.

### `mv_active_students`
Uses:
- `activity_log al JOIN users u`
Why:
- get student names and total watch time.

### `mv_underperforming_students`
Uses:
- `quiz_attempts qa JOIN users u`
Why:
- compute average score per learner.

### `mv_skipped_content`
Uses:
- `activity_log al`
- `JOIN activity_types at`
- `JOIN content c`
Why:
- count skip events per content item.

### `mv_completion_rates`
Uses:
- `content_progress cp`
- `JOIN users u`
- `JOIN content c`
Why:
- completion average per student per course.

## B) Join-like nested reads via Supabase in controllers

Supabase select syntax fetches related rows similar to SQL joins.

Examples:

- `courseController.listCourses`:
  - reads `courses` + nested `instructors -> users(full_name)`.
- `enrollmentController.getMyEnrollments`:
  - reads `enrollments` + `enrollment_statuses` + `courses` + `instructors/users`.
- `quizController.getQuiz`:
  - reads quiz questions + options + question types.
- `analyticsController.activeStudents`:
  - reads `activity_log` with `users!inner(full_name, role)`.

---

## 5) Queries and Data Operations Used

Your backend mainly uses these query types:

1. `SELECT` with filters and sorting
- `.eq()`, `.in()`, `.is()`, `.lt()`, `.gte()`, `.lte()`, `.order()`, `.limit()`.

2. `INSERT`
- Create course/content/quiz/question/enrollment/attempt/answers.

3. `UPDATE`
- Course and content edits, publish toggles, enrollment status changes.

4. `DELETE`
- Some hard deletes (example: enrollment delete by admin).

5. Aggregation through precomputed objects
- Reads from materialized views for analytics endpoints.

6. Procedure/RPC calls
- `supabase.rpc('refresh_analytics_views')` in analytics refresh endpoint.

---

## 6) Triggers, Procedures, and Security Features

### Trigger functions

- `check_instructor_role()`
  - prevents invalid inserts into `instructors`.

- `ensure_instructor_profile()`
  - auto-creates instructor row when user role becomes instructor/admin.

- `set_updated_at()`
  - auto-updates `updated_at` before updates on key tables.

- `handle_new_auth_user()`
  - syncs Supabase auth user into `public.users`.

### Stored procedures/functions

- `refresh_analytics_views()`
  - refreshes all materialized views.

- `refresh_performance_summary()`
  - compatibility wrapper calling the above.

### Security

- **RLS enabled** for major tables.
- Policies like:
  - users can read/write own profile,
  - students access own progress/attempts/answers,
  - instructors manage own courses/content,
  - service role can perform server-side operations.

---

## 7) How API Endpoints Map to DB

Route modules:

- `backend/src/routes/courses.js`
- `backend/src/routes/enrollments.js`
- `backend/src/routes/quizzes.js`
- `backend/src/routes/analytics.js`

Controller examples:

- Courses:
  - list/public catalog, instructor-owned list, single course detail,
  - content CRUD and enrolled student listing.

- Enrollments:
  - student enroll + status updates with lookup validation.

- Quizzes:
  - quiz creation, questions/options, attempt submission, review.

- Analytics:
  - active students, underperforming learners, skipped content, completion rates,
  - admin dashboard metrics and materialized view refresh.

---

## 8) What To Explain in Presentation (Simple Script)

Use this 60-90 second script:

1. "Our DB is PostgreSQL via Supabase with UUID user IDs linked to auth."
2. "We normalized repeated values into lookup tables like content type and enrollment status."
3. "Core flow is users -> instructors -> courses -> content, and users -> enrollments -> course activity/progress."
4. "Quiz module stores question bank, options, attempts, and per-answer correctness for analytics."
5. "For performance, we use materialized views that precompute heavy joins."
6. "For security, we enforce role-based middleware and database-level RLS policies."
7. "Triggers automate integrity tasks like instructor-profile creation and updated_at timestamps."

---

## 9) Common Questions Teammates May Ask

### Why use UUID for users?
- Because Supabase Auth generates UUIDs. This avoids ID mapping complexity.

### Why materialized views?
- Analytics queries are heavy; materialized views make dashboard reads fast.

### Why both middleware and RLS?
- Defense in depth:
  - middleware protects API routes,
  - RLS protects table access at DB layer.

### Why separate lookup tables?
- Ensures valid values, avoids typos, and supports easy expansion.

---

## 10) Gaps/Improvements You Can Mention Honestly

If asked "what next?", say:

- Move quiz grading into a stored procedure for full DB-side transactional grading.
- Add report-export functions (CSV/PDF) backed by stored procedures.
- Add scheduled refresh logging for materialized views.
- Add audit tables/triggers for change tracking.

This shows maturity and DBMS-first thinking.

