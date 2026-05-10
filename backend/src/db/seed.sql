-- ============================================================
-- LearnTrack v2 – Seed Data (UUID edition)
-- ============================================================
-- This file fills **public** tables (e.g. public.users).
--
-- Your API login uses **Supabase Auth** (auth.users) via
-- signInWithPassword — it does NOT read public.users.password.
-- So after running this SQL you MUST also create matching Auth users:
--
--   cd backend && npm run seed:auth
--
-- (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in backend/.env)
-- Default password for all seed accounts: TestPass123!
--
-- Emails: admin@learntrack.dev, instructor@learntrack.dev, student@learntrack.dev, …
-- ============================================================

-- Static test UUIDs
-- admin:      00000000-0000-0000-0000-000000000001
-- instructor: 00000000-0000-0000-0000-000000000002
-- student:    00000000-0000-0000-0000-000000000003

-- ── RESET (safe re-run) ─────────────────────────────────────────────────────
-- This seed is designed for dev/demo environments. It clears LearnTrack tables
-- (including users) so you can re-run it without duplicate key errors.
TRUNCATE TABLE
  quiz_answers,
  question_options,
  quiz_questions,
  quiz_attempts,
  quiz,
  content_progress,
  activity_log,
  content,
  enrollments,
  courses,
  instructors,
  users
RESTART IDENTITY
CASCADE;

-- ── USERS ────────────────────────────────────────────────────────────────────
-- password for all test accounts: TestPass123!
-- bcrypt hash (12 rounds) of 'TestPass123!'
INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin User',       'admin@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Jane Instructor',  'instructor@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'instructor'),
  ('00000000-0000-0000-0000-000000000003', 'John Student',     'student@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password  = EXCLUDED.password,
  role      = EXCLUDED.role,
  updated_at = NOW();

-- ── INSTRUCTORS ───────────────────────────────────────────────────────────────
INSERT INTO instructors (user_id, department, qualification) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Administration', 'MSc Computer Science'),
  ('00000000-0000-0000-0000-000000000002', 'Engineering',    'PhD Software Engineering')
ON CONFLICT (user_id) DO UPDATE SET
  department = EXCLUDED.department,
  qualification = EXCLUDED.qualification;

-- Additional instructor for multi-instructor scenarios
INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000009', 'Omar Instructor', 'instructor2@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'instructor')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password  = EXCLUDED.password,
  role      = EXCLUDED.role,
  updated_at = NOW();

INSERT INTO instructors (user_id, department, qualification) VALUES
  ('00000000-0000-0000-0000-000000000009', 'Computer Science', 'MSc Data Science')
ON CONFLICT (user_id) DO UPDATE SET
  department = EXCLUDED.department,
  qualification = EXCLUDED.qualification;

-- ── COURSES ───────────────────────────────────────────────────────────────────
-- Use explicit course_id values and dynamic instructor lookup by user_id
-- so this works even when instructor SERIAL IDs are not 1/2/3.
INSERT INTO courses (course_id, instructor_id, title, description, category, is_published) VALUES
  (
    1,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
    'Introduction to Python',
    'Learn Python from scratch.',
    'Programming',
    TRUE
  ),
  (
    2,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000002' LIMIT 1),
    'Web Development Basics',
    'HTML, CSS and JavaScript fundamentals.',
    'Web',
    TRUE
  ),
  (
    3,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000002' LIMIT 1),
    'Advanced Node.js',
    'Deep dive into Node.js and Express.',
    'Backend',
    FALSE
  ),
  (
    4,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000009' LIMIT 1),
    'Database Fundamentals',
    'Relational databases, SQL, and modeling.',
    'Database',
    TRUE
  ),
  (
    5,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000009' LIMIT 1),
    'Data Structures I',
    'Big-O, arrays, stacks, queues, and trees.',
    'CS',
    TRUE
  )
ON CONFLICT (course_id) DO UPDATE SET
  instructor_id = EXCLUDED.instructor_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- ── CONTENT ───────────────────────────────────────────────────────────────────
-- content_type_id: 1=video, 2=document, 3=quiz
INSERT INTO content (course_id, content_type_id, title, content_url, content_body, duration_sec, sort_order, is_published) VALUES
  (1, 1, 'What is Python?',        'https://www.youtube.com/watch?v=rfscVS0vtbw', NULL, 600, 1, TRUE),
  (1, 1, 'Variables and Types',    'https://www.youtube.com/watch?v=khKv-8q7YmY', NULL, 720, 2, TRUE),
  (1, 2, 'Python Cheatsheet PDF',  'https://example.com/python-cheatsheet.pdf', 'Download and keep this handy while coding.', NULL, 3, TRUE),
  (2, 1, 'HTML Basics',            'https://www.youtube.com/watch?v=pQN-pnXPaVg', NULL, 540, 1, TRUE),
  (2, 1, 'CSS Fundamentals',       'https://www.youtube.com/watch?v=1Rs2ND1ryYc', NULL, 660, 2, TRUE),
  (2, 2, 'HTML/CSS Notes (PDF)',   'https://example.com/web-notes.pdf', 'Short reading for the week.', NULL, 3, TRUE),
  (4, 1, 'SQL: SELECT + WHERE',    'https://www.youtube.com/watch?v=HXV3zeQKqGY', NULL, 720, 1, TRUE),
  (4, 2, 'SQL Practice Sheet',     'https://example.com/sql-practice.pdf', 'Try the exercises before the quiz.', NULL, 2, TRUE),
  (5, 1, 'Big-O Intuition',        'https://www.youtube.com/watch?v=9TlHvipP5yA', NULL, 600, 1, TRUE),
  (5, 1, 'Stacks and Queues',      'https://www.youtube.com/watch?v=wjI1WNcIntg', NULL, 780, 2, TRUE);

-- ── ENROLLMENTS ───────────────────────────────────────────────────────────────
-- status_id: 1=active
INSERT INTO enrollments (user_id, course_id, status_id) VALUES
  ('00000000-0000-0000-0000-000000000003', 1, 1),
  ('00000000-0000-0000-0000-000000000003', 2, 1)
ON CONFLICT (user_id, course_id) DO UPDATE SET
  status_id = EXCLUDED.status_id,
  updated_at = NOW();

-- ── QUIZ ─────────────────────────────────────────────────────────────────────
INSERT INTO quiz (course_id, title, pass_score, allow_multiple, is_published) VALUES
  (1, 'Python Basics Quiz', 70, TRUE, TRUE);

INSERT INTO quiz (course_id, title, pass_score, allow_multiple, is_published) VALUES
  (2, 'Web Basics Quiz', 60, TRUE, TRUE),
  (4, 'SQL Foundations Quiz', 65, TRUE, TRUE);

-- ── QUIZ QUESTIONS ────────────────────────────────────────────────────────────
-- question_type_id: 1=mcq, 2=true_false
INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points) VALUES
  (1, 1, 'Which keyword defines a function in Python?', 1, 1),
  (1, 2, 'Python is a statically typed language.',      2, 1);

INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points) VALUES
  (2, 1, 'Which tag creates a hyperlink?', 1, 1),
  (2, 2, 'CSS stands for Cascading Style Sheets.', 2, 1),
  (3, 1, 'Which clause filters rows in SQL?', 1, 1),
  (3, 2, 'A primary key can contain NULL values.', 2, 1);

-- ── QUESTION OPTIONS ─────────────────────────────────────────────────────────
-- Question 1 options
INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES
  (1, 'def',      TRUE,  1),
  (1, 'function', FALSE, 2),
  (1, 'fn',       FALSE, 3),
  (1, 'func',     FALSE, 4);

-- Question 2 options (true_false)
INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES
  (2, 'True',  FALSE, 1),
  (2, 'False', TRUE,  2);

-- Web quiz options
INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES
  (3, '<a>', TRUE, 1),
  (3, '<p>', FALSE, 2),
  (3, '<link>', FALSE, 3),
  (3, '<h1>', FALSE, 4);
INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES
  (4, 'True', TRUE, 1),
  (4, 'False', FALSE, 2);

-- SQL quiz options
INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES
  (5, 'WHERE', TRUE, 1),
  (5, 'ORDER BY', FALSE, 2),
  (5, 'GROUP BY', FALSE, 3),
  (5, 'LIMIT', FALSE, 4);
INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES
  (6, 'True', FALSE, 1),
  (6, 'False', TRUE, 2);

-- ── ANALYTICS HEAVY SEED ──────────────────────────────────────────────────────
-- Extra students with varied behavior so analytics endpoints show realistic output.
INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000004', 'Aisha Iqbal',   'aisha@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000005', 'Hassan Khan',   'hassan@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000006', 'Zara Ahmad',    'zara@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000007', 'Nadia Raza',    'nadia@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000008', 'Omar Malik',    'omar@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password  = EXCLUDED.password,
  role      = EXCLUDED.role,
  updated_at = NOW();

-- More students to populate instructor 2 courses
INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000011', 'Sara Ali',      'sara@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000012', 'Bilal Akram',   'bilal@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password  = EXCLUDED.password,
  role      = EXCLUDED.role,
  updated_at = NOW();

-- Enroll additional students across two published courses.
INSERT INTO enrollments (user_id, course_id, status_id) VALUES
  ('00000000-0000-0000-0000-000000000004', 1, 1),
  ('00000000-0000-0000-0000-000000000004', 2, 1),
  ('00000000-0000-0000-0000-000000000005', 1, 1),
  ('00000000-0000-0000-0000-000000000006', 1, 1),
  ('00000000-0000-0000-0000-000000000006', 2, 1),
  ('00000000-0000-0000-0000-000000000007', 1, 1),
  ('00000000-0000-0000-0000-000000000008', 2, 1)
ON CONFLICT (user_id, course_id) DO UPDATE SET
  status_id = EXCLUDED.status_id,
  updated_at = NOW();

INSERT INTO enrollments (user_id, course_id, status_id) VALUES
  ('00000000-0000-0000-0000-000000000011', 4, 1),
  ('00000000-0000-0000-0000-000000000011', 5, 1),
  ('00000000-0000-0000-0000-000000000012', 4, 1)
ON CONFLICT (user_id, course_id) DO UPDATE SET
  status_id = EXCLUDED.status_id,
  updated_at = NOW();

-- Progress spread for completion-rates analytics.
INSERT INTO content_progress (user_id, content_id, progress_percent, last_watched_at) VALUES
  ('00000000-0000-0000-0000-000000000003', 1, 100, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000003', 2, 85,  NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000003', 4, 60,  NOW() - INTERVAL '2 days'),

  ('00000000-0000-0000-0000-000000000004', 1, 95,  NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000004', 2, 92,  NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000004', 4, 88,  NOW() - INTERVAL '6 hours'),
  ('00000000-0000-0000-0000-000000000004', 5, 74,  NOW() - INTERVAL '6 hours'),

  ('00000000-0000-0000-0000-000000000005', 1, 45,  NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000005', 2, 30,  NOW() - INTERVAL '2 days'),

  ('00000000-0000-0000-0000-000000000006', 1, 78,  NOW() - INTERVAL '10 hours'),
  ('00000000-0000-0000-0000-000000000006', 2, 69,  NOW() - INTERVAL '10 hours'),
  ('00000000-0000-0000-0000-000000000006', 4, 82,  NOW() - INTERVAL '14 hours'),

  ('00000000-0000-0000-0000-000000000007', 1, 22,  NOW() - INTERVAL '5 days'),
  ('00000000-0000-0000-0000-000000000007', 2, 15,  NOW() - INTERVAL '5 days'),

  ('00000000-0000-0000-0000-000000000008', 4, 40,  NOW() - INTERVAL '4 days'),
  ('00000000-0000-0000-0000-000000000008', 5, 35,  NOW() - INTERVAL '4 days')
ON CONFLICT (user_id, content_id) DO UPDATE SET
  progress_percent = EXCLUDED.progress_percent,
  last_watched_at  = EXCLUDED.last_watched_at;

-- Activity logs for active-students + skipped-content analytics.
-- activity_types: play/pause/skip/seek/complete
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 1, at.type_id, 220, NOW() - INTERVAL '3 hours'
FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 2, at.type_id, 340, NOW() - INTERVAL '2 hours'
FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 4, at.type_id, 270, NOW() - INTERVAL '90 minutes'
FROM activity_types at WHERE at.type_name = 'play';

INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000005', 1, at.type_id, 110, NOW() - INTERVAL '1 day'
FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000005', 2, at.type_id, 80, NOW() - INTERVAL '1 day'
FROM activity_types at WHERE at.type_name = 'play';

INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000006', 1, at.type_id, 190, NOW() - INTERVAL '8 hours'
FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000006', 4, at.type_id, 260, NOW() - INTERVAL '7 hours'
FROM activity_types at WHERE at.type_name = 'play';

-- Skip events (intentionally high on content 2 and 4)
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000003', 2, at.type_id, 0, NOW() - INTERVAL '2 days'
FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 2, at.type_id, 0, NOW() - INTERVAL '1 day'
FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000005', 2, at.type_id, 0, NOW() - INTERVAL '1 day'
FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000006', 4, at.type_id, 0, NOW() - INTERVAL '5 hours'
FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000008', 4, at.type_id, 0, NOW() - INTERVAL '4 days'
FROM activity_types at WHERE at.type_name = 'skip';

-- Quiz attempts with mixed scores for underperforming analytics.
INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, attempt_date) VALUES
  ('00000000-0000-0000-0000-000000000003', 1, 68, FALSE, NOW() - INTERVAL '3 days'),
  ('00000000-0000-0000-0000-000000000003', 1, 82, TRUE,  NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000004', 1, 91, TRUE,  NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000005', 1, 39, FALSE, NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000006', 1, 74, TRUE,  NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000007', 1, 42, FALSE, NOW() - INTERVAL '4 days'),
  ('00000000-0000-0000-0000-000000000008', 1, 47, FALSE, NOW() - INTERVAL '4 days');

INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, attempt_date) VALUES
  ('00000000-0000-0000-0000-000000000004', 2, 58, FALSE, NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000006', 2, 77, TRUE,  NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000011', 3, 72, TRUE, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000012', 3, 44, FALSE, NOW() - INTERVAL '2 days');

-- Refresh all analytics materialized views after seeding.
SELECT refresh_analytics_views();
