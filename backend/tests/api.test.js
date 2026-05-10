/**
 * LearnTrack – Full Integration Test Suite
 *
 * Covers every route EXCEPT auth (which is in auth.test.js).
 * Run with: npm test
 *
 * Tests run sequentially (--runInBand) so IDs created in one test
 * can be reused in later tests within the same describe block.
 * Each describe block is self-contained: it registers/logs in its
 * own users and creates its own data.
 */

const request = require("supertest");
const app = require("../src/app");

// Each beforeAll registers multiple users against a live Supabase instance.
// Each register+login round-trip takes ~1-2s, so we need a generous timeout.
jest.setTimeout(60000);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ts = () => Date.now();

function makeUser(role = "student") {
  return {
    full_name: `Test ${role} ${ts()}`,
    email: `${role}_${ts()}@test.learntrack.dev`,
    password: "TestPass123!",
    role,
  };
}

async function registerAndLogin(userData) {
  await request(app).post("/api/v1/auth/register").send(userData);
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: userData.email, password: userData.password });
  if (!res.body.token) {
    throw new Error(
      `registerAndLogin failed for ${userData.email}: HTTP ${res.statusCode} — ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.token;
}

// Instructor row creation has a ~300ms async retry in authController.
// On slow CI, createCourse may return 403 once before the row is ready.
// This helper retries up to 5 times with 600ms gaps.
async function createCourseWithRetry(token, title, extra = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title,
        is_published: true,
        ...extra,
      });

    process.stdout.write(
      "\nCREATE COURSE DEBUG\n" +
        "Attempt: " +
        (attempt + 1) +
        "\n" +
        "Status: " +
        res.statusCode +
        "\n" +
        "Body: " +
        JSON.stringify(res.body) +
        "\n\n",
    );

    if (res.statusCode === 201) {
      return res.body.course_id;
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  throw new Error(`createCourse failed after 5 retries: ${title}`);
}
// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

describe("Users", () => {
  const studentData = makeUser("student");
  const adminData = makeUser("admin");
  let studentToken, adminToken, studentId;

  beforeAll(async () => {
    studentToken = await registerAndLogin(studentData);
    adminToken = await registerAndLogin(adminData);
  });

  test("GET /users/me – 200 returns own profile", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("email", studentData.email);
    expect(res.body).toHaveProperty("role", "student");
    expect(res.body).not.toHaveProperty("password");
    studentId = res.body.user_id;
  });

  test("GET /users/me – 401 without token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.statusCode).toBe(401);
  });

  test("PUT /users/me – 200 updates full_name", async () => {
    const res = await request(app)
      .put("/api/v1/users/me")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ full_name: "Updated Name" });
    expect(res.statusCode).toBe(200);
  });

  test("PUT /users/me – 200 updates bio", async () => {
    const res = await request(app)
      .put("/api/v1/users/me")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ bio: "I love learning." });
    expect(res.statusCode).toBe(200);
  });

  test("PUT /users/me – 422 on invalid avatar_url", async () => {
    const res = await request(app)
      .put("/api/v1/users/me")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ avatar_url: "not-a-url" });
    expect(res.statusCode).toBe(422);
  });

  test("PUT /users/me – 422 on short password", async () => {
    const res = await request(app)
      .put("/api/v1/users/me")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ password: "123" });
    expect(res.statusCode).toBe(422);
  });

  test("GET /users – 200 for admin, returns array", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Verify no password field is exposed
    expect(res.body[0]).not.toHaveProperty("password");
  });

  test("GET /users – 403 for student", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("PUT /users/:id/status – 200 admin deactivates user", async () => {
    const res = await request(app)
      .put(`/api/v1/users/${studentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_active: false });
    expect(res.statusCode).toBe(200);
    // Immediately reactivate so subsequent tests with studentToken still work
    await request(app)
      .put(`/api/v1/users/${studentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_active: true });
  });

  test("PUT /users/:id/status – 422 on non-boolean", async () => {
    const res = await request(app)
      .put(`/api/v1/users/${studentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_active: "yes" });
    expect(res.statusCode).toBe(422);
  });

  test("PUT /users/:id/status – 403 for student", async () => {
    const res = await request(app)
      .put(`/api/v1/users/${studentId}/status`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ is_active: true });
    expect(res.statusCode).toBe(403);
  });

  test("DELETE /users/:id – 200 admin deletes user", async () => {
    // Create a throwaway user to delete
    const throwaway = makeUser("student");
    const token = await registerAndLogin(throwaway);
    const meRes = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);
    const uid = meRes.body.user_id;

    const res = await request(app)
      .delete(`/api/v1/users/${uid}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });

  test("DELETE /users/:id – 403 for student", async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${studentId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────────────────────────────────

describe("Courses", () => {
  const instructorData = makeUser("instructor");
  const studentData = makeUser("student");
  const adminData = makeUser("admin");
  let instructorToken, studentToken, adminToken;
  let courseId, contentId;

  beforeAll(async () => {
    instructorToken = await registerAndLogin(instructorData);
    studentToken = await registerAndLogin(studentData);
    adminToken = await registerAndLogin(adminData);
  });

  test("GET /courses – 200 returns array (student)", async () => {
    const res = await request(app)
      .get("/api/v1/courses")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /courses – 401 without token", async () => {
    const res = await request(app).get("/api/v1/courses");
    expect(res.statusCode).toBe(401);
  });

  test("POST /courses – 403 for student", async () => {
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Sneaky Course", category: "Test" });
    expect(res.statusCode).toBe(403);
  });

  test("POST /courses – 422 missing title", async () => {
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ category: "Testing" });
    expect(res.statusCode).toBe(422);
  });

  test("POST /courses – 201 for instructor", async () => {
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Test Course", category: "Testing", is_published: true });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("course_id");
    courseId = res.body.course_id;
  });

  test("POST /courses – 201 for admin", async () => {
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Admin Course", is_published: false });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("course_id");
  });

  test("GET /courses/:id – 200 returns course detail", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("course_id", courseId);
    // v2: course detail includes related content and quizzes
    expect(res.body).toHaveProperty("content");
    expect(res.body).toHaveProperty("quizzes");
  });

  test("GET /courses/:id – 404 on non-existent ID", async () => {
    const res = await request(app)
      .get("/api/v1/courses/999999")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(404);
  });

  test("PUT /courses/:id – 200 updates title (instructor)", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Updated Course Title" });
    expect(res.statusCode).toBe(200);
  });

  test("PUT /courses/:id – 403 for student", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Hacked Title" });
    expect(res.statusCode).toBe(403);
  });

  test("PUT /courses/:id – 422 on empty title string", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "" });
    expect(res.statusCode).toBe(422);
  });

  // ── Content ──────────────────────────────────────────────────────────────

  test("POST /courses/:id/content – 201 adds video content", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Intro Video",
        content_type: "video",
        duration_sec: 300,
        sort_order: 1,
        is_published: true,
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("content_id");
    contentId = res.body.content_id;
  });

  test("POST /courses/:id/content – 201 adds document content", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Lecture Notes",
        content_type: "document",
        sort_order: 2,
      });
    expect(res.statusCode).toBe(201);
  });

  test("POST /courses/:id/content – 422 on invalid content_type", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Bad", content_type: "podcast" });
    expect(res.statusCode).toBe(422);
  });

  test("POST /courses/:id/content – 422 missing title", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ content_type: "video" });
    expect(res.statusCode).toBe(422);
  });

  test("POST /courses/:id/content – 403 for student", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Sneaky Content", content_type: "video" });
    expect(res.statusCode).toBe(403);
  });

  test("GET /courses/:id/content – 200 returns array", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("content_id");
  });

  test("PUT /courses/:id/content/:contentId – 200 updates content", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/${courseId}/content/${contentId}`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Updated Intro Video", duration_sec: 360 });
    expect(res.statusCode).toBe(200);
  });

  test("PUT /courses/:id/content/:contentId – 403 for student", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/${courseId}/content/${contentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Hacked" });
    expect(res.statusCode).toBe(403);
  });

  test("GET /courses/:id/students – 200 for instructor, returns array", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/${courseId}/students`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /courses/:id/students – 403 for student", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/${courseId}/students`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("DELETE /courses/:id/content/:contentId – 200 removes content", async () => {
    const res = await request(app)
      .delete(`/api/v1/courses/${courseId}/content/${contentId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
  });

  test("DELETE /courses/:id/content/:contentId – 403 for student", async () => {
    // Need a fresh content item since we just deleted contentId
    const addRes = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Another Video", content_type: "video" });
    const newContentId = addRes.body.content_id;

    const res = await request(app)
      .delete(`/api/v1/courses/${courseId}/content/${newContentId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("DELETE /courses/:id – 403 for instructor (admin only)", async () => {
    const res = await request(app)
      .delete(`/api/v1/courses/${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("DELETE /courses/:id – 200 for admin", async () => {
    // Create a throwaway course to delete
    const createRes = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Course To Delete", is_published: false });
    const tempId = createRes.body.course_id;

    const res = await request(app)
      .delete(`/api/v1/courses/${tempId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENROLLMENTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Enrollments", () => {
  const instructorData = makeUser("instructor");
  const studentData = makeUser("student");
  const adminData = makeUser("admin");
  let instructorToken, studentToken, adminToken;
  let courseId, enrollmentId;

  beforeAll(async () => {
    instructorToken = await registerAndLogin(instructorData);
    studentToken = await registerAndLogin(studentData);
    adminToken = await registerAndLogin(adminData);

    // Retry course creation — the instructors row insert in register() has a
    // 300ms retry delay, but under load it may still not be ready immediately.
    let courseRes;
    for (let attempt = 0; attempt < 5; attempt++) {
      courseRes = await request(app)
        .post("/api/v1/courses")
        .set("Authorization", `Bearer ${instructorToken}`)
        .send({ title: "Enrollment Test Course", is_published: true });
      if (courseRes.statusCode === 201) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    courseId = courseRes.body.course_id;
  });

  test("GET /enrollments/my – 200 returns empty array before enrolling", async () => {
    const res = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /enrollments/my – 401 without token", async () => {
    const res = await request(app).get("/api/v1/enrollments/my");
    expect(res.statusCode).toBe(401);
  });

  test("GET /enrollments/my – 403 for instructor", async () => {
    const res = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("POST /enrollments/:courseId – 201 student enrolls", async () => {
    const res = await request(app)
      .post(`/api/v1/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("enrollment_id");
    enrollmentId = res.body.enrollment_id;
  });

  test("POST /enrollments/:courseId – 409 on duplicate enrollment", async () => {
    const res = await request(app)
      .post(`/api/v1/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(409);
  });

  test("POST /enrollments/:courseId – 403 for instructor", async () => {
    const res = await request(app)
      .post(`/api/v1/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("POST /enrollments/:courseId – 404 on non-existent course", async () => {
    const res = await request(app)
      .post("/api/v1/enrollments/999999")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(404);
  });

  test("GET /enrollments/my – 200 shows enrolled course with nested data", async () => {
    const res = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    // v2: enrollment includes nested course and status
    expect(res.body[0]).toHaveProperty("enrollment_id");
    expect(res.body[0]).toHaveProperty("courses");
    expect(res.body[0]).toHaveProperty("enrollment_statuses");
  });

  test("PATCH /enrollments/:id/status – 200 student drops course", async () => {
    const res = await request(app)
      .patch(`/api/v1/enrollments/${enrollmentId}/status`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ status_name: "dropped" });
    expect(res.statusCode).toBe(200);
  });

  test("PATCH /enrollments/:id/status – 200 admin sets completed", async () => {
    const res = await request(app)
      .patch(`/api/v1/enrollments/${enrollmentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status_name: "completed" });
    expect(res.statusCode).toBe(200);
  });

  test("PATCH /enrollments/:id/status – 422 on invalid status", async () => {
    const res = await request(app)
      .patch(`/api/v1/enrollments/${enrollmentId}/status`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ status_name: "abandoned" });
    expect(res.statusCode).toBe(422);
  });

  test("PATCH /enrollments/:id/status – 403 student cannot update another student's enrollment", async () => {
    // Create a second student and enroll them
    const otherStudent = makeUser("student");
    const otherToken = await registerAndLogin(otherStudent);
    await request(app)
      .post(`/api/v1/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    const otherMe = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${otherToken}`);
    const otherId = otherMe.body[0].enrollment_id;

    const res = await request(app)
      .patch(`/api/v1/enrollments/${otherId}/status`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ status_name: "dropped" });
    expect(res.statusCode).toBe(403);
  });

  test("DELETE /enrollments/:id – 200 admin hard-deletes enrollment", async () => {
    const res = await request(app)
      .delete(`/api/v1/enrollments/${enrollmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });

  test("DELETE /enrollments/:id – 403 for student", async () => {
    // Re-enroll so we have something to try to delete
    const reEnroll = await request(app)
      .post(`/api/v1/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    const newEnrollmentId = reEnroll.body.enrollment_id;

    const res = await request(app)
      .delete(`/api/v1/enrollments/${newEnrollmentId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QUIZZES
// ─────────────────────────────────────────────────────────────────────────────

describe("Quizzes", () => {
  const instructorData = makeUser("instructor");
  const studentData = makeUser("student");
  let instructorToken, studentToken;
  let courseId, quizId, questionId, optionCorrectId, optionWrongId, attemptId;

  beforeAll(async () => {
    instructorToken = await registerAndLogin(instructorData);
    studentToken = await registerAndLogin(studentData);

    courseId = await createCourseWithRetry(instructorToken, "Quiz Test Course");

    // Enroll student so they can attempt quizzes
    await request(app)
      .post(`/api/v1/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
  });

  test("GET /quizzes/question-types – 200 returns types array with mcq", async () => {
    const res = await request(app)
      .get("/api/v1/quizzes/question-types")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t) => t.type_name === "mcq")).toBe(true);
    expect(res.body.some((t) => t.type_name === "true_false")).toBe(true);
  });

  test("POST /quizzes – 403 for student", async () => {
    const res = await request(app)
      .post("/api/v1/quizzes")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ course_id: courseId, title: "Sneaky Quiz" });
    expect(res.statusCode).toBe(403);
  });

  test("POST /quizzes – 422 missing course_id", async () => {
    const res = await request(app)
      .post("/api/v1/quizzes")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "No Course Quiz" });
    expect(res.statusCode).toBe(422);
  });

  test("POST /quizzes – 422 missing title", async () => {
    const res = await request(app)
      .post("/api/v1/quizzes")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ course_id: courseId });
    expect(res.statusCode).toBe(422);
  });

  test("POST /quizzes – 201 instructor creates quiz", async () => {
    const res = await request(app)
      .post("/api/v1/quizzes")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        course_id: courseId,
        title: "Midterm Quiz",
        pass_score: 70,
        allow_multiple: true,
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("quiz_id");
    quizId = res.body.quiz_id;
  });

  // ── Questions ─────────────────────────────────────────────────────────────

  test("POST /quizzes/:id/questions – 422 with no options", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        question_type: "mcq",
        question_text: "Missing options?",
        options: [],
      });
    expect(res.statusCode).toBe(422);
  });

  test("POST /quizzes/:id/questions – 400 with no correct answer", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        question_type: "mcq",
        question_text: "All wrong?",
        options: [
          { option_text: "A", is_correct: false },
          { option_text: "B", is_correct: false },
        ],
      });
    expect([400, 422]).toContain(res.statusCode);
  });

  test("POST /quizzes/:id/questions – 400 true_false with 3 options", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        question_type: "true_false",
        question_text: "The sky is blue.",
        options: [
          { option_text: "True", is_correct: true },
          { option_text: "False", is_correct: false },
          { option_text: "Maybe", is_correct: false },
        ],
      });
    expect([400, 422]).toContain(res.statusCode);
  });

  test("POST /quizzes/:id/questions – 403 for student", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        question_type: "mcq",
        question_text: "Sneaky?",
        options: [{ option_text: "Yes", is_correct: true }],
      });
    expect(res.statusCode).toBe(403);
  });

  test("POST /quizzes/:id/questions – 201 adds MCQ with 4 options", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        question_type: "mcq",
        question_text: "What is 2 + 2?",
        points: 2,
        options: [
          { option_text: "3", is_correct: false },
          { option_text: "4", is_correct: true },
          { option_text: "5", is_correct: false },
          { option_text: "22", is_correct: false },
        ],
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("question_id");
    questionId = res.body.question_id;
  });

  test("POST /quizzes/:id/questions – 201 adds true/false question", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        question_type: "true_false",
        question_text: "Node.js is single-threaded.",
        options: [
          { option_text: "True", is_correct: true },
          { option_text: "False", is_correct: false },
        ],
      });
    expect(res.statusCode).toBe(201);
  });

  // ── Get quiz ──────────────────────────────────────────────────────────────

  test("GET /quizzes/:id – 200 returns quiz without is_correct for student", async () => {
    const res = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("quiz_id", quizId);
    expect(res.body).toHaveProperty("questions");
    expect(Array.isArray(res.body.questions)).toBe(true);

    // is_correct must NOT be leaked to the student
    const opts = res.body.questions[0]?.question_options || [];
    expect(opts.length).toBeGreaterThan(0);
    opts.forEach((o) => expect(o).not.toHaveProperty("is_correct"));

    // Capture option IDs for attempt tests
    optionCorrectId =
      opts.find((o) => o.option_text === "4")?.option_id ?? opts[0].option_id;
    optionWrongId =
      opts.find((o) => o.option_id !== optionCorrectId)?.option_id ??
      opts[1].option_id;
  });

  test("GET /quizzes/:id – 404 on bad ID", async () => {
    const res = await request(app)
      .get("/api/v1/quizzes/999999")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(404);
  });

  // ── Attempts ──────────────────────────────────────────────────────────────

  test("POST /quizzes/:id/attempt – 403 for instructor", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempt`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        answers: [{ question_id: questionId, option_id: optionCorrectId }],
      });
    expect(res.statusCode).toBe(403);
  });

  test("POST /quizzes/:id/attempt – 422 missing answers", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempt`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.statusCode).toBe(422);
  });

  test("POST /quizzes/:id/attempt – 201 correct answer scores 100", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempt`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [{ question_id: questionId, option_id: optionCorrectId }],
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("attempt_id");
    expect(res.body).toHaveProperty("score");
    expect(res.body).toHaveProperty("passed");
    expect(res.body).toHaveProperty("correct_count");
    expect(res.body).toHaveProperty("total_questions");
    // 2pt question answered correctly out of 2pt total (ignoring the true_false question)
    expect(res.body.correct_count).toBe(1);
    attemptId = res.body.attempt_id;
  });

  test("POST /quizzes/:id/attempt – 201 wrong answer scores 0", async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempt`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [{ question_id: questionId, option_id: optionWrongId }],
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.correct_count).toBe(0);
    expect(res.body.passed).toBe(false);
  });

  // ── Attempt review ────────────────────────────────────────────────────────

  test("GET /quizzes/attempts/:attemptId – 200 owner sees full review", async () => {
    const res = await request(app)
      .get(`/api/v1/quizzes/attempts/${attemptId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("attempt_id", attemptId);
    expect(res.body).toHaveProperty("score");
    expect(res.body).toHaveProperty("passed");
    expect(res.body).toHaveProperty("answers");
    expect(Array.isArray(res.body.answers)).toBe(true);
    expect(res.body.answers[0]).toHaveProperty("is_correct");
  });

  test("GET /quizzes/attempts/:attemptId – 404 on bad ID", async () => {
    const res = await request(app)
      .get("/api/v1/quizzes/attempts/999999")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(404);
  });

  test("GET /quizzes/attempts/:attemptId – 403 for different user", async () => {
    const other = makeUser("student");
    const otherToken = await registerAndLogin(other);
    const res = await request(app)
      .get(`/api/v1/quizzes/attempts/${attemptId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.statusCode).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

describe("Progress", () => {
  const instructorData = makeUser("instructor");
  const studentData = makeUser("student");
  let instructorToken, studentToken, contentId;

  beforeAll(async () => {
    instructorToken = await registerAndLogin(instructorData);
    studentToken = await registerAndLogin(studentData);

    const courseId = await createCourseWithRetry(
      instructorToken,
      "Progress Test Course",
    );

    const contentRes = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Lecture 1", content_type: "video", is_published: true });
    contentId = contentRes.body.content_id;
  });

  test("GET /progress/me – 401 without token", async () => {
    const res = await request(app).get("/api/v1/progress/me");
    expect(res.statusCode).toBe(401);
  });

  test("GET /progress/me – 200 returns empty array before any progress", async () => {
    const res = await request(app)
      .get("/api/v1/progress/me")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("PUT /progress/:contentId – 422 on out-of-range value (>100)", async () => {
    const res = await request(app)
      .put(`/api/v1/progress/${contentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ progress_percent: 150 });
    expect(res.statusCode).toBe(422);
  });

  test("PUT /progress/:contentId – 422 on negative value", async () => {
    const res = await request(app)
      .put(`/api/v1/progress/${contentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ progress_percent: -5 });
    expect(res.statusCode).toBe(422);
  });

  test("PUT /progress/:contentId – 422 missing progress_percent", async () => {
    const res = await request(app)
      .put(`/api/v1/progress/${contentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.statusCode).toBe(422);
  });

  test("PUT /progress/:contentId – 200 saves initial progress", async () => {
    const res = await request(app)
      .put(`/api/v1/progress/${contentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ progress_percent: 45.5 });
    expect(res.statusCode).toBe(200);
  });

  test("PUT /progress/:contentId – 200 upserts progress on second call", async () => {
    const res = await request(app)
      .put(`/api/v1/progress/${contentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ progress_percent: 80 });
    expect(res.statusCode).toBe(200);
  });

  test("GET /progress/me – 200 shows updated progress value", async () => {
    const res = await request(app)
      .get("/api/v1/progress/me")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    const entry = res.body.find((p) => p.content_id === contentId);
    expect(entry).toBeDefined();
    expect(Number(entry.progress_percent)).toBe(80);
  });

  test("PUT /progress/:contentId – 200 marks as 100% complete", async () => {
    const res = await request(app)
      .put(`/api/v1/progress/${contentId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ progress_percent: 100 });
    expect(res.statusCode).toBe(200);
  });

  test("GET /progress/me – 200 confirms 100% completion", async () => {
    const res = await request(app)
      .get("/api/v1/progress/me")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    const entry = res.body.find((p) => p.content_id === contentId);
    expect(Number(entry.progress_percent)).toBe(100);
  });

  test("PUT /progress/:contentId – 401 without token", async () => {
    const res = await request(app)
      .put(`/api/v1/progress/${contentId}`)
      .send({ progress_percent: 50 });
    expect(res.statusCode).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY
// ─────────────────────────────────────────────────────────────────────────────

describe("Activity", () => {
  const instructorData = makeUser("instructor");
  const studentData = makeUser("student");
  let studentToken, contentId;

  beforeAll(async () => {
    const instructorToken = await registerAndLogin(instructorData);
    studentToken = await registerAndLogin(studentData);

    const courseId = await createCourseWithRetry(
      instructorToken,
      "Activity Test Course",
    );

    const contentRes = await request(app)
      .post(`/api/v1/courses/${courseId}/content`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Video 1", content_type: "video", is_published: true });
    contentId = contentRes.body.content_id;
  });

  test("POST /activity – 401 without token", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .send({ content_id: contentId, event_type: "play" });
    expect(res.statusCode).toBe(401);
  });

  test("POST /activity – 422 missing content_id", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ event_type: "play" });
    expect(res.statusCode).toBe(422);
  });

  test("POST /activity – 422 on invalid event_type", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ content_id: contentId, event_type: "rewind" });
    expect(res.statusCode).toBe(422);
  });

  test("POST /activity – 422 on negative watch_time", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ content_id: contentId, event_type: "play", watch_time: -10 });
    expect(res.statusCode).toBe(422);
  });

  test("POST /activity – 201 logs a play event", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ content_id: contentId, event_type: "play", watch_time: 0 });
    expect(res.statusCode).toBe(201);
  });

  test("POST /activity – 201 logs a pause event", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ content_id: contentId, event_type: "pause", watch_time: 45 });
    expect(res.statusCode).toBe(201);
  });

  test("POST /activity – 201 logs a skip event", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ content_id: contentId, event_type: "skip" });
    expect(res.statusCode).toBe(201);
  });

  test("POST /activity – 201 logs a seek event", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ content_id: contentId, event_type: "seek", watch_time: 120 });
    expect(res.statusCode).toBe(201);
  });

  test("POST /activity – 201 logs a complete event with watch_time", async () => {
    const res = await request(app)
      .post("/api/v1/activity")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ content_id: contentId, event_type: "complete", watch_time: 300 });
    expect(res.statusCode).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

describe("Analytics", () => {
  const adminData = makeUser("admin");
  const instructorData = makeUser("instructor");
  const studentData = makeUser("student");
  let adminToken, instructorToken, studentToken;
  let courseId, studentUserId;

  beforeAll(async () => {
    adminToken = await registerAndLogin(adminData);
    instructorToken = await registerAndLogin(instructorData);
    studentToken = await registerAndLogin(studentData);

    if (!adminToken || !instructorToken || !studentToken) {
      throw new Error(
        `Analytics beforeAll: token missing — admin:${!!adminToken} instructor:${!!instructorToken} student:${!!studentToken}`,
      );
    }

    courseId = await createCourseWithRetry(instructorToken, "Analytics Course");

    // Capture student's user_id for performance-trend tests
    const me = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${studentToken}`);
    studentUserId = me.body.user_id;
  });

  // ── Active students ───────────────────────────────────────────────────────

  test("GET /analytics/active-students – 403 for student", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/active-students")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/active-students – 200 for admin, returns array", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/active-students")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /analytics/active-students – 200 for instructor", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/active-students")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
  });

  test("GET /analytics/active-students – accepts ?start and ?end query params", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/active-students?start=2024-01-01&end=2099-12-31")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /analytics/active-students – instructor may filter ?course_id", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/active-students?course_id=${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Underperforming ───────────────────────────────────────────────────────

  test("GET /analytics/underperforming – 403 for student", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/underperforming")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/underperforming – 200 for instructor, returns array", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/underperforming")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /analytics/underperforming – accepts ?threshold query param", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/underperforming?threshold=60")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
  });

  test("GET /analytics/underperforming – instructor may filter ?course_id", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/underperforming?course_id=${courseId}&threshold=50`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Skipped content ───────────────────────────────────────────────────────

  test("GET /analytics/skipped-content – 403 for student", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/skipped-content")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/skipped-content – 200 for instructor, returns array", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/skipped-content")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /analytics/skipped-content – accepts ?course_id filter", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/skipped-content?course_id=${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
  });

  // ── Completion rates ──────────────────────────────────────────────────────

  test("GET /analytics/completion-rates – 403 for student", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/completion-rates")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/completion-rates – 200 for instructor, returns array", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/completion-rates")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /analytics/completion-rates – accepts ?course_id filter", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/completion-rates?course_id=${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
  });

  // ── Instructor dashboard ──────────────────────────────────────────────────

  test("GET /analytics/instructor/:courseId – 403 for student", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/instructor/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/instructor/:courseId – 200 for instructor with expected fields", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/instructor/${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("enrollment_count");
    expect(res.body).toHaveProperty("top_students");
    expect(res.body).toHaveProperty("at_risk_students");
    expect(Array.isArray(res.body.top_students)).toBe(true);
    expect(Array.isArray(res.body.at_risk_students)).toBe(true);
  });

  test("GET /analytics/instructor/:courseId – 200 for admin", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/instructor/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("enrollment_count");
  });

  test("Instructor scoped analytics – 403 when targeting another instructor's course", async () => {
    const other = makeUser("instructor");
    const tok = await registerAndLogin(other);
    const foreignCourseId = await createCourseWithRetry(
      tok,
      "Scoped foreign instructor course",
    );

    const dash = await request(app)
      .get(`/api/v1/analytics/instructor/${foreignCourseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(dash.statusCode).toBe(403);

    const comp = await request(app)
      .get(`/api/v1/analytics/completion-rates?course_id=${foreignCourseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(comp.statusCode).toBe(403);

    const skip = await request(app)
      .get(`/api/v1/analytics/skipped-content?course_id=${foreignCourseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(skip.statusCode).toBe(403);
  });

  // ── Admin dashboard ───────────────────────────────────────────────────────

  test("GET /analytics/dashboard/admin – 403 for student", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/dashboard/admin")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/dashboard/admin – 403 for instructor", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/dashboard/admin")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/dashboard/admin – 200 for admin with all expected fields", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/dashboard/admin")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("total_users");
    expect(res.body).toHaveProperty("total_courses");
    expect(res.body).toHaveProperty("total_enrollments");
    expect(res.body).toHaveProperty("active_sessions");
    expect(res.body).toHaveProperty("active_students");
    expect(res.body).toHaveProperty("course_stats");
    expect(typeof res.body.total_users).toBe("number");
    expect(typeof res.body.total_courses).toBe("number");
    expect(typeof res.body.active_students).toBe("number");
  });

  // ── Performance trend ─────────────────────────────────────────────────────

  test("GET /analytics/performance-trend/:userId – 200 student sees own trend", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/performance-trend/${studentUserId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /analytics/performance-trend/:userId – 403 student cannot see another user's trend", async () => {
    const other = makeUser("student");
    const otherToken = await registerAndLogin(other);
    const otherMe = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${otherToken}`);
    const otherUserId = otherMe.body.user_id;

    // Original student tries to access other student's trend
    const res = await request(app)
      .get(`/api/v1/analytics/performance-trend/${otherUserId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("GET /analytics/performance-trend/:userId – 200 instructor can see any user", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/performance-trend/${studentUserId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /analytics/performance-trend/:userId – 200 admin can see any user", async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/performance-trend/${studentUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });

  // ── Refresh summary ───────────────────────────────────────────────────────

  test("POST /analytics/refresh-summary – 403 for instructor", async () => {
    const res = await request(app)
      .post("/api/v1/analytics/refresh-summary")
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("POST /analytics/refresh-summary – 403 for student", async () => {
    const res = await request(app)
      .post("/api/v1/analytics/refresh-summary")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
  });

  // NOTE: This will fail if refresh_performance_summary() function is not in ddl.sql.
  // Add it with: CREATE OR REPLACE FUNCTION refresh_performance_summary()
  //   RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  //     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_summary; $$;
  test("POST /analytics/refresh-summary – 200 for admin", async () => {
    const res = await request(app)
      .post("/api/v1/analytics/refresh-summary")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK & 404
// ─────────────────────────────────────────────────────────────────────────────

describe("Health & 404", () => {
  test("GET /health – 200 with status ok", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
  });

  test("GET /nonexistent – 404", async () => {
    const res = await request(app)
      .get("/api/v1/doesnotexist")
      .set("Authorization", "Bearer fake");
    expect(res.statusCode).toBe(404);
  });

  test("POST /nonexistent – 404", async () => {
    const res = await request(app)
      .post("/api/v1/doesnotexist")
      .send({ foo: "bar" });
    expect(res.statusCode).toBe(404);
  });
});
