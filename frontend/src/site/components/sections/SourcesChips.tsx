import React from "react";
import { BadgeCheck } from "lucide-react";

/**
 * "Pulled in from" / "Visto en" chips — transforms `fieldSources`
 * (the per-field source-attribution map computed by
 * `services/previewContent.ts`) into a deduped list of chips so the
 * prospect sees that every enrichment value above came from a real
 * source (Headway, Psychology Today, Google Places, the prospect's
 * own website, etc.). AI-only values are stripped out.
 */
export interface SourcesChipsProps {
  eyebrow: string;
  title: string;
  /** Map from a normalized source key (e.g. "headway", "google_places")
   *  to the localized label rendered inside the chip. */
  labels: Record<string, string>;
  fieldSources?: Record<string, string>;
}

const AI_SOURCES = new Set([
  "ai",
  "ai_synth",
  "ai_synthesis",
  "ai_rewritten",
  "ai_draft",
  "ai_generated",
  "openai",
  "anthropic",
  "claude",
  "gpt",
]);

function normalizeSource(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function SourcesChips({
  eyebrow,
  title,
  labels,
  fieldSources,
}: SourcesChipsProps) {
  if (!fieldSources) return null;
  // Dedupe and strip AI-only sources.
  const set = new Set<string>();
  for (const raw of Object.values(fieldSources)) {
    if (!raw) continue;
    const norm = normalizeSource(raw);
    if (!norm) continue;
    if (AI_SOURCES.has(norm)) continue;
    set.add(norm);
  }
  const ordered = Array.from(set);
  if (ordered.length === 0) return null;
  return (
    <section
      className="w-full px-6 md:px-12 py-14 md:py-16"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {eyebrow}
          </span>
          <h2
            className="text-2xl md:text-3xl leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text)",
            }}
          >
            {title}
          </h2>
        </div>
        <ul className="flex flex-wrap gap-2">
          {ordered.map((src) => {
            const label = labels[src] ?? prettifySource(src);
            return (
              <li key={src}>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color: "var(--color-text)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <BadgeCheck
                    className="w-3.5 h-3.5"
                    aria-hidden
                    style={{ color: "var(--color-primary)" }}
                  />
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function prettifySource(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default SourcesChips;
