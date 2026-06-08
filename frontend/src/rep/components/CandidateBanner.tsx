import { Link } from "wouter";
import { GraduationCap } from "lucide-react";
import { getCandidateSession } from "@rep/lib/candidate";

export function CandidateBanner() {
  const session = getCandidateSession();
  if (!session) return null;
  return (
    <div className="bg-primary text-primary-foreground px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <GraduationCap size={16} />
          <span>
            Candidate session — <strong>{session.name}</strong>. Read at your own pace, then take the quiz.
          </span>
        </div>
        <Link
          href="/candidate/quiz"
          className="bg-white text-primary px-4 py-1.5 rounded-md text-xs font-semibold hover:bg-white/90 transition-colors"
        >
          Take quiz →
        </Link>
      </div>
    </div>
  );
}
