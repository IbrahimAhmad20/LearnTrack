require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { connectDB } = require("./db/connection");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const courseRoutes = require("./routes/courses");
const enrollmentRoutes = require("./routes/enrollments"); // v2: new
const activityRoutes = require("./routes/activity");
const progressRoutes = require("./routes/progress");
const quizRoutes = require("./routes/quizzes");
const analyticsRoutes = require("./routes/analytics");
const instructorRoutes = require("./routes/instructors");
const sectionRoutes = require("./routes/sections"); // [CF4] course sections
const reviewRoutes = require("./routes/reviews"); // [CF2] reviews & ratings
const transactionRoutes = require("./routes/transactions"); // [CF1] payments
const certificateRoutes = require("./routes/certificates"); // [CF3] certificates
const notificationRoutes = require("./routes/notifications"); // [CF5] notifications
const uploadRoutes = require("./routes/uploads"); // [CF6] S3 file uploads

const app = express();

app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
// /transactions/callback and /transactions/webhook are called by Safepay's
// servers (no browser CORS involved, but helmet can block). Register open cors
// on both BEFORE the restrictive global CORS middleware.
app.use("/api/v1/transactions/callback", cors());
app.use("/api/v1/transactions/webhook", cors());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
try {
  app.use(cookieParser());
} catch (_) {}

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/enrollments", enrollmentRoutes);
app.use("/api/v1/activity", activityRoutes);
app.use("/api/v1/progress", progressRoutes);
app.use("/api/v1/quizzes", quizRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/instructors", instructorRoutes);
app.use("/api/v1/sections", sectionRoutes); // [CF4]
app.use("/api/v1/reviews", reviewRoutes); // [CF2]
app.use("/api/v1/transactions", transactionRoutes); // [CF1]
app.use("/api/v1/certificates", certificateRoutes); // [CF3]
app.use("/api/v1/notifications", notificationRoutes); // [CF5]
app.use("/api/v1/uploads", uploadRoutes); // [CF6]

app.get("/api/v1/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  (async () => {
    await connectDB();
    app.listen(PORT, () => {
      console.log(
        `LearnTrack API running on port ${PORT} [${process.env.NODE_ENV}]`,
      );
    });
  })();
} else {
  // Imported by tests — connect to DB but don't bind a port
  connectDB().catch(console.error);
}

module.exports = app;
