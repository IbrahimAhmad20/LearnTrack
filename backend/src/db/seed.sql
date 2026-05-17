-- ============================================================
-- LearnTrack v2 – Seed Data (UUID edition) — FIXED
-- ============================================================
-- Changes from original seed.sql:
--   [F1]  courses now use category_id (FK lookup) instead of category text.
--         Categories that didn't exist in ddl_fixed.sql categories table
--         are inserted first, then referenced by subquery.
--   [F3]  quiz_attempts.score is now DB-computed via trigger.
--         Seed inserts quiz_answers rows (the trigger fires and sets score).
--         Hard-coded score/passed values removed from quiz_attempts inserts.
--   MISC  TRUNCATE now includes categories table.
--         ON CONFLICT for courses updated to use category_id.
--         quiz_questions/options reference quiz rows by title subquery
--         instead of assuming SERIAL IDs 1/2/3 — safe for re-runs.
-- ============================================================

-- Static test UUIDs
-- admin:      00000000-0000-0000-0000-000000000001
-- instructor: 00000000-0000-0000-0000-000000000002
-- student:    00000000-0000-0000-0000-000000000003

-- ── RESET (safe re-run) ──────────────────────────────────────────────────────
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
  users,
  categories          -- [F1] must truncate before courses (FK dependency)
RESTART IDENTITY
CASCADE;

-- ── CATEGORIES  [F1] ─────────────────────────────────────────────────────────
-- Re-insert the standard set (TRUNCATE wiped them).
-- Add any extra categories needed by the seed courses below.
INSERT INTO categories (name) VALUES
  ('Programming'),
  ('Web Development'),
  ('Data Science'),
  ('Design'),
  ('Business'),
  ('Marketing'),
  ('DevOps'),
  ('Other');

-- ── USERS ────────────────────────────────────────────────────────────────────
-- Default password for all accounts: TestPass123!
-- bcrypt hash (12 rounds) of 'TestPass123!'
INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin User',      'admin@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Jane Instructor', 'instructor@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'instructor'),
  ('00000000-0000-0000-0000-000000000003', 'John Student',    'student@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student')
ON CONFLICT (email) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  password   = EXCLUDED.password,
  role       = EXCLUDED.role,
  updated_at = NOW();

-- ── INSTRUCTORS ───────────────────────────────────────────────────────────────
-- trg_ensure_instructor_profile auto-creates these rows on user INSERT,
-- but we upsert explicitly to also set department/qualification.
INSERT INTO instructors (user_id, department, qualification) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Administration', 'MSc Computer Science'),
  ('00000000-0000-0000-0000-000000000002', 'Engineering',    'PhD Software Engineering')
ON CONFLICT (user_id) DO UPDATE SET
  department    = EXCLUDED.department,
  qualification = EXCLUDED.qualification;

-- Additional instructor for multi-instructor scenarios
INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000009', 'Omar Instructor', 'instructor2@learntrack.dev',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'instructor')
ON CONFLICT (email) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  password   = EXCLUDED.password,
  role       = EXCLUDED.role,
  updated_at = NOW();

INSERT INTO instructors (user_id, department, qualification) VALUES
  ('00000000-0000-0000-0000-000000000009', 'Computer Science', 'MSc Data Science')
ON CONFLICT (user_id) DO UPDATE SET
  department    = EXCLUDED.department,
  qualification = EXCLUDED.qualification;

-- ── COURSES  [F1 FIXED] ───────────────────────────────────────────────────────
-- category_id is now a FK to categories.category_id.
-- Each value is looked up by name so the seed is independent of SERIAL order.
--
-- Original category text → mapped to categories.name:
--   'Programming' → 'Programming'
--   'Web'         → 'Web Development'
--   'Backend'     → 'Programming'   (Node.js is a backend/programming topic)
--   'Database'    → 'Data Science'  (closest existing category)
--   'CS'          → 'Programming'   (Data Structures is a CS/Programming topic)
INSERT INTO courses (course_id, instructor_id, title, description, category_id, is_published) VALUES
  (
    1,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
    'Introduction to Python',
    'Learn Python from scratch.',
    (SELECT category_id FROM categories WHERE name = 'Programming'),   -- [F1]
    TRUE
  ),
  (
    2,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000002' LIMIT 1),
    'Web Development Basics',
    'HTML, CSS and JavaScript fundamentals.',
    (SELECT category_id FROM categories WHERE name = 'Web Development'), -- [F1]
    TRUE
  ),
  (
    3,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000002' LIMIT 1),
    'Advanced Node.js',
    'Deep dive into Node.js and Express.',
    (SELECT category_id FROM categories WHERE name = 'Programming'),   -- [F1] was 'Backend'
    FALSE
  ),
  (
    4,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000009' LIMIT 1),
    'Database Fundamentals',
    'Relational databases, SQL, and modeling.',
    (SELECT category_id FROM categories WHERE name = 'Data Science'),  -- [F1] was 'Database'
    TRUE
  ),
  (
    5,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000009' LIMIT 1),
    'Data Structures I',
    'Big-O, arrays, stacks, queues, and trees.',
    (SELECT category_id FROM categories WHERE name = 'Programming'),   -- [F1] was 'CS'
    TRUE
  )
ON CONFLICT (course_id) DO UPDATE SET
  instructor_id = EXCLUDED.instructor_id,
  title         = EXCLUDED.title,
  description   = EXCLUDED.description,
  category_id   = EXCLUDED.category_id,   -- [F1] was: category = EXCLUDED.category
  is_published  = EXCLUDED.is_published,
  updated_at    = NOW();

-- ── CONTENT ───────────────────────────────────────────────────────────────────
-- content_type_id: 1=video, 2=document, 3=quiz
-- The first lesson of each course is marked is_free_preview = TRUE [F5]
-- so unenrolled visitors can sample it.
INSERT INTO content (course_id, content_type_id, title, content_url, content_body, duration_sec, sort_order, is_published, is_free_preview) VALUES
  -- Course 1: Introduction to Python
  (1, 1, 'What is Python?',       'https://www.youtube.com/watch?v=rfscVS0vtbw', NULL,                                    600, 1, TRUE, TRUE),
  (1, 1, 'Variables and Types',   'https://www.youtube.com/watch?v=khKv-8q7YmY', NULL,                                    720, 2, TRUE, FALSE),
  (1, 2, 'Python Cheatsheet PDF', 'https://example.com/python-cheatsheet.pdf',   'Download and keep this handy.',          NULL,3, TRUE, FALSE),
  -- Course 2: Web Development Basics
  (2, 1, 'HTML Basics',           'https://www.youtube.com/watch?v=pQN-pnXPaVg', NULL,                                    540, 1, TRUE, TRUE),
  (2, 1, 'CSS Fundamentals',      'https://www.youtube.com/watch?v=1Rs2ND1ryYc', NULL,                                    660, 2, TRUE, FALSE),
  (2, 2, 'HTML/CSS Notes (PDF)',  'https://example.com/web-notes.pdf',            'Short reading for the week.',           NULL,3, TRUE, FALSE),
  -- Course 4: Database Fundamentals
  (4, 1, 'SQL: SELECT + WHERE',  'https://www.youtube.com/watch?v=HXV3zeQKqGY', NULL,                                     720, 1, TRUE, TRUE),
  (4, 2, 'SQL Practice Sheet',   'https://example.com/sql-practice.pdf',         'Try the exercises before the quiz.',    NULL,2, TRUE, FALSE),
  -- Course 5: Data Structures I
  (5, 1, 'Big-O Intuition',      'https://www.youtube.com/watch?v=9TlHvipP5yA', NULL,                                     600, 1, TRUE, TRUE),
  (5, 1, 'Stacks and Queues',    'https://www.youtube.com/watch?v=wjI1WNcIntg', NULL,                                     780, 2, TRUE, FALSE);


-- ── PAID COURSES (courses 6–10) ───────────────────────────────────────────────
INSERT INTO courses (course_id, instructor_id, title, description, category_id, price, discounted_price, is_published) VALUES
  (
    6,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000002' LIMIT 1),
    'Full-Stack React & Node.js',
    'Build production-ready full-stack apps with React, Node.js, Express, and PostgreSQL. Covers auth, REST APIs, deployment, and more.',
    (SELECT category_id FROM categories WHERE name = 'Web Development'),
    4999, 2999, TRUE
  ),
  (
    7,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000009' LIMIT 1),
    'Machine Learning with Python',
    'From linear regression to neural networks. Hands-on with scikit-learn, pandas, and real datasets.',
    (SELECT category_id FROM categories WHERE name = 'Data Science'),
    5999, NULL, TRUE
  ),
  (
    8,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000002' LIMIT 1),
    'UI/UX Design Fundamentals',
    'Learn design thinking, wireframing, prototyping, and Figma. Build a portfolio-ready case study from scratch.',
    (SELECT category_id FROM categories WHERE name = 'Design'),
    3499, 1999, TRUE
  ),
  (
    9,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000001' LIMIT 1),
    'DevOps & CI/CD with Docker',
    'Containerise apps with Docker, set up CI/CD pipelines with GitHub Actions, and deploy to the cloud.',
    (SELECT category_id FROM categories WHERE name = 'DevOps'),
    6499, 3999, TRUE
  ),
  (
    10,
    (SELECT instructor_id FROM instructors WHERE user_id = '00000000-0000-0000-0000-000000000009' LIMIT 1),
    'SQL Mastery: Advanced Queries',
    'Window functions, CTEs, query optimisation, indexes, and real-world reporting patterns. Go beyond the basics.',
    (SELECT category_id FROM categories WHERE name = 'Data Science'),
    2999, NULL, TRUE
  )
ON CONFLICT (course_id) DO UPDATE SET
  instructor_id    = EXCLUDED.instructor_id,
  title            = EXCLUDED.title,
  description      = EXCLUDED.description,
  category_id      = EXCLUDED.category_id,
  price            = EXCLUDED.price,
  discounted_price = EXCLUDED.discounted_price,
  is_published     = EXCLUDED.is_published,
  updated_at       = NOW();

-- ── CONTENT FOR PAID COURSES ──────────────────────────────────────────────────
INSERT INTO content (course_id, content_type_id, title, content_url, content_body, duration_sec, sort_order, is_published, is_free_preview) VALUES
  -- Course 6: Full-Stack React & Node.js
  (6, 1, 'Project overview & setup',        'https://www.youtube.com/watch?v=nu_pCVPKzTk', NULL,                                   480, 1, TRUE, TRUE),
  (6, 1, 'Building a REST API with Express','https://www.youtube.com/watch?v=pKd0Rpw7O48', NULL,                                   900, 2, TRUE, FALSE),
  (6, 1, 'React state & hooks deep dive',   'https://www.youtube.com/watch?v=O6P86uwfdR0', NULL,                                   840, 3, TRUE, FALSE),
  (6, 2, 'Architecture cheatsheet (PDF)',   'https://example.com/fullstack-arch.pdf',       'Reference guide for the whole course.', NULL,4, TRUE, FALSE),

  -- Course 7: Machine Learning with Python
  (7, 1, 'What is Machine Learning?',       'https://www.youtube.com/watch?v=ukzFI9rgwfU', NULL,                                   540, 1, TRUE, TRUE),
  (7, 1, 'Linear Regression from scratch',  'https://www.youtube.com/watch?v=VmbA0pi2cRQ', NULL,                                   780, 2, TRUE, FALSE),
  (7, 1, 'Classification with scikit-learn','https://www.youtube.com/watch?v=0B5eIE_1vpU', NULL,                                   820, 3, TRUE, FALSE),
  (7, 2, 'ML formula sheet (PDF)',          'https://example.com/ml-formulas.pdf',          'Key equations and when to use them.',  NULL,4, TRUE, FALSE),

  -- Course 8: UI/UX Design Fundamentals
  (8, 1, 'Design thinking process',         'https://www.youtube.com/watch?v=_r0VX-aU_T8', NULL,                                   420, 1, TRUE, TRUE),
  (8, 1, 'Wireframing in Figma',            'https://www.youtube.com/watch?v=FTFaQWZBqQ8', NULL,                                   660, 2, TRUE, FALSE),
  (8, 2, 'Figma shortcuts (PDF)',           'https://example.com/figma-shortcuts.pdf',      'Print this out and keep it handy.',    NULL,3, TRUE, FALSE),

  -- Course 9: DevOps & CI/CD with Docker
  (9, 1, 'Docker in 20 minutes',            'https://www.youtube.com/watch?v=gAkwW2tuIqE', NULL,                                   480, 1, TRUE, TRUE),
  (9, 1, 'Writing your first Dockerfile',   'https://www.youtube.com/watch?v=3c-iBn73dDE', NULL,                                   720, 2, TRUE, FALSE),
  (9, 1, 'GitHub Actions CI/CD pipeline',   'https://www.youtube.com/watch?v=R8_veQiYBjI', NULL,                                   900, 3, TRUE, FALSE),
  (9, 2, 'DevOps glossary (PDF)',           'https://example.com/devops-glossary.pdf',      'Terms you will see in every job spec.', NULL,4, TRUE, FALSE),

  -- Course 10: SQL Mastery
  (10, 1, 'Window functions explained',     'https://www.youtube.com/watch?v=H6OTMoXjNiM', NULL,                                   660, 1, TRUE, TRUE),
  (10, 1, 'CTEs and recursive queries',     'https://www.youtube.com/watch?v=K1WeoKxLZ5o', NULL,                                   720, 2, TRUE, FALSE),
  (10, 2, 'SQL patterns reference (PDF)',   'https://example.com/sql-patterns.pdf',         'Copy-paste ready query patterns.',     NULL,3, TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- trg_maintain_course_duration fires on each INSERT above and updates
-- courses.total_duration_sec automatically. No manual UPDATE needed. [F9]

-- ── ENROLLMENTS ───────────────────────────────────────────────────────────────
-- status_id 1 = active (resolved from enrollment_statuses)
INSERT INTO enrollments (user_id, course_id, status_id) VALUES
  ('00000000-0000-0000-0000-000000000003', 1, 1),
  ('00000000-0000-0000-0000-000000000003', 2, 1)
ON CONFLICT (user_id, course_id) DO UPDATE SET
  status_id  = EXCLUDED.status_id,
  updated_at = NOW();

-- ── QUIZ ─────────────────────────────────────────────────────────────────────
-- Note: quiz.content_id [F2] is intentionally NULL here — these quizzes were
-- created before the content_id FK was added. A real instructor would link them
-- to a content row via the API or a follow-up UPDATE.
INSERT INTO quiz (course_id, title, pass_score, allow_multiple, is_published) VALUES
  (1, 'Python Basics Quiz',   70, TRUE, TRUE),
  (2, 'Web Basics Quiz',      60, TRUE, TRUE),
  (4, 'SQL Foundations Quiz', 65, TRUE, TRUE);

-- ── QUIZ QUESTIONS ────────────────────────────────────────────────────────────
-- We look up quiz_id by (course_id, title) instead of assuming SERIAL IDs 1/2/3.
-- question_type_id: 1=mcq, 2=true_false

-- Python Basics Quiz questions
INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points)
SELECT q.quiz_id, 1, 'Which keyword defines a function in Python?', 1, 1
FROM quiz q JOIN courses c ON c.course_id = q.course_id
WHERE c.course_id = 1 AND q.title = 'Python Basics Quiz';

INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points)
SELECT q.quiz_id, 2, 'Python is a statically typed language.', 2, 1
FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz';

-- Web Basics Quiz questions
INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points)
SELECT q.quiz_id, 1, 'Which tag creates a hyperlink?', 1, 1
FROM quiz q WHERE q.course_id = 2 AND q.title = 'Web Basics Quiz';

INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points)
SELECT q.quiz_id, 2, 'CSS stands for Cascading Style Sheets.', 2, 1
FROM quiz q WHERE q.course_id = 2 AND q.title = 'Web Basics Quiz';

-- SQL Foundations Quiz questions
INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points)
SELECT q.quiz_id, 1, 'Which clause filters rows in SQL?', 1, 1
FROM quiz q WHERE q.course_id = 4 AND q.title = 'SQL Foundations Quiz';

INSERT INTO quiz_questions (quiz_id, question_type_id, question_text, sort_order, points)
SELECT q.quiz_id, 2, 'A primary key can contain NULL values.', 2, 1
FROM quiz q WHERE q.course_id = 4 AND q.title = 'SQL Foundations Quiz';

-- ── QUESTION OPTIONS ─────────────────────────────────────────────────────────
-- We look up question_id by quiz + question_text to avoid hardcoded IDs.

-- Q1: Which keyword defines a function in Python?
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'def',      TRUE,  1 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 1 AND qq.question_text = 'Which keyword defines a function in Python?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'function', FALSE, 2 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 1 AND qq.question_text = 'Which keyword defines a function in Python?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'fn',       FALSE, 3 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 1 AND qq.question_text = 'Which keyword defines a function in Python?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'func',     FALSE, 4 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 1 AND qq.question_text = 'Which keyword defines a function in Python?';

-- Q2: Python is a statically typed language. (True/False — answer: False)
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'True',  FALSE, 1 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 1 AND qq.question_text = 'Python is a statically typed language.';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'False', TRUE,  2 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 1 AND qq.question_text = 'Python is a statically typed language.';

-- Q3: Which tag creates a hyperlink?
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, '<a>',    TRUE,  1 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 2 AND qq.question_text = 'Which tag creates a hyperlink?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, '<p>',    FALSE, 2 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 2 AND qq.question_text = 'Which tag creates a hyperlink?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, '<link>', FALSE, 3 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 2 AND qq.question_text = 'Which tag creates a hyperlink?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, '<h1>',  FALSE, 4 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 2 AND qq.question_text = 'Which tag creates a hyperlink?';

-- Q4: CSS stands for Cascading Style Sheets. (answer: True)
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'True',  TRUE,  1 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 2 AND qq.question_text = 'CSS stands for Cascading Style Sheets.';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'False', FALSE, 2 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 2 AND qq.question_text = 'CSS stands for Cascading Style Sheets.';

-- Q5: Which clause filters rows in SQL?
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'WHERE',    TRUE,  1 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 4 AND qq.question_text = 'Which clause filters rows in SQL?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'ORDER BY', FALSE, 2 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 4 AND qq.question_text = 'Which clause filters rows in SQL?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'GROUP BY', FALSE, 3 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 4 AND qq.question_text = 'Which clause filters rows in SQL?';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'LIMIT',    FALSE, 4 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 4 AND qq.question_text = 'Which clause filters rows in SQL?';

-- Q6: A primary key can contain NULL values. (answer: False)
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'True',  FALSE, 1 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 4 AND qq.question_text = 'A primary key can contain NULL values.';
INSERT INTO question_options (question_id, option_text, is_correct, sort_order)
SELECT qq.question_id, 'False', TRUE,  2 FROM quiz_questions qq JOIN quiz q ON q.quiz_id = qq.quiz_id WHERE q.course_id = 4 AND qq.question_text = 'A primary key can contain NULL values.';

-- ── ANALYTICS HEAVY SEED ─────────────────────────────────────────────────────
-- Extra students with varied behavior so analytics endpoints return realistic data.
INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000004', 'Aisha Iqbal',  'aisha@learntrack.dev',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000005', 'Hassan Khan',  'hassan@learntrack.dev', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000006', 'Zara Ahmad',   'zara@learntrack.dev',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000007', 'Nadia Raza',   'nadia@learntrack.dev',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000008', 'Omar Malik',   'omar@learntrack.dev',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student')
ON CONFLICT (email) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  password   = EXCLUDED.password,
  role       = EXCLUDED.role,
  updated_at = NOW();

INSERT INTO users (user_id, full_name, email, password, role) VALUES
  ('00000000-0000-0000-0000-000000000011', 'Sara Ali',    'sara@learntrack.dev',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student'),
  ('00000000-0000-0000-0000-000000000012', 'Bilal Akram', 'bilal@learntrack.dev', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NnfVlJ5dS', 'student')
ON CONFLICT (email) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  password   = EXCLUDED.password,
  role       = EXCLUDED.role,
  updated_at = NOW();

-- Enroll additional students across published courses
INSERT INTO enrollments (user_id, course_id, status_id) VALUES
  ('00000000-0000-0000-0000-000000000004', 1, 1),
  ('00000000-0000-0000-0000-000000000004', 2, 1),
  ('00000000-0000-0000-0000-000000000005', 1, 1),
  ('00000000-0000-0000-0000-000000000006', 1, 1),
  ('00000000-0000-0000-0000-000000000006', 2, 1),
  ('00000000-0000-0000-0000-000000000007', 1, 1),
  ('00000000-0000-0000-0000-000000000008', 2, 1)
ON CONFLICT (user_id, course_id) DO UPDATE SET
  status_id  = EXCLUDED.status_id,
  updated_at = NOW();

INSERT INTO enrollments (user_id, course_id, status_id) VALUES
  ('00000000-0000-0000-0000-000000000011', 4, 1),
  ('00000000-0000-0000-0000-000000000011', 5, 1),
  ('00000000-0000-0000-0000-000000000012', 4, 1)
ON CONFLICT (user_id, course_id) DO UPDATE SET
  status_id  = EXCLUDED.status_id,
  updated_at = NOW();

-- ── CONTENT PROGRESS ─────────────────────────────────────────────────────────
-- trg_stamp_content_completed fires automatically when progress_percent = 100. [F4]
-- No manual completed_at values needed.
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

-- ── ACTIVITY LOGS ─────────────────────────────────────────────────────────────
-- Play events (watch_time in seconds)
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 1, at.type_id, 220, NOW() - INTERVAL '3 hours'  FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 2, at.type_id, 340, NOW() - INTERVAL '2 hours'  FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 4, at.type_id, 270, NOW() - INTERVAL '90 minutes' FROM activity_types at WHERE at.type_name = 'play';

INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000005', 1, at.type_id, 110, NOW() - INTERVAL '1 day'    FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000005', 2, at.type_id, 80,  NOW() - INTERVAL '1 day'    FROM activity_types at WHERE at.type_name = 'play';

INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000006', 1, at.type_id, 190, NOW() - INTERVAL '8 hours'  FROM activity_types at WHERE at.type_name = 'play';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000006', 4, at.type_id, 260, NOW() - INTERVAL '7 hours'  FROM activity_types at WHERE at.type_name = 'play';

-- Skip events (intentionally concentrated on content 2 and 4 for analytics)
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000003', 2, at.type_id, 0, NOW() - INTERVAL '2 days' FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000004', 2, at.type_id, 0, NOW() - INTERVAL '1 day'  FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000005', 2, at.type_id, 0, NOW() - INTERVAL '1 day'  FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000006', 4, at.type_id, 0, NOW() - INTERVAL '5 hours' FROM activity_types at WHERE at.type_name = 'skip';
INSERT INTO activity_log (user_id, content_id, type_id, watch_time, event_at)
SELECT '00000000-0000-0000-0000-000000000008', 4, at.type_id, 0, NOW() - INTERVAL '4 days' FROM activity_types at WHERE at.type_name = 'skip';

-- ── QUIZ ATTEMPTS + ANSWERS  [F3 FIXED] ─────────────────────────────────────
-- score and passed are now DB-computed by trg_compute_attempt_score.
-- The pattern is:
--   1. INSERT into quiz_attempts (score defaults to 0)
--   2. INSERT into quiz_answers  (trigger fires per row, recalculates score)
--
-- We use CTEs to capture the generated attempt_id cleanly.
--
-- Python Basics Quiz (course 1) — pass_score = 70
-- Questions: Q1 (1pt, correct=def), Q2 (1pt, correct=False)
-- Answering both correctly → 100%; Q1 only → 50%; Q2 only → 50%

-- John Student (003): attempt 1 — answers Q1 wrong, Q2 correct → score 50 (fail)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000003', q.quiz_id, NOW() - INTERVAL '3 days'
  FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT
  att.attempt_id,
  qq.question_id,
  qo.option_id,
  qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  -- Q1: pick 'function' (wrong)
  (qq.question_text = 'Which keyword defines a function in Python?' AND qo.option_text = 'function')
  OR
  -- Q2: pick 'False' (correct)
  (qq.question_text = 'Python is a statically typed language.'      AND qo.option_text = 'False');

-- John Student (003): attempt 2 — both correct → score 100 (pass)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000003', q.quiz_id, NOW() - INTERVAL '1 day'
  FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which keyword defines a function in Python?' AND qo.option_text = 'def')
  OR
  (qq.question_text = 'Python is a statically typed language.'      AND qo.option_text = 'False');

-- Aisha (004): both correct → 100 (pass)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000004', q.quiz_id, NOW() - INTERVAL '1 day'
  FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which keyword defines a function in Python?' AND qo.option_text = 'def')
  OR
  (qq.question_text = 'Python is a statically typed language.'      AND qo.option_text = 'False');

-- Hassan (005): both wrong → 0 (fail)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000005', q.quiz_id, NOW() - INTERVAL '2 days'
  FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which keyword defines a function in Python?' AND qo.option_text = 'fn')
  OR
  (qq.question_text = 'Python is a statically typed language.'      AND qo.option_text = 'True');

-- Zara (006): Q1 correct, Q2 wrong → 50 (fail, pass_score=70)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000006', q.quiz_id, NOW() - INTERVAL '2 days'
  FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which keyword defines a function in Python?' AND qo.option_text = 'def')
  OR
  (qq.question_text = 'Python is a statically typed language.'      AND qo.option_text = 'True');

-- Nadia (007): both wrong → 0 (fail)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000007', q.quiz_id, NOW() - INTERVAL '4 days'
  FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which keyword defines a function in Python?' AND qo.option_text = 'func')
  OR
  (qq.question_text = 'Python is a statically typed language.'      AND qo.option_text = 'True');

-- Omar M (008): both wrong → 0 (fail)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000008', q.quiz_id, NOW() - INTERVAL '4 days'
  FROM quiz q WHERE q.course_id = 1 AND q.title = 'Python Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which keyword defines a function in Python?' AND qo.option_text = 'fn')
  OR
  (qq.question_text = 'Python is a statically typed language.'      AND qo.option_text = 'True');

-- Web Basics Quiz (course 2) — pass_score = 60
-- Aisha (004): Q3 wrong, Q4 correct → 50 (fail)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000004', q.quiz_id, NOW() - INTERVAL '2 days'
  FROM quiz q WHERE q.course_id = 2 AND q.title = 'Web Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which tag creates a hyperlink?'        AND qo.option_text = '<p>')
  OR
  (qq.question_text = 'CSS stands for Cascading Style Sheets.' AND qo.option_text = 'True');

-- Zara (006): both correct → 100 (pass)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000006', q.quiz_id, NOW() - INTERVAL '1 day'
  FROM quiz q WHERE q.course_id = 2 AND q.title = 'Web Basics Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which tag creates a hyperlink?'        AND qo.option_text = '<a>')
  OR
  (qq.question_text = 'CSS stands for Cascading Style Sheets.' AND qo.option_text = 'True');

-- SQL Foundations Quiz (course 4) — pass_score = 65
-- Sara (011): both correct → 100 (pass)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000011', q.quiz_id, NOW() - INTERVAL '1 day'
  FROM quiz q WHERE q.course_id = 4 AND q.title = 'SQL Foundations Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which clause filters rows in SQL?'       AND qo.option_text = 'WHERE')
  OR
  (qq.question_text = 'A primary key can contain NULL values.'  AND qo.option_text = 'False');

-- Bilal (012): Q5 wrong, Q6 correct → 50 (fail)
WITH att AS (
  INSERT INTO quiz_attempts (user_id, quiz_id, attempt_date)
  SELECT '00000000-0000-0000-0000-000000000012', q.quiz_id, NOW() - INTERVAL '2 days'
  FROM quiz q WHERE q.course_id = 4 AND q.title = 'SQL Foundations Quiz'
  RETURNING attempt_id, quiz_id
)
INSERT INTO quiz_answers (attempt_id, question_id, option_id, is_correct)
SELECT att.attempt_id, qq.question_id, qo.option_id, qo.is_correct
FROM att
JOIN quiz_questions qq ON qq.quiz_id = att.quiz_id
JOIN question_options qo ON qo.question_id = qq.question_id
WHERE
  (qq.question_text = 'Which clause filters rows in SQL?'      AND qo.option_text = 'ORDER BY')
  OR
  (qq.question_text = 'A primary key can contain NULL values.' AND qo.option_text = 'False');

-- ============================================================
-- LearnTrack v2 — New Features Seed
-- ============================================================
-- Run AFTER the main seed.sql (depends on users/courses/content
-- already existing). Safe to re-run — all inserts use ON CONFLICT
-- or DELETE+INSERT patterns.
--
-- Tables seeded:
--   sections      (CF4) — curriculum grouping for courses 1, 2, 4, 5
--   content       (CF4) — section_id backfilled onto existing content rows
--   reviews       (CF2) — star ratings + written reviews from 8 students
--   transactions  (CF1) — purchase history; one refund for realism
--   certificates  (CF3) — issued to students who completed a course
--   notifications (CF5) — mix of types, some unread, for 3 students
--   wishlist            — saved-but-not-enrolled courses for 3 students
--
-- UUIDs used (match main seed.sql):
--   admin      00000000-0000-0000-0000-000000000001
--   instructor 00000000-0000-0000-0000-000000000002
--   instructor2 00000000-0000-0000-0000-000000000009
--   student    00000000-0000-0000-0000-000000000003  John Student
--   student    00000000-0000-0000-0000-000000000004  Aisha Ahmed
--   student    00000000-0000-0000-0000-000000000005  Hassan Khan
--   student    00000000-0000-0000-0000-000000000006  Zara Ali
--   student    00000000-0000-0000-0000-000000000007  Nadia Malik
--   student    00000000-0000-0000-0000-000000000008  Omar Mahmood
--   student    00000000-0000-0000-0000-000000000011  Sara Iqbal
--   student    00000000-0000-0000-0000-000000000012  Bilal Siddiqui
-- ============================================================


-- ── RESET new tables (safe re-run) ───────────────────────────────────────────
-- Deletes only the new-feature rows; main seed data stays intact.
DELETE FROM wishlist;
DELETE FROM notifications;
DELETE FROM certificates;
DELETE FROM transactions;
DELETE FROM reviews;
-- Reset section_id on content before deleting sections (FK = SET NULL but let's be explicit)
UPDATE content SET section_id = NULL;
DELETE FROM sections;


-- ════════════════════════════════════════════════════════════
-- CF4  SECTIONS
-- Each published course gets 2–3 sections. Unsectioned content
-- in courses 3 is intentional (tests the "Other lessons" fallback
-- in SectionAccordion).
-- ════════════════════════════════════════════════════════════

-- Course 1: Introduction to Python
INSERT INTO sections (course_id, title, sort_order) VALUES
  (1, 'Getting Started',      1),
  (1, 'Core Language',        2),
  (1, 'Resources',            3);

-- Course 2: Web Development Basics
INSERT INTO sections (course_id, title, sort_order) VALUES
  (2, 'HTML Foundations',     1),
  (2, 'Styling with CSS',     2),
  (2, 'Reference Material',   3);

-- Course 4: Database Fundamentals
INSERT INTO sections (course_id, title, sort_order) VALUES
  (4, 'SQL Essentials',       1),
  (4, 'Practice',             2);

-- Course 5: Data Structures I
INSERT INTO sections (course_id, title, sort_order) VALUES
  (5, 'Complexity Analysis',  1),
  (5, 'Linear Structures',    2);

-- Course 3 (Advanced Node.js) intentionally has NO sections —
-- tests the flat/unsectioned fallback in SectionAccordion.


-- ── Backfill section_id onto existing content rows ────────────────────────────
-- Course 1
UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 1 AND title = 'Getting Started'
) WHERE course_id = 1 AND title = 'What is Python?';

UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 1 AND title = 'Core Language'
) WHERE course_id = 1 AND title = 'Variables and Types';

UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 1 AND title = 'Resources'
) WHERE course_id = 1 AND title = 'Python Cheatsheet PDF';

-- Course 2
UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 2 AND title = 'HTML Foundations'
) WHERE course_id = 2 AND title = 'HTML Basics';

UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 2 AND title = 'Styling with CSS'
) WHERE course_id = 2 AND title = 'CSS Fundamentals';

UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 2 AND title = 'Reference Material'
) WHERE course_id = 2 AND title = 'HTML/CSS Notes (PDF)';

-- Course 4
UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 4 AND title = 'SQL Essentials'
) WHERE course_id = 4 AND title = 'SQL: SELECT + WHERE';

UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 4 AND title = 'Practice'
) WHERE course_id = 4 AND title = 'SQL Practice Sheet';

-- Course 5
UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 5 AND title = 'Complexity Analysis'
) WHERE course_id = 5 AND title = 'Big-O Intuition';

UPDATE content SET section_id = (
  SELECT section_id FROM sections
  WHERE course_id = 5 AND title = 'Linear Structures'
) WHERE course_id = 5 AND title = 'Stacks and Queues';


-- ════════════════════════════════════════════════════════════
-- CF1  TRANSACTIONS
-- Realistic purchase history spread across 60 days.
-- Includes one refund row (status='refunded') for the admin
-- page and earnings breakdown.
-- ════════════════════════════════════════════════════════════

INSERT INTO transactions (user_id, course_id, amount, currency, status, gateway_reference, created_at) VALUES
  -- John enrolled in course 1 (completed)
  ('00000000-0000-0000-0000-000000000003', 1, 1999.00, 'PKR', 'completed', 'stripe_ch_john_py_001',   NOW() - INTERVAL '55 days'),
  -- Aisha enrolled in courses 1 and 2
  ('00000000-0000-0000-0000-000000000004', 1, 1999.00, 'PKR', 'completed', 'stripe_ch_aisha_py_001',  NOW() - INTERVAL '50 days'),
  ('00000000-0000-0000-0000-000000000004', 2, 2499.00, 'PKR', 'completed', 'stripe_ch_aisha_web_001', NOW() - INTERVAL '48 days'),
  -- Hassan enrolled in course 1
  ('00000000-0000-0000-0000-000000000005', 1, 1999.00, 'PKR', 'completed', 'stripe_ch_hassan_py_001', NOW() - INTERVAL '45 days'),
  -- Zara enrolled in courses 1 and 2
  ('00000000-0000-0000-0000-000000000006', 1, 1999.00, 'PKR', 'completed', 'stripe_ch_zara_py_001',   NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0000-000000000006', 2, 2499.00, 'PKR', 'completed', 'stripe_ch_zara_web_001',  NOW() - INTERVAL '38 days'),
  -- Nadia enrolled in course 1, then requested a refund
  ('00000000-0000-0000-0000-000000000007', 1, 1999.00, 'PKR', 'completed', 'stripe_ch_nadia_py_001',  NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000007', 1,    0.00, 'PKR', 'refunded',  'stripe_re_nadia_py_001',  NOW() - INTERVAL '28 days'),
  -- Omar enrolled in course 1
  ('00000000-0000-0000-0000-000000000008', 1, 1999.00, 'PKR', 'completed', 'stripe_ch_omar_py_001',   NOW() - INTERVAL '25 days'),
  -- Sara enrolled in courses 4 and 5
  ('00000000-0000-0000-0000-000000000011', 4, 2999.00, 'PKR', 'completed', 'stripe_ch_sara_db_001',   NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000011', 5, 1799.00, 'PKR', 'completed', 'stripe_ch_sara_ds_001',   NOW() - INTERVAL '18 days'),
  -- Bilal enrolled in courses 2 and 4
  ('00000000-0000-0000-0000-000000000012', 2, 2499.00, 'PKR', 'completed', 'stripe_ch_bilal_web_001', NOW() - INTERVAL '15 days'),
  ('00000000-0000-0000-0000-000000000012', 4, 2999.00, 'PKR', 'completed', 'stripe_ch_bilal_db_001',  NOW() - INTERVAL '12 days'),
  -- A couple of recent purchases
  ('00000000-0000-0000-0000-000000000003', 4, 2999.00, 'PKR', 'completed', 'stripe_ch_john_db_001',   NOW() - INTERVAL '5 days'),
  ('00000000-0000-0000-0000-000000000005', 2, 2499.00, 'PKR', 'completed', 'stripe_ch_hassan_web_001',NOW() - INTERVAL '3 days');


-- ════════════════════════════════════════════════════════════
-- CF2  REVIEWS
-- One review per student per course (UNIQUE constraint).
-- Ratings spread from 3–5 to give realistic avg_rating values.
-- The DB trigger update_course_rating fires on each INSERT and
-- updates courses.avg_rating and courses.review_count automatically.
-- ════════════════════════════════════════════════════════════

INSERT INTO reviews (user_id, course_id, rating, body, created_at) VALUES
  -- Course 1: Introduction to Python (avg ≈ 4.3)
  ('00000000-0000-0000-0000-000000000003', 1, 5,
   'Excellent introduction. The exercises were clear and the YouTube links actually worked!',
   NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0000-000000000004', 1, 4,
   'Good pace. Would love more examples on list comprehensions.',
   NOW() - INTERVAL '38 days'),
  ('00000000-0000-0000-0000-000000000005', 1, 3,
   'Decent content but the PDF cheatsheet link was broken for me.',
   NOW() - INTERVAL '35 days'),
  ('00000000-0000-0000-0000-000000000006', 1, 5,
   'Loved every lesson. Jane explains things really well.',
   NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000008', 1, 4,
   'Solid foundation. Would recommend to any beginner.',
   NOW() - INTERVAL '20 days'),

  -- Course 2: Web Development Basics (avg ≈ 4.5)
  ('00000000-0000-0000-0000-000000000004', 2, 5,
   'Best HTML/CSS intro I have found. The section structure made it easy to follow.',
   NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000006', 2, 4,
   'CSS section could go deeper into flexbox. Overall great start.',
   NOW() - INTERVAL '25 days'),
  ('00000000-0000-0000-0000-000000000012', 2, 5,
   'Exactly what I needed before jumping into React. Clear and concise.',
   NOW() - INTERVAL '10 days'),

  -- Course 4: Database Fundamentals (avg ≈ 4.0)
  ('00000000-0000-0000-0000-000000000011', 4, 4,
   'Great SQL basics. The practice sheet was really helpful before the quiz.',
   NOW() - INTERVAL '15 days'),
  ('00000000-0000-0000-0000-000000000012', 4, 4,
   'Solid course. Would love a section on indexes and query optimisation.',
   NOW() - INTERVAL '8 days'),
  ('00000000-0000-0000-0000-000000000003', 4, 4,
   'Good fundamentals. Omar explains the concepts clearly.',
   NOW() - INTERVAL '2 days'),

  -- Course 5: Data Structures I (avg ≈ 4.5)
  ('00000000-0000-0000-0000-000000000011', 5, 5,
   'Finally an explanation of Big-O that clicked. Stacks & Queues video was excellent.',
   NOW() - INTERVAL '14 days')

ON CONFLICT (user_id, course_id) DO UPDATE SET
  rating     = EXCLUDED.rating,
  body       = EXCLUDED.body,
  updated_at = NOW();


-- ════════════════════════════════════════════════════════════
-- CF3  CERTIFICATES
-- Issued to students who have 100% progress on a course.
-- verify_hash uses the DEFAULT (gen_random_bytes) but we
-- override with fixed hashes so /verify/:hash links are stable
-- across seed re-runs.
-- ════════════════════════════════════════════════════════════

INSERT INTO certificates (user_id, course_id, issued_at, cert_url, verify_hash) VALUES
  -- John completed Python
  ('00000000-0000-0000-0000-000000000003', 1,
   NOW() - INTERVAL '35 days',
   'https://example.com/certs/john-python.pdf',
   'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'),
  -- Aisha completed Python
  ('00000000-0000-0000-0000-000000000004', 1,
   NOW() - INTERVAL '30 days',
   'https://example.com/certs/aisha-python.pdf',
   'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3'),
  -- Aisha completed Web Dev
  ('00000000-0000-0000-0000-000000000004', 2,
   NOW() - INTERVAL '20 days',
   'https://example.com/certs/aisha-webdev.pdf',
   'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'),
  -- Zara completed Web Dev
  ('00000000-0000-0000-0000-000000000006', 2,
   NOW() - INTERVAL '18 days',
   NULL, -- PDF not yet generated — tests the disabled Download button
   'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'),
  -- Sara completed Data Structures
  ('00000000-0000-0000-0000-000000000011', 5,
   NOW() - INTERVAL '7 days',
   'https://example.com/certs/sara-ds.pdf',
   'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6')

ON CONFLICT (user_id, course_id) DO UPDATE SET
  issued_at  = EXCLUDED.issued_at,
  cert_url   = EXCLUDED.cert_url,
  verify_hash = EXCLUDED.verify_hash;


-- ════════════════════════════════════════════════════════════
-- CF5  NOTIFICATIONS
-- Variety of types, mix of read/unread, across 3 students.
-- John has the most (good for testing the badge + dropdown).
-- ════════════════════════════════════════════════════════════

-- John Student (003) — 5 notifications, 2 unread
INSERT INTO notifications (user_id, type, body, ref_course_id, is_read, created_at) VALUES
  ('00000000-0000-0000-0000-000000000003', 'certificate_issued',
   'Congratulations! Your certificate for Introduction to Python is ready.',
   1, TRUE,  NOW() - INTERVAL '35 days'),
  ('00000000-0000-0000-0000-000000000003', 'new_content',
   'A new lesson "Advanced List Comprehensions" was added to Introduction to Python.',
   1, TRUE,  NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000003', 'announcement',
   'LearnTrack maintenance window: Saturday 2am–4am PKT. All services will be briefly unavailable.',
   NULL, TRUE, NOW() - INTERVAL '10 days'),
  ('00000000-0000-0000-0000-000000000003', 'quiz_graded',
   'Your quiz "Python Basics Quiz" has been graded. You scored 100% — great work!',
   1, FALSE, NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000003', 'new_content',
   'New lesson added to Database Fundamentals: "JOINs Deep Dive".',
   4, FALSE, NOW() - INTERVAL '3 hours');

-- Aisha Ahmed (004) — 4 notifications, 1 unread
INSERT INTO notifications (user_id, type, body, ref_course_id, is_read, created_at) VALUES
  ('00000000-0000-0000-0000-000000000004', 'enrollment_complete',
   'You are now enrolled in Web Development Basics. Good luck!',
   2, TRUE,  NOW() - INTERVAL '48 days'),
  ('00000000-0000-0000-0000-000000000004', 'certificate_issued',
   'Your certificate for Introduction to Python is ready to download.',
   1, TRUE,  NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0000-000000000004', 'certificate_issued',
   'Your certificate for Web Development Basics is ready to download.',
   2, TRUE,  NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000004', 'review_received',
   'An instructor responded to your review of Web Development Basics.',
   2, FALSE, NOW() - INTERVAL '2 days');

-- Sara Iqbal (011) — 3 notifications, 2 unread
INSERT INTO notifications (user_id, type, body, ref_course_id, is_read, created_at) VALUES
  ('00000000-0000-0000-0000-000000000011', 'enrollment_complete',
   'Welcome to Database Fundamentals! Your journey starts now.',
   4, TRUE,  NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0000-000000000011', 'quiz_graded',
   'SQL Foundations Quiz graded: 100%. You passed — certificate incoming!',
   4, FALSE, NOW() - INTERVAL '15 days'),
  ('00000000-0000-0000-0000-000000000011', 'certificate_issued',
   'Your Data Structures I certificate has been issued.',
   5, FALSE, NOW() - INTERVAL '7 days');


-- ════════════════════════════════════════════════════════════
-- WISHLIST
-- Students save courses they haven't enrolled in yet.
-- Also tests the heart-toggle on CourseList.
-- ════════════════════════════════════════════════════════════

INSERT INTO wishlist (user_id, course_id, saved_at) VALUES
  -- Hassan saved Web Dev and Data Structures (enrolled in Python only)
  ('00000000-0000-0000-0000-000000000005', 2, NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0000-000000000005', 5, NOW() - INTERVAL '20 days'),
  -- Nadia saved Database Fundamentals and Data Structures
  ('00000000-0000-0000-0000-000000000007', 4, NOW() - INTERVAL '25 days'),
  ('00000000-0000-0000-0000-000000000007', 5, NOW() - INTERVAL '15 days'),
  -- Bilal saved Data Structures (already in Web Dev + DB)
  ('00000000-0000-0000-0000-000000000012', 5, NOW() - INTERVAL '10 days'),
  -- John saved Data Structures (already in Python + DB)
  ('00000000-0000-0000-0000-000000000003', 5, NOW() - INTERVAL '4 days')

ON CONFLICT (user_id, course_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- Refresh analytics views so dashboards show updated numbers
-- ════════════════════════════════════════════════════════════
SELECT refresh_analytics_views();
-- ── REFRESH ANALYTICS MATERIALIZED VIEWS 