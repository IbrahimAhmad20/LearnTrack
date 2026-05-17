# LearnTrack — Full Project Walkthrough (Explain It Like You Built It)

This document is meant for **presentations and non-technical explanations**. It connects **what you see in the UI** → **what the backend API does** → **what gets stored in PostgreSQL (Supabase)** → **how analytics numbers are calculated**.

If you want the instructor analytics deep dive + SQL, see `INSTRUCTOR_ANALYTICS_DOCUMENTATION.md`.

---

## What LearnTrack is (one sentence)

LearnTrack is an online learning platform where **students enroll in courses**, **watch lessons**, **track completion**, **take quizzes**, and instructors/admins can **see analytics** built from those recorded behaviors.

---

## The big mental model (keep this slide in your head)

### Three layers

- **Frontend (`learntrack-client`)**: React pages/components that call REST endpoints using Axios.
- **Backend (`backend`)**: Express routes/controllers that validate JWT + roles, then read/write Supabase tables using `supabase.from(...)`.
- **Database (`backend/src/db/ddl.sql`)**: PostgreSQL schema hosted on Supabase.

### Two kinds of “numbers” you’ll talk about

- **Operational tables** (`activity_log`, `content_progress`, `quiz_attempts`, …): updated continuously as students learn.
- **Analytics snapshots** (`mv_*` materialized views): **precomputed joins** that make dashboards faster; they only update when refreshed.

---

## Repository layout (what folder means what)

```text
learntrack/
├── learntrack-client/      # React + Vite frontend
├── backend/                # Express API + Supabase integration
│   └── src/db/ddl.sql      # Database schema (tables, triggers, views)
├── DATABASE_GUIDE.md       # Deep DB explanation (tables + ER diagram)
├── DBMS_PROJECT_GUIDE.md   # DB-focused team guide (short)
├── LOGIN_AND_AUTH.md       # Auth gotchas (Supabase Auth vs public.users)
└── INSTRUCTOR_ANALYTICS_DOCUMENTATION.md  # Instructor analytics end-to-end + SQL
```

---

## Frontend: how the app is organized

### Tech stack

- **React + React Router** routes users by role (`/student`, `/instructor`, `/admin`).
- **Axios client** in `learntrack-client/src/api/index.js`:
  - Base URL comes from `VITE_API_URL` (defaults to `http://localhost:5000/api/v1`).
  - Attaches `Authorization: Bearer <token>` from `localStorage`.

### Routes (who sees what)

Defined in `learntrack-client/src/App.jsx`:

- **Student**: dashboard, browse courses, course detail player, quizzes list.
- **Instructor**: dashboard, manage courses, edit course content/quizzes, analytics.
- **Admin**: users/courses/analytics admin views.

### Layout pattern

Each role uses a layout shell (`layout/*Layout.jsx`) with:

- **Sidebar navigation**
- **Top navbar**
- Main content via `<Outlet />` (nested routes)

---

## Authentication & authorization (how “logged in” works)

### Login/register UI

Files: `learntrack-client/src/pages/auth/Login.jsx`, `Register.jsx`.

### Backend auth endpoints

Routes: `backend/src/routes/auth.js`

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout` (requires token)

Implementation highlights (`backend/src/controllers/authController.js`):

- Registration creates the user in **Supabase Auth** (this generates the UUID).
- The project also maintains **`public.users`** as the **profile table** (role, active flags, soft delete).
- Login verifies password using **`signInWithPassword`** against Supabase Auth (not by comparing `public.users.password` manually).

### Tokens + route protection

- Frontend stores JWT (`localStorage` key `lt_token`) and attaches it to API calls.
- Backend middleware (`backend/src/middleware/auth.js`):
  - **`verifyToken`**: validates JWT + checks user still active/not deleted + optional revocation via `user_sessions`.
  - **`requireRole(...)`**: ensures endpoint matches student/instructor/admin.

---

## Backend API: what it actually does

Entry point: `backend/src/app.js`

Mounted routes (all under `/api/v1`):

- `/auth` → signup/login/logout
- `/users` → profile/admin user management
- `/courses` → course CRUD + content CRUD + enrolled students list
- `/enrollments` → enroll + student enrollment views
- `/activity` → log learning events (play/pause/skip/complete + watch seconds)
- `/progress` → upsert per-content completion %
- `/quizzes` → quiz CRUD + attempts + grading
- `/analytics` → dashboards + instructor analytics endpoints
- `/instructors` → instructor profile updates

### Important implementation detail

The backend connects to Supabase using the **service role key** (`backend/src/db/connection.js`). That means the API can read/write broadly; **RLS policies exist in SQL**, but your coursework narrative usually treats the API + normalized schema as the “system design truth.”

---

## Database: how many tables + how they connect

### Table count (core operational tables)

From `backend/src/db/ddl.sql`, LearnTrack defines **17 tables**:

1. `users`
2. `activity_types`
3. `content_types`
4. `enrollment_statuses`
5. `question_types`
6. `instructors`
7. `courses`
8. `enrollments`
9. `content`
10. `activity_log`
11. `content_progress`
12. `quiz`
13. `quiz_questions`
14. `question_options`
15. `quiz_attempts`
16. `quiz_answers`
17. `user_sessions`

Plus **5 analytics materialized views**:

- `mv_performance_summary`
- `mv_active_students`
- `mv_underperforming_students`
- `mv_skipped_content`
- `mv_completion_rates`

### The relationships you should explain verbally

Think of it as four storylines that merge:

#### Identity & roles

- **`users`** holds everyone (student/instructor/admin).
- **`instructors`** is an extra profile row for people who teach (stable `instructor_id` used by courses).

#### Courses & syllabus

- **`courses`** belong to an **`instructors.instructor_id`**.
- **`content`** rows are lessons/resources inside a course.

#### Enrollment & permission to learn

- **`enrollments`** connects a **`users.user_id`** to a **`courses.course_id`** (unique pair).

#### Learning signals (what analytics consumes)

- **`activity_log`**: events like play/pause/skip + **watch_time seconds** + timestamps.
- **`content_progress`**: “how complete is this lesson for this student?” (0–100%).
- **Quiz subsystem**: `quiz` → `quiz_questions` → `question_options`; attempts stored in `quiz_attempts` + per-answer rows in `quiz_answers`.

### Why there are “lookup tables”

Tables like `activity_types`, `content_types`, `enrollment_statuses`, `question_types` exist so the DB stores **small integer IDs** everywhere instead of repeating strings like `"skip"` hundreds of thousands of times.

---

## Core user journeys (this is what you demo)

### Journey A — Instructor builds a course

Typical UI path:

- Instructor opens **Manage courses** → creates/edits a course.

Backend reality:

- Inserts/updates **`courses`** owned by that instructor’s **`instructors.instructor_id`**.
- Adds **`content`** rows (videos/docs/etc.).
- Optionally creates **`quiz`** + questions/options.

### Journey B — Student learns

Typical UI path:

- Student browses published courses → enrolls → opens course detail.

Backend reality:

- Enrollment creates **`enrollments`** row linking student ↔ course.

While watching (example flow in `student/CourseDetail.jsx`):

- Emit learning events via **`POST /activity`** → inserts **`activity_log`** rows (ties event type through **`activity_types`**).
- Periodically update **`PUT /progress/:contentId`** → upserts **`content_progress`**.

### Journey C — Student takes a quiz

Backend reality (`quizController.submitAttempt`):

- Loads quiz rules + question bank.
- Grades answers server-side using **`question_options.is_correct`**.
- Writes **`quiz_attempts`** + **`quiz_answers`**.

---

## Analytics: what instructors see and where numbers come from

UI page: `learntrack-client/src/pages/instructor/Analytics.jsx`

### Filters you should explain

- **Course filter**: “All my courses” vs one course (scopes analytics).
- **Date window** applies mainly to **watch-based ranking** (“active students”), not every chart.

### What each panel means (plain English)

#### “Active students / Most active students”

**Meaning**: rank learners by **total watched seconds** coming from **`activity_log.watch_time`**.

**Important fairness rule**: instructor analytics only counts activity that can be tied to **your courses** and usually requires the learner to be **enrolled** (see controller logic).

#### “Completion rows / Completion spread chart”

**Meaning**: For each learner + course, show **average lesson completion** derived from **`content_progress`** (materialized into `mv_completion_rates`).

The bar chart buckets learners into four ranges (0–25%, …) **in the browser** — it’s a presentation transform, not a separate DB query.

#### “Skipped lessons”

**Meaning**: Count how many times **`activity_log`** recorded event type **skip** for each lesson (`mv_skipped_content`).

#### “Low quiz scores”

**Meaning**: Find students whose **average attempt score** across relevant quizzes is below a threshold (default **50%**), based on **`quiz_attempts`**.

#### Course snapshot (only when one course is selected)

Shows:

- **Enrollment count** from **`enrollments`**
- **Top learners** and **at-risk learners** using **`mv_performance_summary`** (watch time + quiz average + completion snapshot)

### Why sometimes charts look “behind” real-time activity

Materialized views are **snapshots**. Admin refresh endpoint calls **`refresh_analytics_views()`** in SQL.

Meanwhile, instructor “active students” can use **`activity_log` directly**, so it may feel **more live** than MV-backed panels — that’s normal to mention honestly.

---

## Database functions/triggers you can name in a DBMS viva

These are defined in `backend/src/db/ddl.sql`:

### Analytics refresh

- **`refresh_analytics_views()`**: refreshes **all** `mv_*` views.
- **`refresh_performance_summary()`**: wrapper that calls `refresh_analytics_views()` (backward compatibility).

### Integrity automation

- **`check_instructor_role()` + trigger**: prevents invalid `instructors` rows.
- **`ensure_instructor_profile()` + trigger**: auto-creates instructor profile when role becomes instructor/admin.
- **`set_updated_at()` + triggers**: keeps `updated_at` columns consistent.

### Auth ↔ public profile sync

- **`handle_new_auth_user()`**: referenced pattern for syncing Supabase Auth users into **`public.users`** (depending on how your Supabase project is wired).

---

## “Where are the joins?” (simple explanation)

### Joins inside SQL views

Materialized views like `mv_performance_summary` combine:

- enrollments (who is in the course)
- content + activity logs (watch time)
- content progress (completion)
- quizzes + attempts (scores)

They use **`LEFT JOIN`** so a learner still appears even if some signals are missing yet.

### Join-like reads in the API

Many controllers fetch nested objects using Supabase selects (example pattern):

- `courses -> instructors -> users(full_name)`

That is conceptually the same idea as SQL joins, but expressed as **nested JSON** returned by PostgREST.

---

## Speaker outline you can follow (10 minutes)

### Slide 1 — Problem

Online courses generate lots of behavioral signals; we want instructors to see engagement + risk early.

### Slide 2 — Architecture

React → Express API → PostgreSQL (Supabase).

### Slide 3 — Core entities

Users, instructors, courses, enrollments, content.

### Slide 4 — Signals captured

Activity log events + progress percent + quiz attempts.

### Slide 5 — Analytics strategy

Some metrics computed live; heavy dashboards use materialized views refreshed periodically.

### Slide 6 — Demo path

Student watches lesson → logs activity → instructor analytics updates.

---

## Related docs in this repo

- **`DATABASE_GUIDE.md`**: detailed table-by-table explanation + ER diagram section.
- **`JOINS_SPOT_GUIDE.md`**: join-focused cheat sheet.
- **`LOGIN_AND_AUTH.md`**: explains Supabase Auth vs `public.users.password`.
- **`INSTRUCTOR_ANALYTICS_DOCUMENTATION.md`**: instructor analytics endpoints + SQL snippets.

---

## Honest note (optional but credible)

Some bundled markdown files may contain older wording (example: older backend README templates mentioning Oracle). Treat **`ddl.sql` + `connection.js` + controllers** as the source of truth for what this codebase actually runs today.
