import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { request } from "@rep/lib/api";
import { getCandidateSession, clearCandidateSession } from "@rep/lib/candidate";
import {
  markQuizOpened,
  getKbReadingTrail,
  clearKbReadingTrail,
} from "@rep/lib/kbReadingTrail";

interface PublicQuestion {
  id: number;
  prompt: string;
  options: string[];
  source: string;
}
interface QuestionsResponse {
  totalQuestions: number;
  questions: PublicQuestion[];
}
interface SubmitResponse {
  id: number;
  score: number;
  totalQuestions: number;
}

export default function CandidateQuiz() {
  const [, navigate] = useLocation();
  const [questions, setQuestions] = useState<PublicQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResponse | null>(null);

  useEffect(() => {
    const session = getCandidateSession();
    if (!session) {
      navigate("/candidate");
      return;
    }
    markQuizOpened();
    request<QuestionsResponse>("/public/candidate-quiz/questions")
      .then((r) => setQuestions(r.questions))
      .catch(() => setError("Could not load the quiz. Please refresh."));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questions) return;
    const session = getCandidateSession();
    if (!session) {
      navigate("/candidate");
      return;
    }
    if (Object.keys(answers).length !== questions.length) {
      setError("Please answer every question before submitting.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const ordered = questions.map((q) => answers[q.id]);
      const readingTrail = getKbReadingTrail();
      const r = await request<SubmitResponse>(
        "/public/candidate-quiz/submissions",
        {
          method: "POST",
          body: JSON.stringify({
            name: session.name,
            answers: ordered,
            startedAt: session.startedAt,
            readingTrail,
          }),
        },
      );
      setResult(r);
      clearCandidateSession();
      clearKbReadingTrail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="bg-card border border-card-border rounded-xl p-8 w-full max-w-md shadow-sm text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-4">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="font-serif text-2xl mb-2">Submitted — thank you!</h1>
          <p className="text-sm text-muted-foreground mb-5">
            We received your answers. The hiring team will review them and reach out shortly.
          </p>
          <div className="bg-muted/40 rounded-lg px-4 py-3 mb-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Your score</div>
            <div className="text-3xl font-serif">
              {result.score} <span className="text-muted-foreground">/ {result.totalQuestions}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">You can close this tab now.</p>
        </div>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-muted-foreground text-sm">{error || "Loading quiz…"}</div>
      </div>
    );
  }

  const session = getCandidateSession();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <div className="font-serif text-3xl mb-1">Knowledge Base Quiz</div>
          <div className="text-xs uppercase tracking-widest text-primary mb-2">
            5 questions · multiple choice
          </div>
          {session && (
            <p className="text-sm text-muted-foreground">
              Submitting as <strong>{session.name}</strong>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {questions.map((q, qi) => (
            <fieldset
              key={q.id}
              className="bg-card border border-card-border rounded-xl p-5"
            >
              <legend className="text-xs uppercase tracking-widest text-primary mb-2 px-1">
                Question {qi + 1} · from {q.source}
              </legend>
              <div className="font-medium mb-4 leading-snug">{q.prompt}</div>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const checked = answers[q.id] === oi;
                  return (
                    <label
                      key={oi}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={oi}
                        checked={checked}
                        onChange={() =>
                          setAnswers((a) => ({ ...a, [q.id]: oi }))
                        }
                        className="mt-1"
                      />
                      <span className="text-sm leading-relaxed">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit answers"}
          </button>
        </form>
      </div>
    </div>
  );
}
