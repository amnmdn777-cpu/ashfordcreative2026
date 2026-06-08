import { Link } from "wouter";
import { GraduationCap, BookOpen, Clock, ArrowRight } from "lucide-react";
import type { CandidateSession } from "@rep/lib/candidate";

interface Props {
  session: CandidateSession;
  sectionCount: number;
  firstSectionHref: string;
  firstSectionTitle: string;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function CandidateQuizHero({
  session,
  sectionCount,
  firstSectionHref,
  firstSectionTitle,
}: Props) {
  return (
    <section
      data-testid="candidate-quiz-hero"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-xl mb-8 border border-amber-300/20"
    >
      {/* Accent stripe */}
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500" />

      <div className="px-6 md:px-10 py-8 md:py-10">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-300 font-semibold mb-4">
          <GraduationCap size={14} />
          Candidate assessment
        </div>

        <h1 className="font-serif text-3xl md:text-4xl leading-tight mb-4">
          Welcome, {firstName(session.name)}.
        </h1>

        <p className="text-base md:text-lg leading-relaxed text-slate-200 max-w-2xl mb-6">
          <strong className="text-white">This knowledge base is your test.</strong>{" "}
          Read every section below, then take the 5-question quiz so we can
          assess your level and decide on next steps in your hiring.
        </p>

        {/* What to expect strip */}
        <div className="grid sm:grid-cols-3 gap-3 mb-7">
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-300 text-[10px] uppercase tracking-widest font-semibold mb-1">
              <BookOpen size={12} /> Reading
            </div>
            <div className="text-sm text-slate-100">
              ~30–45 minutes across {sectionCount} sections
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-300 text-[10px] uppercase tracking-widest font-semibold mb-1">
              <GraduationCap size={12} /> Quiz
            </div>
            <div className="text-sm text-slate-100">
              5 multiple-choice questions
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-300 text-[10px] uppercase tracking-widest font-semibold mb-1">
              <Clock size={12} /> Total
            </div>
            <div className="text-sm text-slate-100">
              ~5 minutes for the quiz itself
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/candidate/quiz"
            data-testid="candidate-quiz-hero-cta"
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-colors text-sm md:text-base shadow-lg shadow-amber-500/20"
          >
            Take the quiz <ArrowRight size={16} />
          </Link>
          <Link
            href={firstSectionHref}
            data-testid="candidate-quiz-hero-secondary"
            className="inline-flex items-center gap-2 text-amber-200 hover:text-white text-sm font-medium underline-offset-4 hover:underline transition-colors"
          >
            Or start with {firstSectionTitle} →
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-400 max-w-xl">
          You can take your time — your session stays open until you submit.
        </p>
      </div>
    </section>
  );
}
