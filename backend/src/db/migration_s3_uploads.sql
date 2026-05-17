-- ── Migration: S3 file uploads support ────────────────────────────────────────
-- Run this against your Supabase project (SQL Editor or psql)

-- 1. course_files — stores metadata for files attached to courses
CREATE TABLE IF NOT EXISTS course_files (
  file_id      SERIAL        PRIMARY KEY,
  course_id    INT           NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  file_name    VARCHAR(500)  NOT NULL,
  file_url     VARCHAR(1000) NOT NULL,
  s3_key       VARCHAR(1000) NOT NULL,
  mime_type    VARCHAR(200)  NOT NULL,
  file_size    BIGINT,                          -- bytes
  uploaded_by  UUID          REFERENCES users(user_id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by course
CREATE INDEX IF NOT EXISTS idx_course_files_course_id ON course_files(course_id);

-- 2. RLS: enrolled students + instructor + admin can read; only instructor/admin insert/delete
ALTER TABLE course_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_files_read" ON course_files
  FOR SELECT USING (
    -- Course must be published OR requester is the instructor/admin
    EXISTS (
      SELECT 1 FROM courses c
      JOIN instructors i ON i.instructor_id = c.instructor_id
      WHERE c.course_id = course_files.course_id
        AND (
          c.is_published = true
          OR i.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "course_files_insert" ON course_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      JOIN instructors i ON i.instructor_id = c.instructor_id
      WHERE c.course_id = course_files.course_id
        AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "course_files_delete" ON course_files
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 3. (Optional) widen avatar_url / thumbnail_url if your DB has a length constraint
-- These are already VARCHAR(500) in the DDL — no change needed unless you see truncation errors.

-- Done.