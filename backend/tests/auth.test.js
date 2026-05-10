const request = require("supertest");
const app = require("../src/app");

// These are integration tests – they require a running Oracle XE instance.
// Set TEST_DB=true in your .env and point to a test schema.

describe("Auth API", () => {
  const testUser = {
    full_name: "Test User",
    email: `test_${Date.now()}@example.com`,
    password: "Password123!",
  };

  let token;

  test("POST /api/v1/auth/register – creates a new student", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(testUser);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("user_id");
  });

  test("POST /api/v1/auth/register – rejects duplicate email", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(testUser);
    expect(res.statusCode).toBe(409);
  });

  test("POST /api/v1/auth/login – returns JWT", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    token = res.body.token;
  });

  test("POST /api/v1/auth/login – wrong password returns 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testUser.email, password: "wrongpassword" });
    expect(res.statusCode).toBe(401);
  });

  test("GET /api/v1/users/me – returns profile with valid token", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("email", testUser.email);
  });

  test("GET /api/v1/users/me – returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.statusCode).toBe(401);
  });

  test("POST /api/v1/auth/logout – invalidates session", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });
});

describe("Validation", () => {
  test("POST /api/v1/auth/register – rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ full_name: "X", email: "notanemail", password: "Password123!" });
    expect(res.statusCode).toBe(422);
    expect(res.body).toHaveProperty("errors");
  });

  test("POST /api/v1/auth/register – rejects short password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ full_name: "X", email: "x@test.com", password: "123" });
    expect(res.statusCode).toBe(422);
  });
});
