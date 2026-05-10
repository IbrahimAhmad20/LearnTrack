# LearnTrack Join Cheat Sheet (For On-Spot Viva Changes)

This is your emergency guide when professor says:
- "Change this join"
- "Add one more table"
- "Show students with/without activity"
- "Use left join instead"

---

## 1) Join Types in One Minute

- `INNER JOIN`: keep only rows that match in both tables.
- `LEFT JOIN`: keep all rows from left table, even if right side missing.
- `RIGHT JOIN`: opposite of left join (rarely used; usually rewrite as LEFT).
- `FULL JOIN`: keep all rows from both sides.

Quick memory:
- Need "only related records"? -> `INNER JOIN`
- Need "also show missing data / null rows"? -> `LEFT JOIN`

---

## 2) Your Main Foreign Keys (what to join on)

- `instructors.user_id = users.user_id`
- `courses.instructor_id = instructors.instructor_id`
- `enrollments.user_id = users.user_id`
- `enrollments.course_id = courses.course_id`
- `content.course_id = courses.course_id`
- `activity_log.content_id = content.content_id`
- `activity_log.user_id = users.user_id`
- `content_progress.content_id = content.content_id`
- `content_progress.user_id = users.user_id`
- `quiz.course_id = courses.course_id`
- `quiz_questions.quiz_id = quiz.quiz_id`
- `question_options.question_id = quiz_questions.question_id`
- `quiz_attempts.quiz_id = quiz.quiz_id`
- `quiz_attempts.user_id = users.user_id`
- `quiz_answers.attempt_id = quiz_attempts.attempt_id`
- `quiz_answers.option_id = question_options.option_id`

---

## 3) Most Common Viva Query Patterns

## A) List enrolled students with course names

```sql
select
  u.full_name,
  u.email,
  c.title as course_title,
  e.enrolled_at
from enrollments e
join users u on u.user_id = e.user_id
join courses c on c.course_id = e.course_id
order by e.enrolled_at desc;
```

## B) Show all courses, even those with zero enrollments

```sql
select
  c.course_id,
  c.title,
  count(e.enrollment_id) as total_enrollments
from courses c
left join enrollments e on e.course_id = c.course_id
where c.deleted_at is null
group by c.course_id, c.title
order by total_enrollments desc;
```

Why LEFT here:
- you still want courses that currently have no student.

## C) Students with no quiz attempts

```sql
select distinct
  u.user_id,
  u.full_name
from users u
join enrollments e on e.user_id = u.user_id
left join quiz_attempts qa on qa.user_id = u.user_id
where u.role = 'student'
  and qa.attempt_id is null;
```

---

## 4) "Professor asked to change join" -> exact playbook

## Case 1: INNER -> LEFT

If current query:

```sql
... from enrollments e
join content_progress cp on cp.user_id = e.user_id
```

Change to:

```sql
... from enrollments e
left join content_progress cp on cp.user_id = e.user_id
```

Meaning changes from:
- "only enrolled users who have progress"
to
- "all enrolled users, with null progress for inactive users"

## Case 2: Add one more join (users table for name)

```sql
join users u on u.user_id = e.user_id
```

Then include `u.full_name` in `select` and add to `group by` if needed.

## Case 3: Wrong counts after adding joins

If counts increase unexpectedly, use:
- `count(distinct e.user_id)` instead of `count(*)`

because one-to-many joins duplicate rows.

---

## 5) Group By Rules (where students get stuck)

If using aggregate (`count`, `avg`, `sum`):
- every non-aggregated column in select must be in `group by`.

Example:

```sql
select c.course_id, c.title, count(e.enrollment_id)
from courses c
left join enrollments e on e.course_id = c.course_id
group by c.course_id, c.title;
```

---

## 6) Your Analytics Joins (already in project)

Main heavy join query is in materialized view `mv_performance_summary` in `backend/src/db/ddl.sql`:

- starts from `enrollments e`
- left joins content, activity logs, progress, quiz, attempts
- outputs per `user_id + course_id` analytics

If professor says "include user name":

```sql
left join users u on u.user_id = e.user_id
```

Then select `u.full_name` and add it to `group by`.

---

## 7) Safe Query Edit Checklist (before you run)

1. Are join keys correct PK/FK pair?
2. Do you need unmatched rows? If yes -> LEFT JOIN.
3. Did row duplication happen? If yes -> `count(distinct ...)`.
4. Added text columns with aggregate? Add them in `group by`.
5. Null handling needed? Use `coalesce(...)`.

---

## 8) Fast Answers You Can Say in Viva

- "I used INNER JOIN when relationship must exist, LEFT JOIN when I need complete base records."
- "Our analytics uses LEFT JOIN so students without activity still appear."
- "I use `count(distinct user_id)` to avoid overcount from one-to-many joins."
- "Materialized views precompute join-heavy analytics for dashboard performance."

