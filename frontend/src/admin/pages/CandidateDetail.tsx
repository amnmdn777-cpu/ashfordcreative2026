import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, Check, X, Trash2, BookOpen, Clock } from "lucide-react";
import { request } from "@admin/lib/api";

interface DetailQuestion {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  source: string;
}
interface ReadingTrailSection {
  key: string;
  title: string;
  msSpent: number;
  firstOpenedAt: string;
}
interface ReadingTrailDto {
  totalKbMs: number;
  sections: ReadingTrailSection[];
  firstOpenedAt: string | null;
  lastSeenAt: string | null;
  quizOpenedAt: string | null;
}
interface CandidateDetailDto {
  id: number;
  name: string;
  score: number;
  totalQuestions: number;
  startedAt: string | null;
  submittedAt: string;
  answers: number[];
  readingTrail: ReadingTrailDto | null;
  questions: DetailQuestion[];
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

function ReadingTrailCard({ trail }: { trail: ReadingTrailDto | null }) {
  if (!trail) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
          <BookOpen size={14} /> Reading trail
        </div>
        <p className="text-sm text-muted-foreground">
          No reading data was captured for this submission. (Older submissions
          predate this signal, or the candidate jumped straight to the quiz.)
        </p>
      </div>
    );
  }

  const sections = [...trail.sections].sort(
    (a, b) => b.msSpent - a.msSpent,
  );
  const sectionsOpened = sections.length;
  const totalMs = trail.totalKbMs;
  const maxMs = sections.reduce((m, s) => Math.max(m, s.msSpent), 0);

  let timeToQuiz: number | null = null;
  if (trail.firstOpenedAt && trail.quizOpenedAt) {
    timeToQuiz =
      new Date(trail.quizOpenedAt).getTime() -
      new Date(trail.firstOpenedAt).getTime();
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <BookOpen size={14} /> Reading trail
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Total KB time
          </div>
          <div className="font-serif text-xl flex items-center gap-1.5">
            <Clock size={14} className="text-muted-foreground" />
            {formatDuration(totalMs)}
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Sections opened
          </div>
          <div className="font-serif text-xl">{sectionsOpened}</div>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            First open → quiz
          </div>
          <div className="font-serif text-xl">
            {timeToQuiz !== null ? formatDuration(timeToQuiz) : "—"}
          </div>
        </div>
      </div>

      {sections.length > 0 ? (
        <ul className="space-y-1.5">
          {sections.map((s) => {
            const pct = maxMs > 0 ? Math.max(4, (s.msSpent / maxMs) * 100) : 0;
            return (
              <li
                key={s.key}
                className="text-sm flex items-center gap-3"
                data-testid={`reading-trail-section-${s.key}`}
              >
                <div className="w-44 shrink-0 truncate" title={s.title}>
                  {s.title}
                </div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-20 text-right tabular-nums text-muted-foreground">
                  {formatDuration(s.msSpent)}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          The candidate didn't open any KB sections before submitting.
        </p>
      )}
    </div>
  );
}

export default function CandidateDetail() {
  const [, params] = useRoute<{ id: string }>("/candidates/:id");
  const [, navigate] = useLocation();
  const [data, setData] = useState<CandidateDetailDto | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const id = params?.id;

  useEffect(() => {
    if (!id) return;
    request<CandidateDetailDto>(`/admin/candidates/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Delete this submission permanently?")) return;
    setDeleting(true);
    try {
      await request(`/admin/candidates/${id}`, { method: "DELETE" });
      navigate("/candidates");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  if (error) {
    return <div className="p-8 text-sm text-destructive">{error}</div>;
  }
  if (!data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const pct = Math.round((data.score / data.totalQuestions) * 100);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link
        href="/candidates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={14} /> All candidates
      </Link>

      <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl mb-1">{data.name}</h1>
            <div className="text-xs text-muted-foreground">
              Submitted {new Date(data.submittedAt).toLocaleString()}
              {data.startedAt && (
                <> · started {new Date(data.startedAt).toLocaleString()}</>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Score</div>
              <div className="font-serif text-3xl leading-none">
                {data.score} <span className="text-muted-foreground text-xl">/ {data.totalQuestions}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{pct}%</div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      <ReadingTrailCard trail={data.readingTrail} />

      <div className="space-y-4">
        {data.questions.map((q, qi) => {
          const picked = data.answers[qi];
          const correct = picked === q.correctIndex;
          return (
            <div
              key={q.id}
              className={`bg-card border rounded-xl p-5 ${
                correct ? "border-emerald-300" : "border-rose-300"
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${
                    correct
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {correct ? <Check size={16} /> : <X size={16} />}
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                    Question {qi + 1} · {q.source}
                  </div>
                  <div className="font-medium leading-snug">{q.prompt}</div>
                </div>
              </div>
              <div className="space-y-1.5 ml-10">
                {q.options.map((opt, oi) => {
                  const isPick = oi === picked;
                  const isCorrect = oi === q.correctIndex;
                  let cls = "border-border bg-background";
                  let badge: string | null = null;
                  if (isCorrect && isPick) {
                    cls = "border-emerald-400 bg-emerald-50";
                    badge = "Their pick · correct";
                  } else if (isCorrect) {
                    cls = "border-emerald-400 bg-emerald-50/60";
                    badge = "Correct answer";
                  } else if (isPick) {
                    cls = "border-rose-400 bg-rose-50";
                    badge = "Their pick";
                  }
                  return (
                    <div
                      key={oi}
                      className={`flex items-start justify-between gap-3 px-3 py-2 rounded-lg border text-sm ${cls}`}
                    >
                      <span className="leading-relaxed">{opt}</span>
                      {badge && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap shrink-0 mt-0.5">
                          {badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
