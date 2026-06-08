import React from "react";
import {
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  type LucideIcon,
} from "lucide-react";

/**
 * Slim social-icon row sourced from `previewContent.socialLinks`.
 * Renders a row of icon links for every non-null platform discovered
 * during enrichment. Templates already render their own footer; this
 * primitive sits just above the portal `<HelpPanel>` and serves as the
 * "real handles we found" confirmation strip.
 */
export interface SocialFooterProps {
  eyebrow: string;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  psychologyToday?: string | null;
  headway?: string | null;
}

// Lucide doesn't ship a TikTok icon — render a small inline glyph.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M19.6 6.7c-1.6-.4-2.9-1.6-3.4-3.2V3h-3.4v13.5c0 1.6-1.3 2.9-2.9 2.9s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9c.3 0 .6 0 .9.1v-3.4c-.3 0-.6-.1-.9-.1-3.5 0-6.3 2.8-6.3 6.3S6.4 22.8 9.9 22.8s6.3-2.8 6.3-6.3V10c1.3.9 2.8 1.4 4.5 1.4V8c-.4 0-.8-.1-1.1-.2v-1.1z" />
    </svg>
  );
}

interface LinkItem {
  href: string;
  label: string;
  Icon: LucideIcon | typeof TikTokIcon;
}

function normalizeHandle(
  value: string,
  baseUrl: string,
  atPrefix = false,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const slug = trimmed.replace(/^@/, "");
  return `${baseUrl}${atPrefix ? "@" : ""}${slug}`;
}

export function SocialFooter(props: SocialFooterProps) {
  const items: LinkItem[] = [];
  if (props.instagram && props.instagram.trim()) {
    items.push({
      href: normalizeHandle(props.instagram, "https://instagram.com/"),
      label: "Instagram",
      Icon: Instagram,
    });
  }
  if (props.facebook && props.facebook.trim()) {
    items.push({
      href: normalizeHandle(props.facebook, "https://facebook.com/"),
      label: "Facebook",
      Icon: Facebook,
    });
  }
  if (props.linkedin && props.linkedin.trim()) {
    items.push({
      href: normalizeHandle(props.linkedin, "https://linkedin.com/in/"),
      label: "LinkedIn",
      Icon: Linkedin,
    });
  }
  if (props.tiktok && props.tiktok.trim()) {
    items.push({
      href: normalizeHandle(props.tiktok, "https://tiktok.com/", true),
      label: "TikTok",
      Icon: TikTokIcon,
    });
  }
  if (props.youtube && props.youtube.trim()) {
    items.push({
      href: normalizeHandle(props.youtube, "https://youtube.com/", true),
      label: "YouTube",
      Icon: Youtube,
    });
  }
  if (props.psychologyToday && props.psychologyToday.trim()) {
    items.push({
      href: normalizeHandle(
        props.psychologyToday,
        "https://www.psychologytoday.com/us/therapists/",
      ),
      label: "Psychology Today",
      Icon: ExternalDot,
    });
  }
  if (props.headway && props.headway.trim()) {
    items.push({
      href: normalizeHandle(
        props.headway,
        "https://headway.co/providers/",
      ),
      label: "Headway",
      Icon: ExternalDot,
    });
  }
  if (items.length === 0) return null;
  return (
    <section
      className="w-full px-6 md:px-12 py-10"
      style={{
        backgroundColor: "var(--color-surface)",
        borderTop:
          "1px solid color-mix(in srgb, var(--color-primary) 12%, transparent)",
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
        <span
          className="text-[11px] uppercase tracking-[0.22em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {props.eyebrow}
        </span>
        <ul className="flex items-center gap-2 flex-wrap">
          {items.map((it) => (
            <li key={it.label}>
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={it.label}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors"
                style={{
                  color: "var(--color-text)",
                  backgroundColor:
                    "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                }}
              >
                <it.Icon className="w-4 h-4" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ExternalDot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

export default SocialFooter;
