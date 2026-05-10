const request = require("supertest");
const app = require("../src/app");

jest.setTimeout(60000);

function ts() {
  return Date.now();
}

function makeUser(role = "student") {
  return {
    full_name: `Security ${role} ${ts()}`,
    email: `security_${role}_${ts()}@test.learntrack.dev`,
    password: "TestPass123!",
    role,
  };
}

async function registerAndLogin(userData) {
  await request(app).post("/api/v1/auth/register").send(userData);
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: userData.email, password: userData.password });
  return loginRes.body.token;
}

async function getWorkingToken(role) {
  for (let i = 0; i < 4; i++) {
    const token = await registerAndLogin(makeUser(role));
    if (!token) continue;
    const meRes = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);
    if (meRes.statusCode === 200 && meRes.body?.role === role) {
      return token;
    }
  }
  throw new Error(`Could not provision a valid ${role} token for tests`);
}

describe("Security regressions", () => {
  test("rejects protected route access without token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.statusCode).toBe(401);
  });

  test("rejects protected route access with invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer invalid.jwt.token");
    expect(res.statusCode).toBe(401);
  });

  test("never returns password field from profile endpoint", async () => {
    const nonAdminToken = await getWorkingToken("student");
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${nonAdminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toHaveProperty("password");
  });

  test("prevents non-admin users from accessing admin dashboard analytics", async () => {
    const nonAdminToken = await getWorkingToken("student");
    const res = await request(app)
      .get("/api/v1/analytics/dashboard/admin")
      .set("Authorization", `Bearer ${nonAdminToken}`);
    expect(res.statusCode).toBe(403);
  });

  test("permits admin access to admin dashboard analytics", async () => {
    const adminToken = await getWorkingToken("admin");
    const res = await request(app)
      .get("/api/v1/analytics/dashboard/admin")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });
});
