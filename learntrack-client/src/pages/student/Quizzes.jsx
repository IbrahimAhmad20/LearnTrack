import { useState, useEffect } from "react";
import {
  enrollments as enrollmentsApi,
  quizzes as quizzesApi,
} from "../../api";
import { Spinner, EmptyState, StatCard } from "../../components/ui";
import { QuizRunner } from "../../components";

export default function Quizzes() {
  const [enrolled, setEnrolled] = useState([]);
  const [quizMap, setQuizMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // { quiz, courseId }
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    enrollmentsApi
      .list()
      .then(async (r) => {
        setEnrolled(r.data);
        const results = await Promise.all(
          r.data.map((e) =>
            quizzesApi
              .list(e.course_id)
              .then((q) => ({
                courseId: e.course_id,
                title: e.title,
                quizzes: q.data,
              }))
              .catch(() => ({
                courseId: e.course_id,
                title: e.title,
                quizzes: [],
              })),
          ),
        );
        const map = {};
        results.forEach((r) => {
          map[r.courseId] = r;
        });
        setQuizMap(map);

        // student history / analytics
        const attemptsRes = await quizzesApi.myAttempts();
        setAttempts(attemptsRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openQuiz = async (quiz, courseId) => {
    let fullQuiz = quiz;
    try {
      const res = await quizzesApi.get(quiz.quiz_id);
      fullQuiz = res.data;
    } catch {
      // Fall back to the lightweight quiz object if details fail to load.
    }
    setActive({ quiz: fullQuiz, courseId });
    setResult(null);
  };

  const submitFromRunner = async (payload) => {
    try {
      const res = await quizzesApi.submit(active.quiz.quiz_id, payload);
      setResult(res.data);
      const attemptsRes = await quizzesApi.myAttempts();
      setAttempts(attemptsRes.data || []);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Submission failed";
      setResult({ error: msg });
    }
  };

  const allCourseQuizzes = Object.values(quizMap).flatMap((c) =>
    c.quizzes.map((q) => ({
      ...q,
      courseTitle: c.title,
      courseId: c.courseId,
    })),
  );

  const attemptedCount = attempts.length;
  const passedCount = attempts.filter((a) => a.passed).length;
  const avgScore =
    attemptedCount > 0
      ? Math.round(
          attempts.reduce((sum, a) => sum + Number(a.score || 0), 0) /
            attemptedCount,
        )
      : 0;

  return (
    <div className="p-8 max-w-3xl page-enter">
      <div className="mb-6">
        <h1
          className="text-xl font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Quizzes
        </h1>
        <p
          className="text-sm mt-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          Assessments across your enrolled courses
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Spinner />
        </div>
      ) : allCourseQuizzes.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No quizzes yet"
          description="Quizzes will appear here once your instructors add them"
        />
      ) : (
        <div className="card overflow-hidden">
          {allCourseQuizzes.map((q, i) => (
            <div
              key={q.quiz_id}
              className="flex items-center justify-between px-5 py-4"
              style={{
                borderBottom:
                  i < allCourseQuizzes.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {q.title}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "DM Mono, monospace",
                  }}
                >
                  {q.courseTitle}
                </p>
              </div>
              <button
                onClick={() => openQuiz(q, q.courseId)}
                className="btn-ghost text-xs py-1.5 px-3"
              >
                Start →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Student quiz analytics */}
      <div className="grid grid-cols-3 gap-3 mt-6 mb-4">
        <StatCard
          label="Attempts"
          value={attemptedCount}
          sub="total submissions"
          accent
        />
        <StatCard
          label="Average score"
          value={attemptedCount > 0 ? `${avgScore}%` : "—"}
          sub="across all attempts"
        />
        <StatCard
          label="Pass rate"
          value={
            attemptedCount > 0
              ? `${Math.round((passedCount / attemptedCount) * 100)}%`
              : "—"
          }
          sub={`${passedCount}/${attemptedCount || 0} passed`}
        />
      </div>

      <div className="card overflow-hidden mt-4">
        <div
          className="grid px-5 py-2.5 text-xs"
          style={{
            gridTemplateColumns: "1fr auto auto auto",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
            fontFamily: "DM Mono, monospace",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <span>Attempted quiz</span>
          <span>Course</span>
          <span>Score</span>
          <span>Status</span>
        </div>
        {attempts.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            You have not attempted any quiz yet.
          </div>
        ) : (
          attempts.slice(0, 15).map((a, i) => (
            <div
              key={a.attempt_id}
              className="grid px-5 py-3 text-sm items-center gap-3"
              style={{
                gridTemplateColumns: "1fr auto auto auto",
                borderBottom:
                  i < Math.min(attempts.length, 15) - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>
                {a.quiz?.title || `Quiz #${a.quiz_id}`}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}
              >
                {a.quiz?.courses?.title || `#${a.quiz?.course_id ?? "—"}`}
              </span>
              <span style={{ color: "var(--accent-text)", fontFamily: "DM Mono, monospace" }}>
                {Math.round(Number(a.score || 0))}%
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: a.passed ? "var(--accent)" : "var(--danger)" }}
              >
                {a.passed ? "Passed" : "Failed"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Quiz modal */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="card-raised w-full p-6"
            style={{
              maxWidth: 560,
              maxHeight: "85vh",
              overflowY: "auto",
              animation: "slideUp 0.2s ease",
            }}
          >
            <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div className="flex items-center justify-between mb-5">
              <h2
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {active.quiz.title}
              </h2>
              <button
                onClick={() => setActive(null)}
                style={{ color: "var(--text-muted)" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {result ? (
              <div className="text-center py-8">
                {result.error ? (
                  <p className="text-sm" style={{ color: "var(--danger)" }}>
                    {result.error}
                  </p>
                ) : (
                  <>
                    <p
                      className="font-display text-4xl mb-2"
                      style={{
                        color: "var(--accent)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {result.score != null
                        ? `${Number(result.score).toFixed(1)}%`
                        : result.percentage != null
                          ? `${Number(result.percentage).toFixed(1)}%`
                          : "—"}
                    </p>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: result.passed
                          ? "var(--accent)"
                          : "var(--danger)",
                      }}
                    >
                      {result.passed === true
                        ? "Passed"
                        : result.passed === false
                          ? "Below pass threshold"
                          : "Quiz submitted"}
                    </p>
                    {result.total_questions != null && (
                      <p
                        className="text-xs mt-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {result.correct_count ?? "—"} correct of{" "}
                        {result.total_questions} questions
                      </p>
                    )}
                    <button
                      onClick={() => setActive(null)}
                      className="btn-primary mt-6"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            ) : (
              <QuizRunner quiz={active.quiz} onSubmit={submitFromRunner} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
