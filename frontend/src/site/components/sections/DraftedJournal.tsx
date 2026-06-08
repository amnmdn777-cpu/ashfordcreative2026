import React from "react";
import { BookOpen, Sparkles } from "lucide-react";

/**
 * "Insights, in your voice" preview band. Renders the three AI-drafted
 * blog posts produced by `services/previewContent.ts`
 * (`draftedJournalEntries`) so the prospect sees real launch-day
 * content waiting on their site. Title + excerpt + reading time only;
 * the body lives behind a "draft ready" implicit promise — we don't
 * render the full body in the portal preview.
 */
export interface DraftedJournalEntry {
  title: string;
  slug: string;
  excerpt: string;
  readingMinutes: number;
}

export interface DraftedJournalProps {
  eyebrow: string;
  title: string;
  readingLabelTemplate: string; // e.g. "{n}-min read"
  entries: DraftedJournalEntry[];
  /** Cap rendered count (default 3). */
  max?: number;
}

export function DraftedJournal({
  eyebrow,
  title,
  readingLabelTemplate,
  entries,
  max = 3,
}: DraftedJournalProps) {
  if (!entries || entries.length === 0) return null;
  const shown = entries.slice(0, max);
  return (
    <section
      className="w-full px-6 md:px-12 py-20 md:py-24"
      style={{
        backgroundColor: "var(--color-surface-soft, var(--color-surface))",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles
            className="w-4 h-4"
            aria-hidden
            style={{ color: "var(--color-primary)" }}
          />
          <span
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {eyebrow}
          </span>
        </div>
        <h2
          className="text-3xl md:text-4xl leading-tight mb-10"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          {title}
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {shown.map((e) => (
            <article
              key={e.slug}
              className="p-6 flex flex-col gap-3"
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-md, 12px)",
                boxShadow:
                  "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))",
              }}
            >
              <BookOpen
                className="w-4 h-4 opacity-50"
                aria-hidden
                style={{ color: "var(--color-primary)" }}
              />
              <h3
                className="text-lg leading-snug"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text)",
                }}
              >
                {e.title}
              </h3>
              <p
                className="text-sm leading-relaxed flex-1"
                style={{
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {e.excerpt}
              </p>
              <span
                className="text-[10px] uppercase tracking-[0.2em] mt-auto"
                style={{ color: "var(--color-text-muted)" }}
              >
                {readingLabelTemplate.replace(
                  "{n}",
                  String(e.readingMinutes),
                )}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DraftedJournal;
