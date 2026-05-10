# LearnTrack DBMS Diagrams

Use this file for presentation visuals. It contains:
- ER diagram (tables + relationships)
- Analytics flow diagram

---

## 1) ER Diagram (Core Database)

```mermaid
erDiagram
    USERS {
        uuid user_id PK
        varchar full_name
        varchar email
        varchar role
        boolean is_active
        timestamptz deleted_at
    }

    INSTRUCTORS {
        int instructor_id PK
        uuid user_id FK
        varchar department
        varchar qualification
    }

    COURSES {
        int course_id PK
        int instructor_id FK
        varchar title
        varchar category
        boolean is_published
        timestamptz deleted_at
    }

    ENROLLMENT_STATUSES {
        int status_id PK
        varchar status_name
    }

    ENROLLMENTS {
        int enrollment_id PK
        uuid user_id FK
        int course_id FK
        int status_id FK
        timestamptz enrolled_at
    }

    CONTENT_TYPES {
        int type_id PK
        varchar type_name
    }

    CONTENT {
        int content_id PK
        int course_id FK
        int content_type_id FK
        varchar title
        int duration_sec
        int sort_order
        boolean is_published
    }

    ACTIVITY_TYPES {
        int type_id PK
        varchar type_name
    }

    ACTIVITY_LOG {
        int log_id PK
        uuid user_id FK
        int content_id FK
        int type_id FK
        int watch_time
        timestamptz event_at
    }

    CONTENT_PROGRESS {
        int progress_id PK
        uuid user_id FK
        int content_id FK
        numeric progress_percent
        timestamptz last_watched_at
    }

    QUIZ {
        int quiz_id PK
        int course_id FK
        varchar title
        numeric pass_score
        boolean allow_multiple
        boolean is_published
    }

    QUESTION_TYPES {
        int type_id PK
        varchar type_name
    }

    QUIZ_QUESTIONS {
        int question_id PK
        int quiz_id FK
        int question_type_id FK
        text question_text
        numeric points
    }

    QUESTION_OPTIONS {
        int option_id PK
        int question_id FK
        varchar option_text
        boolean is_correct
    }

    QUIZ_ATTEMPTS {
        int attempt_id PK
        uuid user_id FK
        int quiz_id FK
        numeric score
        boolean passed
        timestamptz attempt_date
    }

    QUIZ_ANSWERS {
        int answer_id PK
        int attempt_id FK
        int question_id FK
        int option_id FK
        boolean is_correct
    }

    USER_SESSIONS {
        int session_id PK
        uuid user_id FK
        varchar token_hash
        timestamptz login_at
        timestamptz logout_at
    }

    USERS ||--o| INSTRUCTORS : "has profile"
    INSTRUCTORS ||--o{ COURSES : "creates"

    USERS ||--o{ ENROLLMENTS : "enrolls"
    COURSES ||--o{ ENROLLMENTS : "has"
    ENROLLMENT_STATUSES ||--o{ ENROLLMENTS : "status"

    COURSES ||--o{ CONTENT : "contains"
    CONTENT_TYPES ||--o{ CONTENT : "typed by"

    USERS ||--o{ ACTIVITY_LOG : "generates"
    CONTENT ||--o{ ACTIVITY_LOG : "has events"
    ACTIVITY_TYPES ||--o{ ACTIVITY_LOG : "event type"

    USERS ||--o{ CONTENT_PROGRESS : "has progress"
    CONTENT ||--o{ CONTENT_PROGRESS : "progress for"

    COURSES ||--o{ QUIZ : "has"
    QUIZ ||--o{ QUIZ_QUESTIONS : "contains"
    QUESTION_TYPES ||--o{ QUIZ_QUESTIONS : "typed by"
    QUIZ_QUESTIONS ||--o{ QUESTION_OPTIONS : "has options"

    USERS ||--o{ QUIZ_ATTEMPTS : "attempts"
    QUIZ ||--o{ QUIZ_ATTEMPTS : "attempted in"
    QUIZ_ATTEMPTS ||--o{ QUIZ_ANSWERS : "records"
    QUIZ_QUESTIONS ||--o{ QUIZ_ANSWERS : "for question"
    QUESTION_OPTIONS ||--o{ QUIZ_ANSWERS : "selected option"

    USERS ||--o{ USER_SESSIONS : "opens"
```

---

## 2) Analytics Pipeline Diagram

```mermaid
flowchart LR
    A[Users interact with content/quizzes]
    B[activity_log]
    C[content_progress]
    D[quiz_attempts]
    E[enrollments/content/users]
    F[mv_performance_summary]
    G[mv_active_students]
    H[mv_underperforming_students]
    I[mv_skipped_content]
    J[mv_completion_rates]
    K["/api/v1/analytics/* endpoints"]
    L[Instructor/Admin dashboards]

    A --> B
    A --> C
    A --> D
    E --> F
    B --> F
    C --> F
    D --> F
    B --> G
    D --> H
    B --> I
    C --> J
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K
    K --> L
```

---

## 3) How to Explain the Diagram in Viva

- Core OLTP flow: user, course, enrollment, content, quiz attempt.
- Event data (`activity_log`, `content_progress`, `quiz_attempts`) feeds analytics layer.
- Materialized views precompute expensive joins/aggregates.
- API reads those views for fast instructor/admin dashboards.

