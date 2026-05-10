# LearnTrack – Backend API

Node.js + Express REST API for the LearnTrack Online Learning Behavior Analyzer.

## Stack
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 4
- **Database**: Oracle XE 21c (via `oracledb` 6 + raw SQL)
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **Validation**: express-validator
- **Security**: helmet, cors, HTTP-only cookies

---

## Project Structure

```
server/
├── src/
│   ├── app.js                  # Express entry point
│   ├── db/
│   │   ├── connection.js       # Oracle pool + query helper
│   │   ├── ddl.sql             # CREATE TABLE statements (13 tables)
│   │   └── seed.sql            # Sample DML data
│   ├── middleware/
│   │   ├── auth.js             # verifyToken, requireRole
│   │   ├── validate.js         # express-validator runner
│   │   └── errorHandler.js     # Global error handler
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── courseController.js
│   │   ├── activityController.js
│   │   ├── progressController.js
│   │   ├── quizController.js
│   │   └── analyticsController.js
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       ├── courses.js
│       ├── activity.js
│       ├── progress.js
│       ├── quizzes.js
│       └── analytics.js
└── tests/
    └── auth.test.js
```

---

## Setup

### 1. Install dependencies
```bash
cd server
npm install
npm install cookie-parser   # additional peer dep used in app.js
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your Oracle XE credentials and JWT secret
```

### 3. Create the database schema
Open DBeaver or SQL*Plus connected to your Oracle XE instance, then run:
```sql
@src/db/ddl.sql
@src/db/seed.sql
```

### 4. Start the server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

API will be available at: `http://localhost:5000/api/v1`

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Login, receive JWT |
| POST | `/auth/logout` | JWT | Invalidate session |
| GET | `/users/me` | JWT | Get own profile |
| PUT | `/users/me` | JWT | Update profile |
| GET | `/users` | Admin | List all users |
| DELETE | `/users/:id` | Admin | Delete user |
| PUT | `/users/:id/status` | Admin | Activate/deactivate |
| GET | `/courses` | JWT | List/search courses |
| POST | `/courses` | Instructor | Create course |
| PUT | `/courses/:id` | Instructor | Update course |
| DELETE | `/courses/:id` | Admin | Delete course |
| POST | `/courses/:id/enroll` | Student | Enroll in course |
| GET | `/courses/:id/content` | JWT | List course content |
| POST | `/courses/:id/content` | Instructor | Add content metadata |
| POST | `/activity` | JWT | Log behavior event |
| GET | `/progress/me` | JWT | Get personal progress |
| PUT | `/progress/:contentId` | JWT | Update progress % |
| GET | `/quizzes/:id` | JWT | Get quiz + questions |
| POST | `/quizzes` | Instructor | Create quiz |
| POST | `/quizzes/:id/questions` | Instructor | Add question |
| POST | `/quizzes/:id/attempt` | Student | Submit quiz attempt |
| GET | `/analytics/active-students` | Instructor | Top students by watch time |
| GET | `/analytics/underperforming` | Instructor | Students below score threshold |
| GET | `/analytics/skipped-content` | Instructor | Most skipped content |
| GET | `/analytics/completion-rates` | Instructor | Completion % per student |
| GET | `/analytics/performance-trend/:userId` | Instructor | Quiz score trend |
| GET | `/analytics/instructor/:courseId` | Instructor | Full instructor dashboard |
| GET | `/analytics/dashboard/admin` | Admin | Platform-wide stats |
| POST | `/analytics/refresh-summary` | Admin | Recompute performance_summary |

---

## Running Tests
```bash
npm test
```
Tests require a live Oracle XE connection. Point `DB_CONNECT_STRING` to a test schema.

---

## Default Seed Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@learntrack.io | *(set via bcrypt in seed.sql)* |
| Instructor | sara@learntrack.io | *(set via bcrypt in seed.sql)* |
| Student | ali@learntrack.io | *(set via bcrypt in seed.sql)* |

> **Note**: Replace the placeholder bcrypt hashes in `seed.sql` with real hashes before running.
> Generate them with: `node -e "const b=require('bcrypt'); b.hash('Password123!',12).then(console.log)"`
