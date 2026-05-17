# Instructor-Side Analytics — Technical Documentation

This document describes how **instructor analytics** work end-to-end in LearnTrack: what runs on the **backend**, which **database tables and materialized views** are involved, how **queries** are expressed (via Supabase’s REST/Data API), and how results are **displayed on the frontend**.

If you need a broader “explain the whole project” narrative (frontend → backend → DB), read **`PROJECT_WALKTHROUGH.md`**.

---

## 1. Entry Points

| Layer | Location |
|-------|-----------|
| **Frontend page** | `learntrack-client/src/pages/instructor/Analytics.jsx` |
| **Navigation** | Sidebar link `/instructor/analytics` (see `components/Sidebar.jsx`, route in `App.jsx`) |
| **API client** | `learntrack-client/src/api/index.js` → `analytics.*` |
| **Backend routes** | `backend/src/routes/analytics.js` |
| **Backend logic** | `backend/src/controllers/analyticsController.js` |
| **Schema (analytics snapshots)** | `backend/src/db/ddl.sql` — materialized views `mv_*` |

All analytics routes require a **valid JWT** (`verifyToken`). Instructor-facing endpoints use **`requireRole('instructor', 'admin')`** (or mixed routes where instructors are scoped by owned courses).

---

## 2. How an Instructor Is Scoped to Data

Instructors never see arbitrary courses. Scoping is implemented in the controller using two helpers:

### 2.1 `getInstructorCourseIds(userId)`

1. **`SELECT instructor_id FROM instructors WHERE user_id = <JWT user>`**
2. **`SELECT course_id FROM courses WHERE instructor_id = … AND deleted_at IS NULL`**

Returns an array of `course_id` values the logged-in instructor owns.

### 2.2 `instructorOwnsCourse(userId, courseId)`

Confirms the instructor’s `instructor_id` matches `courses.instructor_id` for the given `course_id` (and course not soft-deleted).

If an instructor passes **`course_id`** query/filter values that are **not** in their list, the API responds **`403`** with `Not authorized for this course`.

---

## 3. Instructor Analytics API Surface

Base path: **`/api/v1/analytics`** (prefixed by `VITE_API_URL` on the client).

| Endpoint | Method | Instructor behavior |
|----------|--------|---------------------|
| `/active-students` | GET | Scoped to instructor’s courses; optional `course_id`, optional date range `start`/`end` |
| `/completion-rates` | GET | Filter rows to instructor’s `course_id` set (or single course if `course_id` given) |
| `/skipped-content` | GET | Reads `mv_skipped_content` filtered to instructor’s courses |
| `/underperforming` | GET | Computes underperformers **per instructor courses**; optional `threshold` (default 50), optional `course_id` |
| `/instructor/:courseId` | GET | Per-course dashboard: enrollment count, top learners, at-risk list |
| `/performance-trend/:userId` | GET | Quiz attempt timeline for a student; instructor only sees attempts on quizzes in **their** courses **and** if student is enrolled in one of those courses |

**Admin-only (not instructor primary flow):**

- `GET /dashboard/admin` — platform-wide counts  
- `POST /refresh-summary` — calls DB function `refresh_analytics_views()` to refresh all materialized views  

If dashboards show **stale zeros**, an admin must refresh snapshots (or schedule refresh in Supabase).

---

## 4. Database Objects Used for Instructor Analytics

### 4.1 Operational tables (live writes)

| Table | Role in analytics |
|-------|-------------------|
| `instructors` | Maps JWT `user_id` → `instructor_id` |
| `courses` | Ownership filter (`instructor_id`, `deleted_at`) |
| `enrollments` | Who is allowed to count as “your” student for a course |
| `content` | Maps `content_id` → `course_id` for activity attribution |
| `activity_log` | Watch time + events (`watch_time`, `type_id`, `event_at`) |
| `activity_types` | Distinguishes **skip** vs play etc. |
| `content_progress` | Per-user per-content completion % |
| `quiz`, `quiz_attempts`, `users` | Quiz scores and student names |

**How many tables are there?** In `backend/src/db/ddl.sql` there are **17 core tables** used by the app (users, instructors, courses, enrollments, content, activity, progress, quizzes, sessions, etc.) plus **5 analytics materialized views** (`mv_*`).

### 4.2 Materialized views (precomputed snapshots)

Defined in `backend/src/db/ddl.sql`:

| View | Contents |
|------|-----------|
| **`mv_performance_summary`** | Per `(user_id, course_id)`: `total_watch_sec`, `avg_quiz_score`, `completion_pct` |
| **`mv_skipped_content`** | Per content item: `skip_count`, title, `course_id` |
| **`mv_completion_rates`** | Per `(user_id, course_id)`: `avg_completion_pct`, `content_items` |

Instructors **directly** query:

- `mv_skipped_content` (filtered by course)
- `mv_completion_rates` (filtered by instructor-owned courses)
- `mv_performance_summary` (for **`/analytics/instructor/:courseId`** dashboard panels)

**Note:** **`mv_active_students`** and **`mv_underperforming_students`** are used on the **admin** paths or platform-wide defaults. For **instructors**, **active students** and **underperforming** are often recomputed in Node using **`activity_log`** / **`quiz_attempts`** with enrollment filtering — see section 5.

### 4.3 Exact SQL queries used by analytics (from `ddl.sql`)

These are the **real database queries** that generate the analytics snapshots used by the backend.

#### 4.3.1 `mv_performance_summary` (course dashboard: top learners + at-risk)

```sql
CREATE MATERIALIZED VIEW mv_performance_summary AS
SELECT
  e.user_id,                                                        -- UUID
  e.course_id,
  COALESCE(SUM(al.watch_time), 0)                   AS total_watch_sec,
  COALESCE(ROUND(AVG(qa.score)::NUMERIC, 2), 0)     AS avg_quiz_score,
  COALESCE(ROUND(AVG(cp.progress_percent)::NUMERIC, 2), 0) AS completion_pct,
  NOW()                                             AS last_refreshed
FROM enrollments e
LEFT JOIN content c        ON c.course_id  = e.course_id
LEFT JOIN activity_log al  ON al.content_id = c.content_id AND al.user_id = e.user_id
LEFT JOIN content_progress cp ON cp.content_id = c.content_id AND cp.user_id = e.user_id
LEFT JOIN quiz q            ON q.course_id  = e.course_id
LEFT JOIN quiz_attempts qa  ON qa.quiz_id   = q.quiz_id    AND qa.user_id = e.user_id
GROUP BY e.user_id, e.course_id
WITH DATA;
```

**Where are the joins and why?**

- `enrollments → content`: to attach all lessons of that course to each enrolled learner.
- `content → activity_log`: to sum watch seconds for that learner on that course’s lessons.
- `content → content_progress`: to average progress % across the course lessons.
- `courses → quiz → quiz_attempts`: to average quiz scores for that course’s quizzes.
- All joins are `LEFT JOIN` so learners still appear even if they have **no activity yet** (they get 0s).

#### 4.3.2 `mv_active_students` (platform-wide “active students”, mostly admin)

```sql
CREATE MATERIALIZED VIEW mv_active_students AS
SELECT
  al.user_id,
  u.full_name,
  COALESCE(SUM(al.watch_time), 0) AS total_watch_sec,
  MAX(al.event_at) AS last_event_at
FROM activity_log al
JOIN users u ON u.user_id = al.user_id
WHERE u.role = 'student'
GROUP BY al.user_id, u.full_name
WITH DATA;
```

#### 4.3.3 `mv_underperforming_students` (platform-wide underperformers, mostly admin)

```sql
CREATE MATERIALIZED VIEW mv_underperforming_students AS
SELECT
  qa.user_id,
  u.full_name,
  ROUND(AVG(qa.score)::NUMERIC, 2) AS avg_score,
  COUNT(*) AS attempts_count
FROM quiz_attempts qa
JOIN users u ON u.user_id = qa.user_id
GROUP BY qa.user_id, u.full_name
WITH DATA;
```

#### 4.3.4 `mv_skipped_content` (skipped lessons)

```sql
CREATE MATERIALIZED VIEW mv_skipped_content AS
SELECT
  al.content_id,
  c.title,
  c.course_id,
  COUNT(*)::INT AS skip_count
FROM activity_log al
JOIN activity_types at ON at.type_id = al.type_id
JOIN content c ON c.content_id = al.content_id
WHERE at.type_name = 'skip'
GROUP BY al.content_id, c.title, c.course_id
WITH DATA;
```

**Join explanation:**

- `activity_log → activity_types`: to detect which events are actually “skip”.
- `activity_log → content`: to show the lesson title and course id on the analytics table.

#### 4.3.5 `mv_completion_rates` (completion rows)

```sql
CREATE MATERIALIZED VIEW mv_completion_rates AS
SELECT
  cp.user_id,
  u.full_name,
  c.course_id,
  ROUND(AVG(cp.progress_percent)::NUMERIC, 2) AS avg_completion_pct,
  COUNT(*)::INT AS content_items
FROM content_progress cp
JOIN users u ON u.user_id = cp.user_id
JOIN content c ON c.content_id = cp.content_id
GROUP BY cp.user_id, u.full_name, c.course_id
WITH DATA;
```

**Join explanation:**

- `content_progress → content`: needed to convert “progress per lesson” into “average progress per course”.
- `content_progress → users`: to display student names in instructor tables.

#### 4.3.6 DB function used by backend: `refresh_analytics_views()`

This is the DB function called by the **admin** endpoint `POST /analytics/refresh-summary`.

```sql
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_performance_summary;
  REFRESH MATERIALIZED VIEW mv_active_students;
  REFRESH MATERIALIZED VIEW mv_underperforming_students;
  REFRESH MATERIALIZED VIEW mv_skipped_content;
  REFRESH MATERIALIZED VIEW mv_completion_rates;
END;
$$;
```

---

## 5. Backend Query Logic (Conceptual “SQL” Behind Supabase Client)

The backend uses **`supabase.from('table').select(...)`** — not raw SQL strings in files — but each call corresponds to PostgreSQL operations described below.

### 5.1 `GET /analytics/active-students` (instructor)

**Purpose:** Rank students by **total watch seconds** within the instructor’s courses.

**Steps:**

1. Load instructor’s `courseIds`.
2. Load **`content`** rows for those courses → `content_id` list + map `content_id → course_id`.
3. Load **`enrollments`** for those courses → allowed pairs `(user_id, course_id)` as strings.
4. Query **`activity_log`**:
   - `IN (content_id)`
   - Inner join **`users`** (`users!inner`) and filter **`users.role = 'student'`**
   - Optional `event_at` between `start` and `end` from query string.
5. In JavaScript: for each log row, resolve `course_id` from content map; **discard** rows where `(user_id, course_id)` is not in the enrollment set (prevents counting activity from non-enrolled users).
6. Sum `watch_time` per `user_id`, sort descending, **take top 20**.

**Conceptual SQL equivalent:**

```sql
-- Simplified: attribution + enrollment gate done partly in app code
SELECT al.user_id, u.full_name, SUM(al.watch_time) AS total_watch_sec
FROM activity_log al
JOIN users u ON u.user_id = al.user_id AND u.role = 'student'
JOIN content ct ON ct.content_id = al.content_id
JOIN enrollments e
  ON e.user_id = al.user_id AND e.course_id = ct.course_id
WHERE ct.course_id = ANY($course_ids)
  AND ($start IS NULL OR al.event_at >= $start)
  AND ($end IS NULL OR al.event_at <= $end)
GROUP BY al.user_id, u.full_name
ORDER BY total_watch_sec DESC
LIMIT 20;
```

**Frontend use:** list “Most active students” (first 10 rows displayed) + stat card count + bar chart top 5.

---

### 5.2 `GET /analytics/underperforming` (instructor)

**Purpose:** Students whose **average quiz score** across attempts (in instructor’s quizzes) is below **`threshold`** (default **50**).

**Steps:**

1. Load quizzes for instructor courses → `quiz_id` list + `quiz_id → course_id`.
2. Load enrollments for instructor courses → allowed `(user_id, course_id)` pairs.
3. Query **`quiz_attempts`** joined to **`users`** (`users!inner`, `role = 'student'`) for `quiz_id IN (...)`.
4. Bucket scores per `user_id`, compute average, filter `avg < threshold`, sort ascending.

**Conceptual SQL:**

```sql
SELECT u.user_id, u.full_name,
       AVG(qa.score) AS avg_score,
       COUNT(*) AS attempts_count
FROM quiz_attempts qa
JOIN users u ON u.user_id = qa.user_id AND u.role = 'student'
JOIN quiz q ON q.quiz_id = qa.quiz_id
JOIN enrollments e
  ON e.user_id = qa.user_id AND e.course_id = q.course_id
WHERE q.course_id = ANY($course_ids)
GROUP BY u.user_id, u.full_name
HAVING AVG(qa.score) < $threshold
ORDER BY avg_score ASC;
```

**Frontend use:** table “Quiz: students below 50% average” + stat card “Low quiz scores”.

---

### 5.3 `GET /analytics/skipped-content` (instructor)

**Purpose:** Which **content items** were **skipped** most often (aggregated in DB).

**Query:**

```js
supabase.from('mv_skipped_content')
  .select('content_id, title, course_id, skip_count')
  .in('course_id', instructorCourseIds)
  .order('skip_count', { ascending: false })
  .limit(20)
```

Underlying view definition (see `ddl.sql`): counts **`activity_log`** rows whose **`activity_types.type_name = 'skip'`**, grouped by content.

**Frontend use:** “Skipped lessons” table (lesson title, course, skip count).

---

### 5.4 `GET /analytics/completion-rates` (instructor)

**Purpose:** Average completion percentage **per learner per course** (from materialized view).

**Query:**

```js
supabase.from('mv_completion_rates')
  .select('user_id, full_name, course_id, avg_completion_pct')
  .order('avg_completion_pct', { ascending: false })
// then either:
//   .in('course_id', mine)           -- all my courses
//   .eq('course_id', selected)       -- one course
```

View definition: aggregates **`content_progress`** joined to **`users`** and **`content`** by `(user_id, course_id)`.

**Frontend use:**

- Stat card “Completion rows” (length of result array).
- **Bar chart** “Completion spread”: buckets 0–25%, 26–50%, 51–75%, 76–100% computed client-side in `completionBucketsFrom()`.
- **DataTable** listing student, course title (resolved from `listMine()`), completion %.

---

### 5.5 `GET /analytics/instructor/:courseId` (instructor dashboard)

**Purpose:** Course snapshot: enrollment count, **top 5** learners by watch time, **at-risk** learners (low quiz average / completion shown in UI).

**Authorization:** `instructorOwnsCourse(userId, courseId)` → else **403**.

**Parallel queries:**

1. **Enrollment count**

```js
supabase.from('enrollments')
  .select('enrollment_id', { count: 'exact', head: true })
  .eq('course_id', courseId)
```

2. **Top students by watch time** (from **`mv_performance_summary`**)

```js
supabase.from('mv_performance_summary')
  .select('user_id, total_watch_sec, completion_pct, users(full_name)')
  .eq('course_id', courseId)
  .order('total_watch_sec', { ascending: false })
  .limit(5)
```

3. **At-risk** — rows in **`mv_performance_summary`** with **`avg_quiz_score < 50`**

```js
supabase.from('mv_performance_summary')
  .select('user_id, avg_quiz_score, completion_pct, users(full_name)')
  .eq('course_id', courseId)
  .lt('avg_quiz_score', 50)
  .order('avg_quiz_score', { ascending: true })
```

**Materialized view logic** (`mv_performance_summary`): joins **`enrollments`** → **`content`**, **`activity_log`**, **`content_progress`**, **`quiz`**, **`quiz_attempts`** with **LEFT JOIN** + **GROUP BY** `user_id, course_id`.

**Frontend use:** three **StatCards** (enrollments, top learners count, at-risk count) + two panels listing top students and at-risk students.

---

### 5.6 `GET /analytics/performance-trend/:userId` (instructor)

**Purpose:** Time-ordered quiz attempts for charts or drill-down (student vs instructor visibility differs).

**Instructor path:**

1. Load instructor `courseIds`.
2. Confirm student has **enrollment** in at least one of those courses:

```js
enrollments.where('user_id', userId).in('course_id', courseIds)
```

3. Load **`quiz_id`** list for instructor courses from **`quiz`**.
4. Query **`quiz_attempts`** for `user_id`, restricted to **`quiz_id IN (...)`**, ordered by **`attempt_date`**, nested **`quiz(title)`**, **`users(full_name)`**.

If no shared enrollment → empty array (privacy boundary).

**Note:** The current **`Analytics.jsx`** page does **not** call this endpoint; it could be used elsewhere or for future charts.

---

## 6. Frontend: How Data Is Loaded and Displayed

**File:** `learntrack-client/src/pages/instructor/Analytics.jsx`

### 6.1 Bootstrap

- **`coursesApi.listMine()`** → fills course dropdown (“All my courses” vs specific course).

### 6.2 Filters

- **`course_id`** — optional; passed as `{ course_id: selectedCourseId }` when a course is selected.
- **Date preset** — `All time`, `Last 7/30/90 days`; converted to **`start`/`end` ISO strings** only for endpoints that accept them (`activeStudents` receives `dateParams`).

### 6.3 Parallel fetch (main grid)

When filters change, `Promise.all` runs:

```js
analytics.activeStudents({ ...dateParams, ...courseQ })
analytics.completionRates(courseQ)
analytics.skippedContent(courseQ)
analytics.underperforming({ threshold: 50, ...courseQ })
```

### 6.4 Per-course dashboard

If **`selectedCourseId`** is set:

```js
analytics.instructorDash(selectedCourseId)
```

→ **`GET /analytics/instructor/:courseId`**.

### 6.5 UI components mapping

| UI block | Data source |
|----------|-------------|
| Stat cards (top row) | `active`, `completion`, `skipped`, `underperforming` array lengths |
| Snapshot cards (course selected) | `courseDash.enrollment_count`, `top_students`, `at_risk_students` |
| “Most active students” table | `active` (first 10, watch minutes) |
| Bar charts | `active` top 5 → minutes; `completion` → bucketed spread |
| Completion table | `completion` rows |
| Skipped content table | `skipped` rows |
| Underperforming table | `underperforming` rows |

### 6.6 Error message

On failure, shows generic error including hint that **materialized views may need refresh** (admin action).

---

## 7. Staleness and Refresh

Materialized views **`mv_performance_summary`**, **`mv_skipped_content`**, **`mv_completion_rates`** (and others) are **snapshots**. Until refreshed:

- **`/instructor/:courseId`** metrics may lag behind raw **`activity_log`** / **`quiz_attempts`**.
- **`active-students`** for instructors uses **live `activity_log`** (when date filters apply), so it can be fresher than MV-based panels.

**Refresh:** `POST /api/v1/analytics/refresh-summary` (**admin only**) → `rpc('refresh_analytics_views')`.

---

## 8. Quick Reference: Instructor vs Raw Tables vs MVs

| Feature | Instructor path uses |
|---------|----------------------|
| Active students (watch ranking) | Mostly **`activity_log`** + **`enrollments`** gate (not `mv_active_students`) |
| Underperforming | **`quiz_attempts`** + enrollment gate (not `mv_underperforming_students` for instructor filter) |
| Skipped content | **`mv_skipped_content`** |
| Completion spread / table | **`mv_completion_rates`** |
| Course snapshot top/at-risk | **`mv_performance_summary`** |

---

## 9. File Index

| Purpose | Path |
|---------|------|
| Instructor analytics UI | `learntrack-client/src/pages/instructor/Analytics.jsx` |
| API wrappers | `learntrack-client/src/api/index.js` (`analytics`) |
| Routes | `backend/src/routes/analytics.js` |
| Controller / queries | `backend/src/controllers/analyticsController.js` |
| MV definitions | `backend/src/db/ddl.sql` |

---

*End of document.*
