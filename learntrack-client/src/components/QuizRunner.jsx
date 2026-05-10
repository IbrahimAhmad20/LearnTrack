import { useEffect, useMemo, useState } from "react";
import { Spinner } from "./ui";

export default function QuizRunner({ quiz, onSubmit }) {
  const questions = quiz?.questions || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setIndex(0);
    setAnswers({});
    setLocalError("");
  }, [quiz?.quiz_id]);

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const progress = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;

  const payload = useMemo(
    () =>
      Object.entries(answers).map(([question_id, option_id]) => ({
        question_id: Number(question_id),
        option_id: Number(option_id),
      })),
    [answers],
  );

  const answeredCount = payload.length;
  const allAnswered =
    questions.length > 0 && answeredCount === questions.length;

  const submit = async () => {
    setLocalError("");
    if (!allAnswered) {
      setLocalError(`Answer all questions (${answeredCount}/${questions.length}).`);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit?.(payload);
    } finally {
      setSubmitting(false);
    }
  };

  if (!current) {
    return <div className="card p-6 text-sm">No quiz questions available.</div>;
  }

  return (
    <div className="card p-5">
      <div className="mb-4">
        <div
          className="rounded-full overflow-hidden mb-2"
          style={{ background: "var(--bg-hover)", height: 5 }}
        >
          <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)" }} />
        </div>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Q {index + 1}/{questions.length}
        </p>
      </div>

      <p className="text-sm font-medium mb-3">{current.question_text}</p>

      <div className="flex flex-col gap-2">
        {(current.question_options || []).map((opt) => (
          <label
            key={opt.option_id}
            className="p-2 rounded border cursor-pointer"
            style={{
              borderColor:
                answers[current.question_id] === opt.option_id
                  ? "var(--accent)"
                  : "var(--border)",
              background:
                answers[current.question_id] === opt.option_id
                  ? "var(--accent-dim)"
                  : "transparent",
            }}
          >
            <input
              type="radio"
              className="mr-2"
              name={`q-${current.question_id}`}
              checked={answers[current.question_id] === opt.option_id}
              onChange={() =>
                setAnswers((prev) => ({
                  ...prev,
                  [current.question_id]: opt.option_id,
                }))
              }
            />
            {opt.option_text}
          </label>
        ))}
      </div>

      {localError ? (
        <p className="text-xs mt-3" style={{ color: "var(--danger)" }}>
          {localError}
        </p>
      ) : null}

      <div className="mt-4 flex justify-between">
        <button
          className="btn-ghost py-1.5 px-3 text-xs"
          disabled={index === 0}
          onClick={() => setIndex((v) => Math.max(0, v - 1))}
        >
          Previous
        </button>
        <button
          className="btn-primary py-1.5 px-3 text-xs"
          disabled={submitting}
          onClick={() =>
            isLast ? submit() : setIndex((v) => Math.min(questions.length - 1, v + 1))
          }
        >
          {submitting ? <Spinner size={12} /> : isLast ? "Submit" : "Next"}
        </button>
      </div>
    </div>
  );
}
