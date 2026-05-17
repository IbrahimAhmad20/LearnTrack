-- ============================================================
-- LearnTrack v2 – Production DDL (PostgreSQL / Supabase)
-- UUID edition – user_id is UUID matching Supabase auth.uid()
-- ============================================================
-- FIXES APPLIED (from Complete Guide § 3):
--   [F1]  courses.category → FK to new categories lookup table
--   [F2]  quiz.content_id → FK to content (links quiz into curriculum)
--   [F3]  quiz_answers UNIQUE constraint removed (MCQ multi-answer)
--   [F4]  content_progress.completed_at column added
--   [F5]  content.is_free_preview flag added + RLS policy updated
--   [F6]  enrollments.user_id ON DELETE CASCADE → ON DELETE RESTRICT
--   [F7]  mv_underperforming_students grouped per-course, not globally
--   [F8]  quiz_attempts.score DB-computed via trigger (not app-trusted)
--   [F9]  courses.total_duration_sec + auto-maintain trigger
--   [F10] user_sessions acknowledged as intentional demo artefact
-- ============================================================

-- ── Safe re-run teardown (reverse dependency order) ──────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_performance_summary      CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_active_students          CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_underperforming_students CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_skipped_content          CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_completion_rates         CASCADE;
DROP TABLE IF EXISTS quiz_answers         CASCADE;
DROP TABLE IF EXISTS question_options     CASCADE;
DROP TABLE IF EXISTS quiz_questions       CASCADE;
DROP TABLE IF EXISTS question_types       CASCADE;
DROP TABLE IF EXISTS quiz_attempts        CASCADE;
DROP TABLE IF EXISTS quiz                 CASCADE;
DROP TABLE IF EXISTS content_progress     CASCADE;
DROP TABLE IF EXISTS user_sessions        CASCADE;
DROP TABLE IF EXISTS activity_log         CASCADE;
DROP TABLE IF EXISTS activity_types       CASCADE;
DROP TABLE IF EXISTS content              CASCADE;
DROP TABLE IF EXISTS content_types        CASCADE;
DROP TABLE IF EXISTS enrollments          CASCADE;
DROP TABLE IF EXISTS enrollment_statuses  CASCADE;
DROP TABLE IF EXISTS courses              CASCADE;
DROP TABLE IF EXISTS categories           CASCADE;  -- [F1] new lookup table
DROP TABLE IF EXISTS instructors          CASCADE;
DROP TABLE IF EXISTS users               CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 1 – ROOT ENTITIES
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. USERS ─────────────────────────────────────────────────────────────────
CREATE TABLE users (
  user_id    UUID         PRIMARY KEY,
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(20)  NOT NULL DEFAULT 'student'
                          CHECK (role IN ('student', 'instructor', 'admin')),
  bio        TEXT,
  avatar_url VARCHAR(500),
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN users.user_id IS
  'UUID from Supabase auth.users.id. Created by Supabase on registration.';
COMMENT ON COLUMN users.deleted_at IS
  'NULL = active. Soft delete — filter with WHERE deleted_at IS NULL.';

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 2 – LOOKUP / REFERENCE TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- ── 2. ACTIVITY_TYPES ────────────────────────────────────────────────────────
CREATE TABLE activity_types (
  type_id   SERIAL      PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO activity_types (type_name) VALUES
  ('play'), ('pause'), ('skip'), ('seek'), ('complete');

-- ── 3. CONTENT_TYPES ─────────────────────────────────────────────────────────
CREATE TABLE content_types (
  type_id   SERIAL      PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO content_types (type_name) VALUES
  ('video'), ('document'), ('quiz');

-- ── 4. ENROLLMENT_STATUSES ───────────────────────────────────────────────────
CREATE TABLE enrollment_statuses (
  status_id   SERIAL      PRIMARY KEY,
  status_name VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO enrollment_statuses (status_name) VALUES
  ('active'), ('completed'), ('dropped');

-- ── 5. QUESTION_TYPES ────────────────────────────────────────────────────────
CREATE TABLE question_types (
  type_id     SERIAL       PRIMARY KEY,
  type_name   VARCHAR(50)  NOT NULL UNIQUE,
  description VARCHAR(200)
);
INSERT INTO question_types (type_name, description) VALUES
  ('mcq',        'Multiple choice – one or more correct options'),
  ('true_false', 'Binary choice – exactly two options');

-- ── 6. CATEGORIES  [F1 NEW] ──────────────────────────────────────────────────
-- Replaces courses.category free-text column.
-- Follows the same Tier 2 pattern as activity_types, content_types, etc.
CREATE TABLE categories (
  category_id SERIAL       PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE
);
INSERT INTO categories (name) VALUES
  ('Programming'), ('Web Development'), ('Data Science'),
  ('Design'), ('Business'), ('Marketing'), ('DevOps'), ('Other');

COMMENT ON TABLE categories IS
  '[F1] Controlled lookup replacing uncontrolled free-text courses.category.';

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 3 – INSTRUCTOR PROFILE
-- ────────────────────────────────────────────────────────────────────────────

-- ── 7. INSTRUCTORS ───────────────────────────────────────────────────────────
CREATE TABLE instructors (
  instructor_id SERIAL       PRIMARY KEY,
  user_id       UUID         NOT NULL UNIQUE
                             REFERENCES users(user_id) ON DELETE CASCADE,
  department    VARCHAR(100),
  qualification VARCHAR(200),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION check_instructor_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE user_id = NEW.user_id
      AND role IN ('instructor', 'admin')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User % does not have instructor or admin role', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_instructor_role
  BEFORE INSERT OR UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION check_instructor_role();

CREATE OR REPLACE FUNCTION ensure_instructor_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IN ('instructor', 'admin') AND NEW.deleted_at IS NULL THEN
    INSERT INTO instructors (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_instructor_profile ON users;
CREATE TRIGGER trg_ensure_instructor_profile
  AFTER INSERT OR UPDATE OF role, deleted_at ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_instructor_profile();

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 4 – COURSES AND CONTENT
-- ────────────────────────────────────────────────────────────────────────────

-- ── 8. COURSES ───────────────────────────────────────────────────────────────
-- [F1] category VARCHAR(100) → category_id INT FK REFERENCES categories
-- [F9] total_duration_sec INT DEFAULT 0 added; maintained by trigger
CREATE TABLE courses (
  course_id          SERIAL       PRIMARY KEY,
  instructor_id      INT          NOT NULL
                                  REFERENCES instructors(instructor_id)
                                  ON DELETE RESTRICT,
  title              VARCHAR(200) NOT NULL,
  description        TEXT,
  -- [F1] was: category VARCHAR(100)
  category_id        INT          REFERENCES categories(category_id)
                                  ON DELETE SET NULL,
  thumbnail_url      VARCHAR(500),
  is_published       BOOLEAN      NOT NULL DEFAULT FALSE,
  -- [F9] denormalized total — maintained by trg_maintain_course_duration
  total_duration_sec INT          NOT NULL DEFAULT 0,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_instructor  ON courses(instructor_id);
CREATE INDEX idx_courses_category    ON courses(category_id);     -- [F1] was category text
CREATE INDEX idx_courses_published   ON courses(is_published) WHERE deleted_at IS NULL;

COMMENT ON COLUMN courses.category_id IS
  '[F1] FK to categories lookup table. Replaces uncontrolled free-text category column.';
COMMENT ON COLUMN courses.total_duration_sec IS
  '[F9] Denormalized sum of content.duration_sec. Auto-maintained by trg_maintain_course_duration.';

-- ── 9. ENROLLMENTS ───────────────────────────────────────────────────────────
-- [F6] user_id ON DELETE CASCADE → ON DELETE RESTRICT
--      Deleting a user with enrollments now raises an error.
--      Use soft-delete (users.deleted_at) instead of hard-delete.
CREATE TABLE enrollments (
  enrollment_id SERIAL      PRIMARY KEY,
  -- [F6] was: ON DELETE CASCADE (would silently erase purchase history)
  user_id       UUID        NOT NULL REFERENCES users(user_id)     ON DELETE RESTRICT,
  course_id     INT         NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  status_id     INT         NOT NULL
                            REFERENCES enrollment_statuses(status_id)
                            ON DELETE RESTRICT
                            DEFAULT 1,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_user   ON enrollments(user_id);

COMMENT ON COLUMN enrollments.user_id IS
  '[F6] Changed from ON DELETE CASCADE to ON DELETE RESTRICT. '
  'Enrollment history must never be lost. Use soft-delete on users instead.';

-- ── 10. CONTENT ───────────────────────────────────────────────────────────────
-- [F5] is_free_preview BOOLEAN added
CREATE TABLE content (
  content_id      SERIAL        PRIMARY KEY,
  course_id       INT           NOT NULL REFERENCES courses(course_id)     ON DELETE CASCADE,
  content_type_id INT           NOT NULL REFERENCES content_types(type_id) ON DELETE RESTRICT,
  title           VARCHAR(200)  NOT NULL,
  content_url     VARCHAR(1000),
  content_body    TEXT,
  duration_sec    INT           CHECK (duration_sec > 0),
  sort_order      INT           NOT NULL DEFAULT 0,
  is_published    BOOLEAN       NOT NULL DEFAULT FALSE,
  -- [F5] Allows unauthenticated/non-enrolled access for preview lessons
  is_free_preview BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_course ON content(course_id);

COMMENT ON COLUMN content.is_free_preview IS
  '[F5] TRUE = publicly readable without enrollment. '
  'RLS policy content_published_read allows unauthenticated access when this is TRUE.';

-- ── [F9] Trigger: auto-maintain courses.total_duration_sec ───────────────────
CREATE OR REPLACE FUNCTION maintain_course_duration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Recalculate total for the affected course(s)
  IF TG_OP = 'DELETE' THEN
    UPDATE courses
    SET total_duration_sec = COALESCE(
      (SELECT SUM(duration_sec) FROM content
       WHERE course_id = OLD.course_id AND duration_sec IS NOT NULL), 0)
    WHERE course_id = OLD.course_id;
    RETURN OLD;
  ELSE
    UPDATE courses
    SET total_duration_sec = COALESCE(
      (SELECT SUM(duration_sec) FROM content
       WHERE course_id = NEW.course_id AND duration_sec IS NOT NULL), 0)
    WHERE course_id = NEW.course_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_maintain_course_duration
  AFTER INSERT OR UPDATE OF duration_sec OR DELETE ON content
  FOR EACH ROW EXECUTE FUNCTION maintain_course_duration();

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 5 – ACTIVITY TRACKING
-- ────────────────────────────────────────────────────────────────────────────

-- ── 11. ACTIVITY_LOG ─────────────────────────────────────────────────────────
CREATE TABLE activity_log (
  log_id     SERIAL      PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(user_id)          ON DELETE CASCADE,
  content_id INT         NOT NULL REFERENCES content(content_id)     ON DELETE CASCADE,
  type_id    INT         NOT NULL REFERENCES activity_types(type_id) ON DELETE RESTRICT,
  watch_time INT         NOT NULL DEFAULT 0 CHECK (watch_time >= 0),
  event_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_user     ON activity_log(user_id);
CREATE INDEX idx_activity_content  ON activity_log(content_id);
CREATE INDEX idx_activity_event_at ON activity_log(event_at DESC);

-- ── 12. CONTENT_PROGRESS ─────────────────────────────────────────────────────
-- [F4] completed_at TIMESTAMPTZ added
CREATE TABLE content_progress (
  progress_id      SERIAL       PRIMARY KEY,
  user_id          UUID         NOT NULL REFERENCES users(user_id)      ON DELETE CASCADE,
  content_id       INT          NOT NULL REFERENCES content(content_id) ON DELETE CASCADE,
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
                                CHECK (progress_percent BETWEEN 0 AND 100),
  last_watched_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- [F4] NULL until the lesson is completed (progress_percent = 100)
  completed_at     TIMESTAMPTZ,
  UNIQUE (user_id, content_id)
);

CREATE INDEX idx_progress_user ON content_progress(user_id);

COMMENT ON COLUMN content_progress.completed_at IS
  '[F4] Set automatically by trg_stamp_content_completed when progress_percent reaches 100. '
  'Required for certificate issuance and completion audit trails.';

-- ── [F4] Trigger: stamp completed_at when progress reaches 100 ───────────────
CREATE OR REPLACE FUNCTION stamp_content_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.progress_percent = 100 AND (OLD.completed_at IS NULL OR OLD.progress_percent < 100) THEN
    NEW.completed_at := NOW();
  ELSIF NEW.progress_percent < 100 THEN
    -- Reset if progress is rolled back (e.g., re-watch)
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamp_content_completed
  BEFORE INSERT OR UPDATE OF progress_percent ON content_progress
  FOR EACH ROW EXECUTE FUNCTION stamp_content_completed();

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 6 – QUIZ SYSTEM
-- ────────────────────────────────────────────────────────────────────────────

-- ── 13. QUIZ ─────────────────────────────────────────────────────────────────
-- [F2] content_id INT UNIQUE FK added — links quiz into the course curriculum
CREATE TABLE quiz (
  quiz_id        SERIAL       PRIMARY KEY,
  course_id      INT          NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  -- [F2] NULL for legacy quizzes; set for quizzes created from a content item
  content_id     INT          UNIQUE REFERENCES content(content_id) ON DELETE SET NULL,
  title          VARCHAR(200) NOT NULL,
  time_limit_min INT          CHECK (time_limit_min > 0),
  pass_score     NUMERIC(5,2) NOT NULL DEFAULT 50
                              CHECK (pass_score BETWEEN 0 AND 100),
  allow_multiple BOOLEAN      NOT NULL DEFAULT TRUE,
  is_published   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_course ON quiz(course_id);

COMMENT ON COLUMN quiz.content_id IS
  '[F2] Links this quiz to its content row so it can be ordered alongside '
  'videos and documents via content.sort_order. UNIQUE enforces 1:1 mapping.';

-- ── 14. QUIZ_QUESTIONS ───────────────────────────────────────────────────────
CREATE TABLE quiz_questions (
  question_id      SERIAL       PRIMARY KEY,
  quiz_id          INT          NOT NULL REFERENCES quiz(quiz_id)           ON DELETE CASCADE,
  question_type_id INT          NOT NULL REFERENCES question_types(type_id) ON DELETE RESTRICT,
  question_text    TEXT         NOT NULL,
  sort_order       INT          NOT NULL DEFAULT 0,
  points           NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (points > 0),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_quiz ON quiz_questions(quiz_id);

-- ── 15. QUESTION_OPTIONS ─────────────────────────────────────────────────────
CREATE TABLE question_options (
  option_id   SERIAL       PRIMARY KEY,
  question_id INT          NOT NULL REFERENCES quiz_questions(question_id) ON DELETE CASCADE,
  option_text VARCHAR(500) NOT NULL,
  is_correct  BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_options_question ON question_options(question_id);

-- ── 16. QUIZ_ATTEMPTS ────────────────────────────────────────────────────────
-- [F8] score is now DB-computed by trigger, not trusted from the application
CREATE TABLE quiz_attempts (
  attempt_id   SERIAL       PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  quiz_id      INT          NOT NULL REFERENCES quiz(quiz_id)  ON DELETE CASCADE,
  -- [F8] Populated automatically by trg_compute_attempt_score after answers are inserted.
  --      Application should insert 0 initially; the trigger overwrites it.
  score        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  passed       BOOLEAN      NOT NULL DEFAULT FALSE,
  attempt_date TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attempt_user ON quiz_attempts(user_id);
CREATE INDEX idx_attempt_quiz ON quiz_attempts(quiz_id);

COMMENT ON COLUMN quiz_attempts.score IS
  '[F8] DB-computed. Trigger trg_compute_attempt_score recalculates this '
  'after every quiz_answers INSERT, preventing client-side score tampering.';

-- ── 17. QUIZ_ANSWERS ─────────────────────────────────────────────────────────
-- [F3] UNIQUE(attempt_id, question_id) REMOVED to allow MCQ multi-answer
CREATE TABLE quiz_answers (
  answer_id   SERIAL  PRIMARY KEY,
  attempt_id  INT     NOT NULL REFERENCES quiz_attempts(attempt_id)   ON DELETE CASCADE,
  question_id INT     NOT NULL REFERENCES quiz_questions(question_id) ON DELETE CASCADE,
  option_id   INT     NOT NULL REFERENCES question_options(option_id) ON DELETE CASCADE,
  is_correct  BOOLEAN NOT NULL
  -- [F3] No UNIQUE constraint here — MCQ questions allow multiple selected options
);

CREATE INDEX idx_answers_attempt  ON quiz_answers(attempt_id);
CREATE INDEX idx_answers_question ON quiz_answers(question_id);

COMMENT ON TABLE quiz_answers IS
  '[F3] UNIQUE(attempt_id, question_id) removed. MCQ questions may have '
  'multiple selected options, each stored as a separate row.';


CREATE TRIGGER trg_compute_attempt_score
  AFTER INSERT ON quiz_answers
  FOR EACH ROW EXECUTE FUNCTION compute_attempt_score();

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 7 – SESSION MANAGEMENT
-- ────────────────────────────────────────────────────────────────────────────

-- ── 18. USER_SESSIONS ────────────────────────────────────────────────────────
-- [F10] NOTE: This table is intentionally retained for the DBMS project
-- to demonstrate session table design. In a production deployment on Supabase,
-- you would rely on auth.sessions (managed by Supabase Auth) and drop this table
-- to avoid split-brain session state. Acknowledge this trade-off if asked.
CREATE TABLE user_sessions (
  session_id SERIAL       PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(64)  NOT NULL,   -- SHA-256 hex digest = exactly 64 chars
  login_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  logout_at  TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_session_user       ON user_sessions(user_id);
CREATE INDEX idx_session_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_session_active     ON user_sessions(expires_at)
  WHERE logout_at IS NULL;

COMMENT ON TABLE user_sessions IS
  '[F10] Retained for DBMS project demonstration only. Redundant with Supabase '
  'auth.sessions in production — acknowledge the trade-off in presentations.';

-- ────────────────────────────────────────────────────────────────────────────
-- TIER 8 – MATERIALIZED VIEWS (analytics)
-- ────────────────────────────────────────────────────────────────────────────

-- ── 19. MV_PERFORMANCE_SUMMARY ───────────────────────────────────────────────
CREATE MATERIALIZED VIEW mv_performance_summary AS
SELECT
  e.user_id,
  e.course_id,
  COALESCE(SUM(al.watch_time), 0)                          AS total_watch_sec,
  COALESCE(ROUND(AVG(qa.score)::NUMERIC, 2), 0)            AS avg_quiz_score,
  COALESCE(ROUND(AVG(cp.progress_percent)::NUMERIC, 2), 0) AS completion_pct,
  NOW()                                                    AS last_refreshed
FROM enrollments e
LEFT JOIN content c          ON c.course_id   = e.course_id
LEFT JOIN activity_log al    ON al.content_id = c.content_id AND al.user_id = e.user_id
LEFT JOIN content_progress cp ON cp.content_id = c.content_id AND cp.user_id = e.user_id
LEFT JOIN quiz q              ON q.course_id   = e.course_id
LEFT JOIN quiz_attempts qa    ON qa.quiz_id    = q.quiz_id    AND qa.user_id = e.user_id
GROUP BY e.user_id, e.course_id
WITH DATA;

CREATE UNIQUE INDEX idx_mv_perf_summary
  ON mv_performance_summary(user_id, course_id);

COMMENT ON MATERIALIZED VIEW mv_performance_summary IS
  'Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_summary;
   Schedule via pg_cron or Supabase Edge Function cron (every 15-60 min).';

-- ── 20. MV_ACTIVE_STUDENTS ───────────────────────────────────────────────────
CREATE MATERIALIZED VIEW mv_active_students AS
SELECT
  al.user_id,
  u.full_name,
  COALESCE(SUM(al.watch_time), 0) AS total_watch_sec,
  MAX(al.event_at)                AS last_event_at
FROM activity_log al
JOIN users u ON u.user_id = al.user_id
WHERE u.role = 'student'
GROUP BY al.user_id, u.full_name
WITH DATA;

CREATE UNIQUE INDEX idx_mv_active_students_user  ON mv_active_students(user_id);
CREATE INDEX        idx_mv_active_students_watch ON mv_active_students(total_watch_sec DESC);

-- ── 21. MV_UNDERPERFORMING_STUDENTS  [F7 FIXED] ──────────────────────────────
-- Was: grouped globally across all courses (meaningless cross-platform average).
-- Fix: grouped per (user, course) by joining through quiz.course_id.
--      Matches the pattern used in mv_performance_summary.
CREATE MATERIALIZED VIEW mv_underperforming_students AS
SELECT
  qa.user_id,
  u.full_name,
  q.course_id,                                         -- [F7] added
  ROUND(AVG(qa.score)::NUMERIC, 2) AS avg_score,
  COUNT(*)                         AS attempts_count
FROM quiz_attempts qa
JOIN users u ON u.user_id  = qa.user_id
JOIN quiz  q ON q.quiz_id  = qa.quiz_id               -- [F7] join to get course_id
GROUP BY qa.user_id, u.full_name, q.course_id         -- [F7] group per course
WITH DATA;

CREATE UNIQUE INDEX idx_mv_underperforming_user
  ON mv_underperforming_students(user_id, course_id);  -- [F7] unique on (user, course)
CREATE INDEX idx_mv_underperforming_avg
  ON mv_underperforming_students(avg_score);

COMMENT ON MATERIALIZED VIEW mv_underperforming_students IS
  '[F7] Fixed: now grouped per (user_id, course_id) instead of globally. '
  'Instructors see per-course averages, not meaningless platform-wide averages.';

-- ── 22. MV_SKIPPED_CONTENT ───────────────────────────────────────────────────
CREATE MATERIALIZED VIEW mv_skipped_content AS
SELECT
  al.content_id,
  c.title,
  c.course_id,
  COUNT(*)::INT AS skip_count
FROM activity_log al
JOIN activity_types at ON at.type_id   = al.type_id
JOIN content c          ON c.content_id = al.content_id
WHERE at.type_name = 'skip'
GROUP BY al.content_id, c.title, c.course_id
WITH DATA;

CREATE UNIQUE INDEX idx_mv_skipped_content_id     ON mv_skipped_content(content_id);
CREATE INDEX        idx_mv_skipped_content_course ON mv_skipped_content(course_id);
CREATE INDEX        idx_mv_skipped_content_count  ON mv_skipped_content(skip_count DESC);

-- ── 23. MV_COMPLETION_RATES ──────────────────────────────────────────────────
CREATE MATERIALIZED VIEW mv_completion_rates AS
SELECT
  cp.user_id,
  u.full_name,
  c.course_id,
  ROUND(AVG(cp.progress_percent)::NUMERIC, 2) AS avg_completion_pct,
  COUNT(*)::INT                               AS content_items
FROM content_progress cp
JOIN users   u ON u.user_id    = cp.user_id
JOIN content c ON c.content_id = cp.content_id
GROUP BY cp.user_id, u.full_name, c.course_id
WITH DATA;

CREATE UNIQUE INDEX idx_mv_completion_rates_user_course
  ON mv_completion_rates(user_id, course_id);
CREATE INDEX idx_mv_completion_rates_course
  ON mv_completion_rates(course_id);
CREATE INDEX idx_mv_completion_rates_pct
  ON mv_completion_rates(avg_completion_pct DESC);

-- Refresh helper functions
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_performance_summary;
  REFRESH MATERIALIZED VIEW mv_active_students;
  REFRESH MATERIALIZED VIEW mv_underperforming_students;
  REFRESH MATERIALIZED VIEW mv_skipped_content;
  REFRESH MATERIALIZED VIEW mv_completion_rates;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_performance_summary()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  SELECT refresh_analytics_views();
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- HELPER TRIGGERS – updated_at auto-stamp
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','instructors','courses','enrollments','content','quiz'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl
    );
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE content          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions    ENABLE ROW LEVEL SECURITY;

-- Users can read/update only their own profile
CREATE POLICY users_self_rw ON users
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY users_service_role_all ON users
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Published, non-deleted courses readable by all authenticated users
CREATE POLICY courses_published_read ON courses
  FOR SELECT USING (is_published = TRUE AND deleted_at IS NULL);

-- Instructors manage their own courses
CREATE POLICY courses_instructor_write ON courses
  FOR ALL USING (
    instructor_id IN (
      SELECT instructor_id FROM instructors WHERE user_id = auth.uid()
    )
  );

-- [F5] Content readable when published OR free-preview OR owned by instructor
CREATE POLICY content_published_read ON content
  FOR SELECT USING (
    is_free_preview = TRUE          -- [F5] public preview — no auth needed
    OR is_published = TRUE
    OR course_id IN (
      SELECT c.course_id
      FROM courses c
      JOIN instructors i ON i.instructor_id = c.instructor_id
      WHERE i.user_id = auth.uid()
    )
  );

CREATE POLICY content_instructor_write ON content
  FOR ALL USING (
    course_id IN (
      SELECT c.course_id FROM courses c
      JOIN instructors i ON i.instructor_id = c.instructor_id
      WHERE i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    course_id IN (
      SELECT c.course_id FROM courses c
      JOIN instructors i ON i.instructor_id = c.instructor_id
      WHERE i.user_id = auth.uid()
    )
  );

CREATE POLICY content_service_role_all ON content
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Students own their enrollments
CREATE POLICY enrollments_self ON enrollments
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Students own their progress
CREATE POLICY progress_self ON content_progress
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Students own their quiz attempts
CREATE POLICY attempts_self ON quiz_attempts
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Students access answers only from their own attempts
CREATE POLICY answers_self ON quiz_answers
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.attempt_id = quiz_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.attempt_id = quiz_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

CREATE POLICY answers_service_role_all ON quiz_answers
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Backfill: ensure instructor/admin users have an instructors row
INSERT INTO instructors (user_id)
SELECT user_id FROM users
WHERE role IN ('instructor', 'admin') AND deleted_at IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- SUPABASE AUTH HOOK
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (user_id, full_name, email, password, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    '',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping auth.users trigger — configure via Supabase Dashboard > Authentication > Hooks > After user created.';
  END;
END;
$$;

-- ============================================================
-- LearnTrack v2 — Critical Missing Features Migration
-- Adds all 5 critical features from Guide §4.1
-- Run AFTER ddl.sql (the flaw-fixed base schema)
-- ============================================================
-- FEATURES ADDED:
--   [CF1]  Payments & Pricing  — transactions + courses.price columns
--   [CF2]  Reviews & Ratings   — reviews + courses.avg_rating/review_count + trigger
--   [CF3]  Certificates        — certificates + auto-issue trigger on enrollment complete
--   [CF4]  Course Sections     — sections + content.section_id FK
--   [CF5]  Notifications       — notifications table
-- ============================================================

-- ── Safe re-run teardown (reverse dependency order) ──────────────────────────
DROP TABLE IF EXISTS notifications   CASCADE;
DROP TABLE IF EXISTS certificates    CASCADE;
DROP TABLE IF EXISTS transactions    CASCADE;
DROP TABLE IF EXISTS reviews         CASCADE;
DROP TABLE IF EXISTS sections        CASCADE;

-- Remove columns added to existing tables (safe if they don't exist yet)
ALTER TABLE courses  DROP COLUMN IF EXISTS price;
ALTER TABLE courses  DROP COLUMN IF EXISTS discounted_price;
ALTER TABLE courses  DROP COLUMN IF EXISTS avg_rating;
ALTER TABLE courses  DROP COLUMN IF EXISTS review_count;
ALTER TABLE content  DROP COLUMN IF EXISTS section_id;

-- Drop functions/triggers we will recreate
DROP FUNCTION IF EXISTS update_course_rating()   CASCADE;
DROP FUNCTION IF EXISTS auto_issue_certificate() CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- [CF1]  PAYMENTS & PRICING
-- ────────────────────────────────────────────────────────────────────────────

-- Add price columns to courses
-- price = list price; discounted_price = sale price (NULL when no discount active)
ALTER TABLE courses
  ADD COLUMN price             NUMERIC(10,2) NOT NULL DEFAULT 0
                               CHECK (price >= 0),
  ADD COLUMN discounted_price  NUMERIC(10,2)
                               CHECK (discounted_price >= 0);

COMMENT ON COLUMN courses.price IS
  '[CF1] List price in PKR. 0 = free course.';
COMMENT ON COLUMN courses.discounted_price IS
  '[CF1] Sale price. NULL when no discount is active. Must be < price when set.';

-- Enforce: discounted_price must be less than price when both are set
ALTER TABLE courses
  ADD CONSTRAINT chk_discounted_lt_price
  CHECK (discounted_price IS NULL OR discounted_price < price);

-- ── TRANSACTIONS ─────────────────────────────────────────────────────────────
-- Records every purchase attempt. gateway_reference ties back to Stripe/PayPal.
-- Refunds are a new row with status='refunded', not a delete.
CREATE TABLE transactions (
  tx_id               SERIAL        PRIMARY KEY,
  user_id             UUID          NOT NULL
                                    REFERENCES users(user_id)    ON DELETE RESTRICT,
  course_id           INT           NOT NULL
                                    REFERENCES courses(course_id) ON DELETE RESTRICT,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency            VARCHAR(3)    NOT NULL DEFAULT 'PKR',
  status              VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'completed', 'refunded')),
  -- External payment gateway reference (Stripe charge ID, PayPal order ID, etc.)
  gateway_reference   VARCHAR(200),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_user      ON transactions(user_id);
CREATE INDEX idx_tx_course    ON transactions(course_id);
CREATE INDEX idx_tx_status    ON transactions(status);
CREATE INDEX idx_tx_created   ON transactions(created_at DESC);

COMMENT ON TABLE transactions IS
  '[CF1] Records every payment attempt. Refunds are new rows (status=refunded), '
  'not deletions — full audit trail preserved. '
  'ON DELETE RESTRICT on both FKs prevents orphaned financial records.';
COMMENT ON COLUMN transactions.gateway_reference IS
  '[CF1] External ID from payment provider (e.g. Stripe charge_id, PayPal order_id). '
  'Used for reconciliation and refund processing.';

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Students see only their own transactions
CREATE POLICY transactions_self ON transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role has full access (backend writes transactions)
CREATE POLICY transactions_service_role_all ON transactions
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ────────────────────────────────────────────────────────────────────────────
-- [CF2]  REVIEWS & RATINGS
-- ────────────────────────────────────────────────────────────────────────────

-- Add denormalized rating stats to courses (avoids JOIN+AVG on every listing)
ALTER TABLE courses
  ADD COLUMN avg_rating    NUMERIC(3,2) NOT NULL DEFAULT 0
                           CHECK (avg_rating BETWEEN 0 AND 5),
  ADD COLUMN review_count  INT          NOT NULL DEFAULT 0
                           CHECK (review_count >= 0);

COMMENT ON COLUMN courses.avg_rating IS
  '[CF2] Denormalized average of reviews.rating. Auto-maintained by trg_update_course_rating.';
COMMENT ON COLUMN courses.review_count IS
  '[CF2] Denormalized count of reviews rows. Auto-maintained by trg_update_course_rating.';

-- ── REVIEWS ──────────────────────────────────────────────────────────────────
-- One review per student per course (enforced by UNIQUE).
-- body is optional — a rating-only review is valid.
CREATE TABLE reviews (
  review_id   SERIAL       PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(user_id)      ON DELETE CASCADE,
  course_id   INT          NOT NULL REFERENCES courses(course_id)  ON DELETE CASCADE,
  rating      INT          NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)   -- one review per student per course
);

CREATE INDEX idx_reviews_course ON reviews(course_id);
CREATE INDEX idx_reviews_user   ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

COMMENT ON TABLE reviews IS
  '[CF2] Student reviews. UNIQUE(user_id, course_id) enforces one review per student. '
  'courses.avg_rating and review_count are auto-maintained by trigger.';

-- ── Trigger: keep courses.avg_rating and review_count in sync ────────────────
CREATE OR REPLACE FUNCTION update_course_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_course_id INT;
BEGIN
  -- Determine which course_id to recalculate for
  IF TG_OP = 'DELETE' THEN
    v_course_id := OLD.course_id;
  ELSE
    v_course_id := NEW.course_id;
  END IF;

  UPDATE courses
  SET
    avg_rating   = COALESCE(
                     (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews
                      WHERE course_id = v_course_id),
                     0),
    review_count = (SELECT COUNT(*) FROM reviews WHERE course_id = v_course_id)
  WHERE course_id = v_course_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_update_course_rating
  AFTER INSERT OR UPDATE OF rating OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_course_rating();

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read reviews (public social proof)
CREATE POLICY reviews_public_read ON reviews
  FOR SELECT USING (TRUE);

-- Students can only write/update their own review
CREATE POLICY reviews_self_write ON reviews
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reviews_service_role_all ON reviews
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ────────────────────────────────────────────────────────────────────────────
-- [CF3]  CERTIFICATES
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE certificates (
  cert_id      SERIAL       PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES users(user_id)      ON DELETE RESTRICT,
  course_id    INT          NOT NULL REFERENCES courses(course_id)  ON DELETE RESTRICT,
  issued_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- URL to the generated PDF certificate (set by backend after PDF is built)
  cert_url     VARCHAR(500),
  -- SHA-256 hex digest — used for public /verify/:hash endpoint
  verify_hash  CHAR(64)     NOT NULL UNIQUE
                            DEFAULT encode(gen_random_bytes(32), 'hex'),
  UNIQUE (user_id, course_id)   -- one certificate per student per course
);

CREATE INDEX idx_certs_user        ON certificates(user_id);
CREATE INDEX idx_certs_course      ON certificates(course_id);
CREATE INDEX idx_certs_verify_hash ON certificates(verify_hash);

COMMENT ON TABLE certificates IS
  '[CF3] One certificate per student per course. '
  'verify_hash is a random SHA-256 used at public /verify/:hash without exposing PII. '
  'cert_url is populated by the backend after the PDF is generated and stored.';
COMMENT ON COLUMN certificates.verify_hash IS
  '[CF3] Random 64-char hex. Allows public certificate verification at '
  '/verify/{hash} without exposing user_id or course_id.';

-- ── Trigger: auto-issue certificate when enrollment status → 'completed' ──────
CREATE OR REPLACE FUNCTION auto_issue_certificate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_completed_status_id INT;
BEGIN
  -- Only fire on status changes that land on 'completed'
  SELECT status_id INTO v_completed_status_id
  FROM enrollment_statuses WHERE status_name = 'completed';

  IF NEW.status_id = v_completed_status_id
     AND (OLD.status_id IS DISTINCT FROM NEW.status_id) THEN
    INSERT INTO certificates (user_id, course_id)
    VALUES (NEW.user_id, NEW.course_id)
    ON CONFLICT (user_id, course_id) DO NOTHING;  -- idempotent — never double-issue
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_issue_certificate
  AFTER UPDATE OF status_id ON enrollments
  FOR EACH ROW EXECUTE FUNCTION auto_issue_certificate();

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Students see only their own certificates
CREATE POLICY certificates_self ON certificates
  FOR SELECT USING (user_id = auth.uid());

-- Public verify endpoint needs to read by hash without auth —
-- handled at the API layer (service_role call), not via RLS
CREATE POLICY certificates_service_role_all ON certificates
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ────────────────────────────────────────────────────────────────────────────
-- [CF4]  COURSE SECTIONS / CHAPTERS
-- ────────────────────────────────────────────────────────────────────────────

-- ── SECTIONS ─────────────────────────────────────────────────────────────────
-- A grouping layer between course and content: Course → Section → Lesson.
-- sort_order controls the order of sections within a course.
CREATE TABLE sections (
  section_id  SERIAL        PRIMARY KEY,
  course_id   INT           NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  title       VARCHAR(200)  NOT NULL,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sections_course ON sections(course_id);

COMMENT ON TABLE sections IS
  '[CF4] Grouping layer: Course → Section → Lesson (content). '
  'Replaces the flat sort_order-only curriculum structure. '
  'Frontend: SectionAccordion component expands section to show its content items.';

-- ── Add section_id FK to content ──────────────────────────────────────────────
-- NULL = content belongs to no section (legacy / unsectioned courses)
-- ON DELETE SET NULL = deleting a section orphans its content rather than deleting it
ALTER TABLE content
  ADD COLUMN section_id INT REFERENCES sections(section_id) ON DELETE SET NULL;

CREATE INDEX idx_content_section ON content(section_id);

COMMENT ON COLUMN content.section_id IS
  '[CF4] FK to sections. NULL for legacy content not yet assigned to a section. '
  'ON DELETE SET NULL: removing a section detaches its lessons, not destroys them.';

-- ────────────────────────────────────────────────────────────────────────────
-- [CF5]  NOTIFICATIONS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  notif_id    SERIAL       PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  -- type distinguishes notification sources for frontend routing/icons
  type        VARCHAR(50)  NOT NULL
                           CHECK (type IN (
                             'new_content',
                             'quiz_graded',
                             'announcement',
                             'enrollment_complete',
                             'certificate_issued',
                             'review_received'
                           )),
  body        TEXT         NOT NULL,
  -- Optional deep-link reference so the frontend can route on click
  ref_course_id   INT      REFERENCES courses(course_id) ON DELETE SET NULL,
  ref_content_id  INT      REFERENCES content(content_id) ON DELETE SET NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user        ON notifications(user_id);
CREATE INDEX idx_notif_user_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_notif_created     ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS
  '[CF5] Per-user notification feed. '
  'idx_notif_user_unread is a partial index for fast unread-count queries. '
  'Frontend: bell icon in topbar queries COUNT(*) WHERE is_read = FALSE.';
COMMENT ON COLUMN notifications.type IS
  '[CF5] Controls icon and routing in the frontend notification dropdown.';
COMMENT ON COLUMN notifications.ref_course_id IS
  '[CF5] Optional FK so the frontend can deep-link to the relevant course on click.';

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY notifications_self ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY notifications_self_update ON notifications
  FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backend (service_role) writes notifications on behalf of users
CREATE POLICY notifications_service_role_all ON notifications
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ── Trigger: auto-notify student when certificate is issued ───────────────────
-- Demonstrates trigger-to-trigger workflow: enrollment → cert → notification
CREATE OR REPLACE FUNCTION notify_on_certificate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_course_title VARCHAR(200);
BEGIN
  SELECT title INTO v_course_title FROM courses WHERE course_id = NEW.course_id;

  INSERT INTO notifications (user_id, type, body, ref_course_id)
  VALUES (
    NEW.user_id,
    'certificate_issued',
    'Congratulations! Your certificate for "' || v_course_title || '" is ready.',
    NEW.course_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_certificate
  AFTER INSERT ON certificates
  FOR EACH ROW EXECUTE FUNCTION notify_on_certificate();

-- ────────────────────────────────────────────────────────────────────────────
-- SUMMARY COMMENTS
-- ────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE transactions IS
  '[CF1] Payment audit log. Each row = one gateway transaction. '
  'Refunds are status=refunded rows, never deletes. '
  'ON DELETE RESTRICT prevents orphaned financial records.';

COMMENT ON TABLE reviews IS
  '[CF2] Student ratings + optional text reviews. '
  'UNIQUE(user_id, course_id) = one review per student per course. '
  'Trigger trg_update_course_rating keeps courses.avg_rating + review_count in sync.';

COMMENT ON TABLE certificates IS
  '[CF3] Auto-issued when enrollment.status_id → completed (via trigger). '
  'verify_hash enables public /verify/:hash endpoint without exposing PII.';

COMMENT ON TABLE sections IS
  '[CF4] Course grouping layer. Enables Course → Section → Lesson hierarchy. '
  'content.section_id = NULL for unsectioned (legacy) content.';

COMMENT ON TABLE notifications IS
  '[CF5] Per-user notification feed. Partial index on is_read=FALSE enables '
  'O(1) unread-count queries for the topbar bell badge.';



  CREATE OR REPLACE FUNCTION compute_attempt_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_points  NUMERIC;
  v_earned_points NUMERIC;
  v_score         NUMERIC;
  v_pass_score    NUMERIC;
BEGIN
  -- Total possible points for this quiz
  SELECT COALESCE(SUM(qq.points), 0)
  INTO v_total_points
  FROM quiz_questions qq
  JOIN quiz_attempts  qa ON qa.quiz_id = qq.quiz_id
  WHERE qa.attempt_id = NEW.attempt_id;

  -- Points earned: deduplicate by question_id so MCQ multi-select answers
  -- don't double-count a question that has multiple correct options selected.
  SELECT COALESCE(SUM(pts), 0)
  INTO v_earned_points
  FROM (
    SELECT DISTINCT qq.question_id, qq.points AS pts
    FROM quiz_answers  a
    JOIN quiz_questions qq ON qq.question_id = a.question_id
    WHERE a.attempt_id = NEW.attempt_id
      AND a.is_correct = TRUE
  ) earned;

  IF v_total_points > 0 THEN
    v_score := ROUND((v_earned_points / v_total_points) * 100, 2);
  ELSE
    v_score := 0;
  END IF;

  SELECT pass_score INTO v_pass_score
  FROM quiz
  JOIN quiz_attempts ON quiz_attempts.quiz_id = quiz.quiz_id
  WHERE quiz_attempts.attempt_id = NEW.attempt_id;

  UPDATE quiz_attempts
  SET score  = v_score,
      passed = (v_score >= v_pass_score)
  WHERE attempt_id = NEW.attempt_id;

  RETURN NEW;
END;
$$;