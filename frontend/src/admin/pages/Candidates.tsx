import { useEffect, useState } from "react";
import { Link } from "wouter";
import { GraduationCap, ChevronRight } from "lucide-react";
import { request } from "@admin/lib/api";

interface CandidateRow {
  id: number;
  name: string;
  score: number;
  totalQuestions: number;
  submittedAt: string;
  startedAt: string | null;
}

export default function Candidates() {
  const [rows, setRows] = useState<CandidateRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<{ submissions: CandidateRow[] }>("/admin/candidates")
      .then((r) => setRows(r.submissions))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
          <GraduationCap size={20} />
        </div>
        <div>
          <h1 className="font-serif text-2xl">Candidate quiz submissions</h1>
          <p className="text-sm text-muted-foreground">
            Hiring candidates who completed the knowledge-base quiz at <span className="font-mono">/sales/candidate</span>.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 text-sm text-destructive">{error}</div>
      )}

      {!rows ? (
        <div className="mt-8 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="mt-10 bg-card border border-card-border rounded-xl p-8 text-center">
          <div className="font-serif text-lg mb-1">No submissions yet</div>
          <p className="text-sm text-muted-foreground">
            Share the candidate link to collect submissions.
          </p>
        </div>
      ) : (
        <div className="mt-6 bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = Math.round((r.score / r.totalQuestions) * 100);
                const tone =
                  pct >= 80
                    ? "text-emerald-700 bg-emerald-100"
                    : pct >= 60
                      ? "text-amber-700 bg-amber-100"
                      : "text-rose-700 bg-rose-100";
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${tone}`}>
                        {r.score} / {r.totalQuestions}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/candidates/${r.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                      >
                        Review <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
