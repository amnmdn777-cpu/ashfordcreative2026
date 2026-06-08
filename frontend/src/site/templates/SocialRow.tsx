import { Facebook, Instagram, Linkedin, Music2, Youtube, type LucideIcon } from "lucide-react";
import type { TemplateContent } from "./types";

interface SocialRowProps {
  /** Reads `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube`,
   * `psychologyToday`, `headway` handles from the template contact
   * block. Each is optional; only present ones render. */
  contact: TemplateContent["contact"];
  /** Visual variant. `light` is for dark backgrounds, `dark` for light. */
  tone?: "dark" | "light";
  /** Visual size. `compact` is the row used in CTA bands; `inline` is
   * the chip-row used inside the contact card. */
  size?: "inline" | "compact";
  /** Optional pre-label (e.g. "Follow us"). Falls back to nothing. */
  label?: string;
  /** Optional className applied to the outer wrapper for layout overrides. */
  className?: string;
}

interface ResolvedSocial {
  /** Either a Lucide icon (social platforms) or a short wordmark
   * (directories like Psychology Today / Headway, which don't have
   * brand icons in Lucide). */
  Icon?: LucideIcon;
  wordmark?: string;
  label: string;
  href: string;
}

const resolveSocials = (
  contact: TemplateContent["contact"],
): ResolvedSocial[] => {
  const out: ResolvedSocial[] = [];
  const ig = contact.instagram?.trim();
  const fb = contact.facebook?.trim();
  const li = contact.linkedin?.trim();
  const tk = contact.tiktok?.trim();
  const yt = contact.youtube?.trim();
  const pt = contact.psychologyToday?.trim();
  const hw = contact.headway?.trim();
  const toUrl = (raw: string, base: string) => {
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${base}${raw.replace(/^@/, "")}`;
  };
  if (ig) {
    out.push({ Icon: Instagram, label: "Instagram", href: toUrl(ig, "https://instagram.com/") });
  }
  if (fb) {
    out.push({ Icon: Facebook, label: "Facebook", href: toUrl(fb, "https://facebook.com/") });
  }
  if (li) {
    out.push({ Icon: Linkedin, label: "LinkedIn", href: toUrl(li, "https://www.linkedin.com/in/") });
  }
  if (tk) {
    out.push({ Icon: Music2, label: "TikTok", href: toUrl(tk, "https://www.tiktok.com/@") });
  }
  if (yt) {
    out.push({ Icon: Youtube, label: "YouTube", href: toUrl(yt, "https://www.youtube.com/@") });
  }
  if (pt) {
    out.push({
      wordmark: "Psychology Today",
      label: "Psychology Today",
      href: toUrl(pt, "https://www.psychologytoday.com/us/therapists/"),
    });
  }
  if (hw) {
    out.push({
      wordmark: "Headway",
      label: "Headway",
      href: toUrl(hw, "https://headway.co/providers/"),
    });
  }
  return out;
};

/**
 * Renders the practice's social media + directory links as a compact,
 * palette-aware row. Returns `null` when no links are present so callers
 * can drop it into a layout without manually checking.
 *
 * Tone variants and hover states are driven by the `pal-social-light`
 * / `pal-social-dark` utility classes (see `styles/palette.css`); no
 * inline `style={{}}` is required here.
 */
export function SocialRow({
  contact,
  tone = "dark",
  size = "compact",
  label,
  className,
}: SocialRowProps) {
  const socials = resolveSocials(contact);
  if (socials.length === 0) return null;
  const isLight = tone === "light";
  const iconSize = size === "inline" ? "w-4 h-4" : "w-5 h-5";
  const iconPad = size === "inline" ? "px-2.5 py-2" : "px-3 py-2.5";
  const wordPad = size === "inline" ? "px-3 py-1.5" : "px-3.5 py-2";
  const linkClass = isLight ? "pal-social-light" : "pal-social-dark";
  const labelClass = isLight ? "pal-social-label-light" : "pal-social-label-dark";
  return (
    <div className={`flex items-center gap-3 flex-wrap ${className ?? ""}`}>
      {label && (
        <span className={`text-[10px] uppercase tracking-[0.22em] ${labelClass}`}>
          {label}
        </span>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {socials.map(({ Icon, wordmark, label: name, href }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            className={`inline-flex items-center justify-center ${
              Icon ? iconPad : wordPad
            } rounded-full border transition-colors ${linkClass}`}
          >
            {Icon ? (
              <Icon className={iconSize} strokeWidth={1.6} />
            ) : (
              <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                {wordmark}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
