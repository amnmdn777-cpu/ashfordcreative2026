import React, { type ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react";

interface FooterProps {
  /** Practice or practitioner name shown as the footer heading. */
  name: string;
  credentials?: string;
  /** Practitioner license number (e.g. "TX LCSW 24680"). Appended to the
   *  credentials line with a `·` separator. Required for Texas marketing-
   *  disclosure compliance — every public-facing therapist page must
   *  surface the license. Audit fix from Phase 12 / Commit 1. */
  license?: string;
  phone?: string;
  email?: string;
  /** Address rendered as 1–2 lines. Pass a single string or [line1, line2]. */
  address?: string | [string, string?];
  /** Closing CTA — e.g. <a href="...">Book a consult</a>. */
  cta?: ReactNode;
  /** Slot for SocialRow + any extra rows. */
  social?: ReactNode;
  /** Tail rendered above the copyright row (legal links, "Designed by …"). */
  tail?: ReactNode;
  /** Optional decorative slot for skin chrome. */
  decoration?: ReactNode;
  /** Footer surface variant. `dark` swaps text/bg via theme tokens. */
  tone?: "light" | "dark";
  /** Localized "All rights reserved." string. */
  rightsReserved?: string;
}

export function Footer({
  name,
  credentials,
  license,
  phone,
  email,
  address,
  cta,
  social,
  tail,
  decoration,
  tone = "dark",
  rightsReserved = "All rights reserved.",
}: FooterProps) {
  // Compose credentials + license into a single uppercase-tracked line.
  // Either alone renders fine; both together separator-joined with " · ".
  const credentialsLine = [credentials, license].filter(Boolean).join(" · ");
  const isDark = tone === "dark";
  const bg = isDark ? "var(--color-primary)" : "var(--color-surface)";
  const fg = isDark ? "var(--color-surface)" : "var(--color-text)";
  const muted = isDark ? "rgba(255,255,255,0.6)" : "var(--color-text-muted)";

  const [line1, line2] =
    Array.isArray(address) ? address : [address, undefined];

  return (
    <footer
      className="relative w-full py-16 px-6 md:px-12"
      style={{ backgroundColor: bg, color: fg }}
    >
      {decoration}
      <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-12">
        <div className="flex flex-col gap-3">
          <h3 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            {name}
          </h3>
          {credentialsLine && (
            <div
              className="text-xs uppercase tracking-[0.2em]"
              style={{ color: muted }}
            >
              {credentialsLine}
            </div>
          )}
          {cta && <div className="mt-4">{cta}</div>}
        </div>

        <div className="flex flex-col md:flex-row gap-8 text-sm" style={{ fontFamily: "var(--font-body)" }}>
          {phone && (
            <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-2 hover:opacity-80">
              <Phone className="w-4 h-4" aria-hidden /> {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-2 hover:opacity-80">
              <Mail className="w-4 h-4" aria-hidden /> {email}
            </a>
          )}
          {line1 && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                {line1}
                {line2 && <><br />{line2}</>}
              </span>
            </div>
          )}
        </div>
      </div>

      {social && (
        <div className="relative max-w-6xl mx-auto mt-10 flex justify-center md:justify-start">
          {social}
        </div>
      )}

      <div
        className="relative max-w-6xl mx-auto mt-10 pt-6 text-xs flex flex-col md:flex-row justify-between gap-4"
        style={{ borderTop: `1px solid ${muted}`, color: muted, fontFamily: "var(--font-body)" }}
      >
        <p>© {new Date().getFullYear()} {name}. {rightsReserved}</p>
        {tail}
      </div>
    </footer>
  );
}

export default Footer;
