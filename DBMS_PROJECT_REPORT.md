# LearnTrack — Database Management Systems Project Report

**Project title:** LearnTrack — Online Learning Platform with Learning Analytics  
**DBMS:** PostgreSQL 15+ (hosted via Supabase)  
**Application tier:** Node.js (Express) REST API; React (Vite) web client  

> **Detailed / submission PDF:** use the expanded LaTeX source  
> [`latex/DBMS_PROJECT_REPORT.tex`](latex/DBMS_PROJECT_REPORT.tex) (~20+ pages when compiled): methodology, requirement traceability, cardinality tables, full data dictionary, SQL listing, transactional steps, joins/analytics, appendices — **still no RLS** (security = app layer only). Instructions: [`latex/README.txt`](latex/README.txt).

*Fill in: Course code, institution, team members, supervisor, submission date.*

---

## Abstract

LearnTrack is a full-stack learning management system that stores users, courses, structured content, enrollments, fine-grained activity events, per-item progress, and a complete quiz subsystem (questions, options, attempts, and per-answer records). The database is implemented in **PostgreSQL** with **referential integrity**, **check constraints**, **lookup normalization**, **triggers**, and **materialized views** for analytics. The middle tier exposes a versioned REST API (`/api/v1`) and uses the Supabase client for server-side data access. This report emphasises **schema design**, **query patterns**, **joins and aggregations**, **application-level access control** (JWT, middleware), and **decision-ready analytics** derived from transactional data.

**Keywords:** PostgreSQL, Supabase, normalization, materialized views, learning analytics, REST API.

---

## 1. Introduction

### 1.1 Context

Educational platforms generate high-volume, relational data: who teaches what, who enrolled, what content exists, how learners interact (play, pause, skip, completion), and how they perform on assessments. A robust DBMS design must enforce consistency (no orphan enrollments, no duplicate enrollments per user per course), support reporting (aggregates across users and courses), and support an application layer that restricts sensitive operations to the appropriate users.

### 1.2 Objectives

1. Design a **normalized relational schema** for courses, content, enrollments, activity, progress, and quizzes.  
2. Implement **integrity constraints** (primary keys, foreign keys, uniqueness, checks).  
3. Support **analytics** via SQL joins and **precomputed materialized views**.  
4. Enforce **access control** in the **application tier** (JWT, role-based middleware) with queries scoped to the current user or instructor.  
5. Provide a **maintainable API** that maps cleanly to tables and views.  
6. Demonstrate **DBA-oriented features**: triggers, functions, comments, indexes.

### 1.3 Scope

- **In scope:** Relational model, DDL/DML behaviour as used by the app, analytics summaries, deployment considerations.  
- **Out of scope (unless extended):** Formal user study, machine-learning grade prediction, native mobile apps.

---

## 2. System Overview

### 2.1 Architecture

| Layer | Technology | Role |
|--------|------------|------|
| Client | React + Vite | UI, role-based routes, calls REST API |
| API | Express.js | Authentication, validation, orchestration |
| Data access | `@supabase/supabase-js` | CRUD on tables; `rpc()` for DB functions |
| Database | PostgreSQL (Supabase) | Storage, constraints, views, triggers |

The API entry point mounts routes under `/api/v1` (health, auth, users, courses, enrollments, activity, progress, quizzes, analytics, instructors).

### 2.2 User Roles

- **Student:** browse published courses, enroll, consume content, log activity, update progress, take quizzes.  
- **Instructor:** manage own courses and content, create quizzes and questions, view analytics scoped to own courses.  
- **Admin:** broader user/course management and platform analytics (as implemented in routes).

---

## 3. Requirements (Data-Centric)

### 3.1 Functional

- Maintain **users** and optional **instructor** profiles.  
- **Courses** belong to instructors; support soft delete and publish flag.  
- **Content** items are ordered within a course and typed (video, document, quiz syllabus item).  
- **Enrollments** link students to courses with a **status** from a lookup table.  
- **Activity log** records events with type and watch time.  
- **Content progress** stores percentage completion per user per content item.  
- **Quizzes** per course; **questions** and **options**; **attempts** and **answers** for auditing and scoring.

### 3.2 Non-Functional (Database)

- **Consistency:** FKs and unique constraints prevent invalid references and duplicate enrollments.  
- **Performance:** Indexes on foreign keys and filter columns; materialized views for heavy dashboards.  
- **Application security:** JWT and middleware; queries filtered by role and ownership in controllers.  
- **Auditability:** Timestamps, optional soft delete, granular quiz answer rows.

---

## 4. Conceptual Database Design

### 4.1 Entity–Relationship Summary

Core entities and relationships:

- **USER** (1) — (0..1) **INSTRUCTOR_PROFILE**  
- **INSTRUCTOR_PROFILE** (1) — (many) **COURSE**  
- **USER** (many) — (many) **COURSE** via **ENROLLMENT**  
- **COURSE** (1) — (many) **CONTENT**  
- **USER** + **CONTENT** — (many) **ACTIVITY_LOG** events  
- **USER** + **CONTENT** — (0..1) **CONTENT_PROGRESS** row per pair (unique)  
- **COURSE** (1) — (many) **QUIZ**  
- **QUIZ** (1) — (many) **QUESTION** — (many) **OPTION**  
- **USER** + **QUIZ** — (many) **ATTEMPT** — (many) **ANSWER** (per question)

Lookup entities decouple enumerations: **ACTIVITY_TYPE**, **CONTENT_TYPE**, **ENROLLMENT_STATUS**, **QUESTION_TYPE**.

### 4.2 Design Choices

- **`users.user_id` as UUID:** Aligns with Supabase Auth (`auth.users.id`), avoiding a separate integer surrogate for identity.  
- **Integer surrogates** (`SERIAL`) for most business entities (courses, content, quizzes) for compact joins and human-readable admin URLs.  
- **Soft delete** on `users` and `courses` via `deleted_at` preserves history and avoids breaking FK chains abruptly.

---

## 5. Logical Design and Normalization

### 5.1 Normal Forms

- **1NF:** Atomic columns; repeating option sets moved to `question_options` rather than wide question tables.  
- **2NF / 3NF:** Lookup tables (`activity_types`, `content_types`, `enrollment_statuses`, `question_types`) remove transitive dependency on string labels; status and type IDs are stable keys.  
- **BCNF-style reasoning:** Each lookup has a unique business key (`type_name`, `status_name`).

### 5.2 Referential Integrity

Foreign keys enforce:

- Enrollments reference valid `users` and `courses`.  
- Content references `courses` and `content_types`.  
- Activity and progress reference `users` and `content`.  
- Quiz subgraph references `quiz`, `quiz_questions`, `question_options`, `quiz_attempts`.

`ON DELETE` behaviour is chosen per relationship (e.g. cascade where child rows are meaningless without parent; restrict where business rules forbid silent removal).

### 5.3 Constraints Beyond FKs

Examples from the DDL:

- `users.role` **CHECK** ∈ {`student`, `instructor`, `admin`}.  
- `content_progress.progress_percent` **CHECK** between 0 and 100.  
- `quiz_attempts.score` **CHECK** between 0 and 100.  
- `enrollments` **UNIQUE** (`user_id`, `course_id`) — one enrollment row per pair.  
- `user_sessions.token_hash` length expectation documented (64 hex chars for SHA-256).

---

## 6. Physical Design

### 6.1 Indexes

Representative indexes (non-exhaustive):

- `courses(instructor_id)`, `courses(category)`, partial index on published non-deleted courses.  
- `enrollments(course_id)`, `enrollments(user_id)`.  
- `activity_log(user_id)`, `activity_log(content_id)`, `activity_log(event_at DESC)`.  
- `quiz_attempts(user_id)`, `quiz_attempts(quiz_id)`.  
- **Unique indexes on materialized views** to support `REFRESH MATERIALIZED VIEW CONCURRENTLY` where applicable and to speed lookups.

### 6.2 Data Types

- **UUID** for global user identity.  
- **TIMESTAMPTZ** for audit and event ordering.  
- **NUMERIC(5,2)** for scores and percentages where decimal precision matters.  
- **INET** for optional IP on sessions.

---

## 7. SQL Objects and Database Programming

### 7.1 DDL Summary

The authoritative script is `backend/src/db/ddl.sql`. It:

- Drops dependent materialized views and tables in safe order (for repeatable dev resets).  
- Creates all base tables, indexes, comments.  
- Defines materialized views and refresh functions.  
- Defines triggers and trigger functions.

### 7.2 Triggers and Functions

| Object | Purpose |
|--------|---------|
| `check_instructor_role()` | Ensures only instructor/admin users get rows in `instructors`. |
| `ensure_instructor_profile()` | Auto-inserts `instructors` when role becomes instructor/admin. |
| `set_updated_at()` | Maintains `updated_at` on designated tables on UPDATE. |
| `handle_new_auth_user()` | Syncs new auth user into `public.users` (hook/trigger pattern). |
| `refresh_analytics_views()` | Refreshes all analytics materialized views (batch). |
| `refresh_performance_summary()` | Wrapper for backward compatibility. |

These demonstrate **procedural SQL (PL/pgSQL)** and **event-driven integrity** (triggers).

### 7.3 Materialized Views (Analytical Relations)

Materialized views materialize expensive join/aggregate queries as **stored snapshots**:

| View | Role |
|------|------|
| `mv_performance_summary` | Per `(user_id, course_id)`: watch time, avg quiz score, completion %. |
| `mv_active_students` | Students ranked by engagement (watch time, last event). |
| `mv_underperforming_students` | Learners with aggregate quiz performance. |
| `mv_skipped_content` | Content items frequently skipped. |
| `mv_completion_rates` | Average completion per user per course. |

**Join logic example (`mv_performance_summary`):** starts from `enrollments`, **LEFT JOIN**s `content`, `activity_log`, `content_progress`, `quiz`, and `quiz_attempts` so enrolled learners appear even if some fact tables are empty; **GROUP BY** `user_id`, `course_id` with **SUM** / **AVG** / **COALESCE**.

**Refresh:** `REFRESH MATERIALIZED VIEW` (optionally `CONCURRENTLY` where unique indexes exist). The API exposes an admin-triggered `rpc('refresh_analytics_views')` pattern for on-demand refresh.

---

## 8. Transactional Workflows and Application Mapping

### 8.1 Enrollment

Application validates course published and not deleted, checks duplicate enrollment, resolves `status_id` for `'active'` from `enrollment_statuses`, then **INSERT** into `enrollments`. The unique constraint prevents race duplicates at the database level.

### 8.2 Quiz Attempt (Grading)

Server loads questions and options, maps selected `option_id` to `is_correct`, computes weighted score vs `pass_score`, inserts `quiz_attempts` and bulk **INSERT** into `quiz_answers`. This is a **multi-statement business transaction** conceptually; production hardening could wrap in explicit DB transactions or move grading into a stored procedure.

### 8.3 Analytics Endpoints

Controllers query:

- Base tables with **nested selects** (PostgREST-style joins) for instructor-scoped aggregates.  
- Materialized views for dashboard metrics (e.g. admin overview, completion rates).

---

## 9. Query Categories Used in the Project

| Category | Examples |
|----------|----------|
| **Selection / projection** | Filter published courses, list content by `sort_order`. |
| **Joins** | Instructor-owned courses; enrollment with user and status; quiz with nested questions/options. |
| **Aggregation** | `COUNT`, `AVG`, `SUM`, `MAX` in materialized views and API aggregations. |
| **Mutations** | `INSERT`, `UPDATE`, `DELETE` via Supabase client. |
| **Metadata** | `COMMENT ON` columns and views for documentation. |

---

## 10. Testing and Quality (Database-Aware)

- Backend **Jest + Supertest** suites exercise API behaviour against a real or test Supabase/Postgres instance (see `backend/tests/`).  
- **Regression tests** help protect analytics and auth flows.  
- **Recommendation:** add CI (e.g. GitHub Actions) to run `npm test` and client `npm run test` / lint on each push.

---

## 11. Deployment and Configuration

- **Frontend:** Vite build; environment `VITE_API_URL` must point to production API base including `/api/v1`.  
- **Backend:** `CLIENT_ORIGIN` must match the deployed frontend for CORS.  
- **Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` — never committed; use host env or `.env` locally with `.gitignore`.  
- **Supabase:** Apply `ddl.sql` to production; configure Auth URLs for production domain.

*(See `DEPLOYMENT_GUIDE_VERCEL.md` in this repo for a practical checklist.)*

---

## 12. Limitations and Future Work (DBMS-Focused)

1. **Stored procedures** for atomic enrollment or grading to strengthen transactional boundaries.  
2. **CSV/report functions** returning `SETOF` or JSON for registrar-style exports.  
3. **Audit tables** populated by triggers on `courses`, `enrollments`, `quiz`.  
4. **Concurrent refresh** scheduling with logging table for materialized view refresh jobs.  
5. **Sequence repair** documentation after bulk imports (`setval` on serial sequences).  
6. Optional **read replicas** or caching layer if analytics traffic grows.

---

## 13. Conclusion

LearnTrack demonstrates a **complete relational design** for online learning: normalized lookups, strict keys, rich behavioural and assessment data, and **PostgreSQL advanced features** (triggers, functions, materialized views). The application layer respects the schema by routing operations through constrained APIs while the database remains the **source of truth** for integrity and analytics. The project is suitable for assessment as a **DBMS course deliverable** with emphasis on design rationale, SQL, and data-driven reporting.

---

## 14. References and Artefacts

- PostgreSQL Documentation: [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)  
- Supabase Documentation: [https://supabase.com/docs](https://supabase.com/docs)  

**Project artefacts (repository):**

- `backend/src/db/ddl.sql` — full DDL, views, triggers.  
- `backend/src/db/seed.sql` — seed data (if used).  
- `backend/src/db/connection.js` — Supabase client and connection check.  
- `backend/src/controllers/*` — query and transaction orchestration.  
- `learntrack-client/src/api/index.js` — API base URL configuration.  
- `DBMS_PROJECT_GUIDE.md`, `DBMS_DIAGRAMS.md` — supplementary documentation.  
- **`latex/DBMS_PROJECT_REPORT.tex`** — LaTeX version of this report (no RLS; compile with `pdflatex`).

---

*End of report.*
