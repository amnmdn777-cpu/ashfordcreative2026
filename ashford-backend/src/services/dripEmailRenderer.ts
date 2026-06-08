import { env } from "../lib/env";
import type { EmailLocale } from "./emailLayout";

/**
 * Per-touch HTML renderer for the 5-step cold-prospect drip sequence
 * (Day 1, 3, 7, 14, 30).
 *
 * Why a separate renderer instead of `wrapHtmlEmail`:
 *   - `wrapHtmlEmail` is the *generic* envelope used by digests, health
 *     monitors, and customer-onboarding mail. Touching it would force every
 *     non-cold-prospect email into the deep-forest brand treatment, which is
 *     wrong for transactional / customer-facing flows.
 *   - The drip touches use distinct hero treatments (browser chrome, phone
 *     mockup, before/after split) and a unified deep-forest body. Encoding
 *     all of that as conditional branches inside the generic wrapper would
 *     bloat it well past readability.
 *
 * Compatibility notes:
 *   - Layout is table-based with inline styles only — Gmail / Apple Mail /
 *     Outlook web all render reliably. Outlook desktop (MSO) loses
 *     border-radius and gradients but degrades to flat dark-green panels,
 *     which is still on-brand.
 *   - We deliberately do NOT include the "fake inbox header" from the canvas
 *     mockups — the recipient's actual mail client renders that chrome. The
 *     mockup's inbox header was for design-time presentation only.
 */

export type DripTouch = "day1" | "day3" | "day7" | "day14" | "day30";

export type DripContext = {
  touch: DripTouch;
  /** Lead first name (e.g. "Marisol"). */
  leadFirstName: string;
  /** Practice name (e.g. "Crescent Wellness"). */
  practice: string;
  /** Rep first name (e.g. "Sofía"). Drives the gold "S" monogram. */
  repFirstName: string;
  /** Rep full display name for signature ("Sofía Reyes"). */
  repFullName: string;
  /** Locale switches subject + footer + body copy. */
  locale: EmailLocale;
  /** Public, signed CTA URL. Hero image (when present) is wrapped in this. */
  ctaUrl: string;
  /**
   * Public HTTPS URL of the screenshot rendered as the hero. Optional: when
   * absent, the renderer falls back to a brand placeholder so the email never
   * ships with a broken-image icon.
   */
  heroImageUrl?: string;
  /**
   * Day 30 only — a friendly date label like "this Friday at 5pm". Surfaced
   * inside the gold "Draft expires" badge. Falls back to a generic label.
   */
  draftExpiresLabel?: string;
};

export type RenderedDripEmail = {
  subject: string;
  htmlBody: string;
  textBody: string;
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const repInitial = (firstName: string): string =>
  (firstName.trim().charAt(0) || "A").toUpperCase();

/**
 * Validates a candidate hero URL. Returns the URL when it's a usable absolute
 * HTTPS/HTTP URL, otherwise undefined — the caller is expected to render a
 * graceful no-hero variant. We intentionally do NOT substitute a branded
 * placeholder here: shipping a generic "wellness_center" hero to a prospect
 * whose own screenshot capture failed would misrepresent the draft and erode
 * trust. Better to lose the visual flourish than to lie about the artifact.
 */
const validateHeroUrl = (h: string | undefined): string | undefined =>
  h && /^https?:\/\//i.test(h) ? h : undefined;

/** Brand colors lifted from the approved canvas mockups. */
const C = {
  cream: "#F5EDE0",
  panelCream: "#FAFAF5",
  border: "#ECE3D0",
  forest: "#0F2418",
  forestDeep: "#0a140f",
  forestLight: "#142E20",
  forestMid: "#1A3B2A",
  gold: "#C5A56F",
  goldLight: "#E5C893",
  goldDark: "#A88959",
  textCream: "#E8DDC9",
  textMuted: "#B8AE99",
  footerMuted: "#8A8276",
  bodyText: "#6B6557",
} as const;

// ---------------------------------------------------------------------------
// Subjects + signoffs (locale-aware)
// ---------------------------------------------------------------------------

const SUBJECTS: Record<DripTouch, Record<EmailLocale, (l: string) => string>> = {
  day1: {
    // 2026-04-28 — dropped the "bilingual" framing per founder feedback.
    // Patients searching in Spanish are still served (it's in the build),
    // but leading with "bilingual" in the subject reads like a sales hook
    // and doesn't speak to the practitioner's actual frustration. Lead
    // with the deliverable instead: "your draft is ready, take a look."
    en: (n) => `${n}, your new practice site draft is ready`,
    es: (n) => `${n}, el borrador de tu nuevo sitio está listo`,
  },
  day3: {
    en: (n) => `${n} — quick one, did you get a chance to look?`,
    es: (n) => `${n} — un momento, ¿pudiste verla?`,
  },
  day7: {
    en: (n) => `${n}, here's how your site looks on a phone`,
    es: (n) => `${n}, así se ve tu sitio en el móvil`,
  },
  day14: {
    en: (n) => `${n}, side by side — your site today vs the new draft`,
    es: (n) => `${n}, lado a lado — tu sitio actual vs el nuevo borrador`,
  },
  day30: {
    en: (n) => `${n}, last note — closing your draft Friday`,
    es: (n) => `${n}, última nota — cerramos tu borrador el viernes`,
  },
};

const FOOTER_LINES: Record<EmailLocale, { line1: string; unsubscribe: string }> = {
  en: {
    line1: "Sent by Ashford Creative",
    unsubscribe: "Unsubscribe from future updates",
  },
  es: {
    line1: "Enviado por Ashford Creative",
    unsubscribe: "Cancelar la suscripción a futuros mensajes",
  },
};

const TAKE_CARE: Record<EmailLocale, string> = {
  en: "Take care of yourself,",
  es: "Cuídate mucho,",
};

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

/**
 * Returns the `<!DOCTYPE>...</html>` outer scaffold, hosting `inner` inside the
 * cream-bordered card. `panelMaxWidth` lets Day 14's split layout take a
 * slightly wider card without affecting the rest of the sequence.
 */
const wrapDocument = (
  inner: string,
  opts: { lang: EmailLocale; preheader: string; panelMaxWidth?: number },
): string => {
  const lang = opts.lang;
  const footer = FOOTER_LINES[lang];
  const maxWidth = opts.panelMaxWidth ?? 640;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ashford Creative</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${C.cream};line-height:1px;opacity:0;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="${maxWidth}" cellpadding="0" cellspacing="0" border="0" style="max-width:${maxWidth}px;width:100%;background:${C.panelCream};border:1px solid ${C.border};border-radius:18px;overflow:hidden;">
        <tr><td style="padding:0;">
          ${inner}
        </td></tr>
        <tr><td align="center" bgcolor="${C.cream}" style="padding:24px 32px 28px;border-top:1px solid ${C.border};text-align:center;">
          <div style="font-size:11px;color:${C.footerMuted};letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-bottom:10px;">${escapeHtml(footer.line1)}</div>
          <a href="${escapeHtml(env.publicBaseUrl)}/unsubscribe" style="font-size:12px;color:${C.footerMuted};text-decoration:underline;">${escapeHtml(footer.unsubscribe)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/** Logo strip rendered at the top of the deep-forest panel. */
const logoStrip = (): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:36px 0 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="34" height="34" align="center" bgcolor="${C.gold}" style="border-radius:8px;color:${C.forest};font-weight:700;font-size:15px;font-family:Helvetica,Arial,sans-serif;">A</td>
          <td width="10">&nbsp;</td>
          <td valign="middle" style="color:${C.cream};font-weight:600;font-size:14px;letter-spacing:1px;">Ashford Creative</td>
        </tr>
      </table>
    </td></tr>
  </table>`;

/** Signature block (avatar + rep name). */
const signature = (repFirstName: string, repFullName: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="48" height="48" align="center" bgcolor="${C.forest}" style="border-radius:24px;border:2px solid ${C.gold};color:${C.cream};font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;">${escapeHtml(repInitial(repFirstName))}</td>
      <td width="14">&nbsp;</td>
      <td valign="middle" style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
        <div style="color:${C.cream};font-size:15px;font-weight:600;">${escapeHtml(repFullName)}</div>
        <div style="color:${C.textMuted};font-size:13px;margin-top:2px;">Ashford Creative <span style="color:${C.gold};">·</span> Austin, TX</div>
      </td>
    </tr>
  </table>`;

/** Full-width primary CTA pill, cream background on dark panel. */
const primaryCta = (
  url: string,
  label: string,
  variant: "cream" | "gold" = "cream",
): string => {
  const bg = variant === "cream" ? C.cream : C.gold;
  const fg = C.forest;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" bgcolor="${bg}" style="border-radius:12px;">
        <a href="${escapeHtml(url)}" style="display:block;padding:14px 22px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:700;color:${fg};text-decoration:none;border-radius:12px;">${escapeHtml(label)} →</a>
      </td></tr>
    </table>`;
};

// ---------------------------------------------------------------------------
// Touch renderers (produce the "inner" panel — wrapDocument adds the chrome)
// ---------------------------------------------------------------------------

/**
 * Text-only fallback rendered in place of a hero block when screenshot
 * capture is unavailable. Keeps the CTA prominent and the message readable
 * without any broken-image surface area. Cream-on-forest styling matches
 * the rest of the panel.
 */
const heroFallbackPanel = (
  ctaUrl: string,
  ctaLabel: string,
  prompt: string,
): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;margin:0 auto;">
    <tr><td bgcolor="${C.forestLight}" style="border:1px solid rgba(197,165,111,0.25);border-radius:14px;padding:28px 22px;text-align:center;">
      <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:${C.textCream};font-style:italic;">${escapeHtml(prompt)}</p>
      ${primaryCta(ctaUrl, ctaLabel, "cream")}
    </td></tr>
  </table>`;

/** Browser-chrome screenshot tile. Used by Day 1. */
const browserHero = (heroUrl: string, ctaUrl: string, ctaLabel: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;margin:0 auto;">
    <tr><td bgcolor="${C.forestLight}" style="border:1px solid rgba(197,165,111,0.25);border-radius:14px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="${C.forestMid}" style="padding:10px 14px;border-bottom:1px solid rgba(197,165,111,0.15);">
          <span style="display:inline-block;width:9px;height:9px;background:rgba(245,237,224,0.25);border-radius:50%;margin-right:5px;"></span>
          <span style="display:inline-block;width:9px;height:9px;background:rgba(245,237,224,0.25);border-radius:50%;margin-right:5px;"></span>
          <span style="display:inline-block;width:9px;height:9px;background:rgba(245,237,224,0.25);border-radius:50%;"></span>
        </td></tr>
        <tr><td style="padding:0;">
          <a href="${escapeHtml(ctaUrl)}" style="text-decoration:none;display:block;">
            <img src="${escapeHtml(heroUrl)}" width="500" alt="Site preview" style="display:block;width:100%;height:auto;border:0;outline:none;" />
          </a>
        </td></tr>
        <tr><td style="padding:18px 22px 22px;background:${C.forestLight};">
          ${primaryCta(ctaUrl, ctaLabel, "cream")}
        </td></tr>
      </table>
    </td></tr>
  </table>`;

/** Phone-shaped tile. Used by Day 7. */
const phoneHero = (heroUrl: string, ctaUrl: string, ctaLabel: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr><td bgcolor="${C.forestDeep}" style="padding:10px;border-radius:36px;border:1px solid rgba(197,165,111,0.25);">
      <table role="presentation" width="240" cellpadding="0" cellspacing="0" border="0" style="background:${C.forestLight};border-radius:28px;overflow:hidden;">
        <tr><td bgcolor="${C.forest}" style="padding:8px 12px;border-bottom:1px solid rgba(197,165,111,0.1);" align="right">
          <span style="display:inline-block;background:${C.gold};color:${C.forest};font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;">EN</span>
          <span style="display:inline-block;color:${C.textMuted};font-size:9px;font-weight:700;padding:2px 5px;">ES</span>
        </td></tr>
        <tr><td style="padding:0;">
          <a href="${escapeHtml(ctaUrl)}" style="text-decoration:none;display:block;">
            <img src="${escapeHtml(heroUrl)}" width="240" alt="Mobile preview" style="display:block;width:100%;height:auto;border:0;outline:none;" />
          </a>
        </td></tr>
        <tr><td bgcolor="${C.forestLight}" style="padding:14px;">
          ${primaryCta(ctaUrl, ctaLabel, "cream")}
        </td></tr>
      </table>
    </td></tr>
  </table>`;

// ---------------------------------------------------------------------------
// Day 1 — Premium Pitch (full hero with browser chrome + headline)
// ---------------------------------------------------------------------------

const renderDay1 = (ctx: DripContext): RenderedDripEmail => {
  const lang = ctx.locale;
  const subject = SUBJECTS.day1[lang](ctx.leadFirstName);
  const heroUrl = validateHeroUrl(ctx.heroImageUrl);

  // 2026-04-28 — replaced the generic "Engineered for growth" headline.
  // The recipient already knows what we sell; the ONLY question they want
  // answered is "what does it look like?". So lead with their name and
  // the deliverable, and put the practice name in the subhead so they
  // know it's not a template blast.
  const headline =
    lang === "es"
      ? `Tu <span style="color:${C.gold};">borrador</span> está listo, Dr. ${escapeHtml(ctx.leadFirstName)}.`
      : `Your <span style="color:${C.gold};">draft</span> is ready, Dr. ${escapeHtml(ctx.leadFirstName)}.`;

  const subhead =
    lang === "es"
      ? `Construido a mano para ${escapeHtml(ctx.practice)} — toma 30 segundos.`
      : `Hand-built for ${escapeHtml(ctx.practice)} — takes 30 seconds to look.`;

  const ctaLabel =
    lang === "es" ? "Ver mi vista previa" : "View your live preview";

  const heroBlock = heroUrl
    ? browserHero(heroUrl, ctx.ctaUrl, ctaLabel)
    : heroFallbackPanel(
        ctx.ctaUrl,
        ctaLabel,
        lang === "es"
          ? "Tu vista previa personalizada está lista."
          : "Your custom site preview is ready.",
      );

  // 2026-04-28 — rewrote the intro to talk about the THERAPIST's
  // problem (the chore of owning a website + the patient who keeps
  // scrolling past) rather than the bilingual feature. Bilingual is
  // bundled in the build, but we don't lead with it — it reads as
  // a sales hook to a practitioner who's already overworked. Speak
  // to the actual pain instead.
  const intro =
    lang === "es"
      ? `Hola Dr. ${escapeHtml(ctx.leadFirstName)}, pasé las últimas 48 horas dibujando un sitio para ${escapeHtml(ctx.practice)} — usando tu nombre real, tu ciudad, tus modalidades. No es una plantilla genérica: es un borrador hecho para ti, gratis, sin compromiso.`
      : `Hi Dr. ${escapeHtml(ctx.leadFirstName)}, I spent the last 48 hours drafting a site for ${escapeHtml(ctx.practice)} — using your real name, your city, the modalities you actually offer. It's not a generic template: it's a draft built for you, free, no strings attached.`;

  // 2026-04-30 — pulled the "$199/mo all-in" line out of the body. Candice's
  // sales feedback was that prospects read pricing in a cold email as a
  // promotional pitch (and spam filters agree). Pricing lives on the linked
  // preview page; the email's only job is to get the practitioner to look.
  const intro2 =
    lang === "es"
      ? "Échale un vistazo cuando tengas un minuto. Si te gusta lo que ves, hablamos. Si no es para ti, dímelo y lo dejamos ahí — sin presión."
      : "Take a look when you have a minute. If you like what you see, we'll talk. If it's not for you, just say so and we'll leave it there — no pressure.";

  const ps =
    lang === "es"
      ? `"P.D. Si prefieres revisarlo en persona con un café, responde y lo organizamos."`
      : `"P.S. If you'd rather review this over coffee, just reply and let me know."`;

  const inner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.forest}" style="background:${C.forest};">
      <tr><td>${logoStrip()}</td></tr>
      <tr><td align="center" style="padding:0 32px 32px;">
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;color:${C.cream};font-weight:700;letter-spacing:-0.5px;">${headline}</h1>
        <p style="margin:0 auto 32px;max-width:420px;font-size:15px;line-height:1.55;color:${C.textMuted};">${escapeHtml(subhead)}</p>
        ${heroBlock}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
          <tr>
            <td style="color:${C.textCream};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:0 12px;">🌐 ${lang === "es" ? "Bilingüe Nativo" : "Bilingual Native"}</td>
            <td style="color:${C.gold};font-size:11px;padding:0 4px;">·</td>
            <td style="color:${C.textCream};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:0 12px;">🛡 ${lang === "es" ? "Hosting Incluido" : "Managed Hosting"}</td>
            <td style="color:${C.gold};font-size:11px;padding:0 4px;">·</td>
            <td style="color:${C.gold};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;padding:0 12px;">⚡ ${lang === "es" ? "Hecho en Austin" : "Built in Austin"}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:rgba(197,165,111,0.2);"></div></td></tr>
      <tr><td style="padding:36px 40px;max-width:520px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${C.textCream};">${intro}</p>
        <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:${C.textCream};">${escapeHtml(intro2)}</p>
        ${signature(ctx.repFirstName, ctx.repFullName)}
      </td></tr>
      <tr><td bgcolor="${C.cream}" align="center" style="padding:22px 32px 4px;">
        <p style="margin:0;font-size:13px;line-height:1.55;color:${C.bodyText};font-style:italic;max-width:420px;">${escapeHtml(ps)}</p>
      </td></tr>
    </table>`;

  const html = wrapDocument(inner, { lang, preheader: subhead });

  const text = [
    lang === "es"
      ? `Hola Dr. ${ctx.leadFirstName},`
      : `Hi Dr. ${ctx.leadFirstName},`,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    intro2,
    "",
    `${ctaLabel}: ${ctx.ctaUrl}`,
    "",
    `— ${ctx.repFullName}`,
    "Ashford Creative · Austin, TX",
  ].join("\n");

  return { subject, htmlBody: html, textBody: text };
};

// ---------------------------------------------------------------------------
// Day 3 — Soft Tap (thumbnail card + text-link CTA, no big hero)
// ---------------------------------------------------------------------------

const renderDay3 = (ctx: DripContext): RenderedDripEmail => {
  const lang = ctx.locale;
  const subject = SUBJECTS.day3[lang](ctx.leadFirstName);
  const heroUrl = validateHeroUrl(ctx.heroImageUrl);

  const intro =
    lang === "es"
      ? `Hola Dr. ${escapeHtml(ctx.leadFirstName)}, sólo recordándote — el lunes te envié esa vista previa bilingüe para ${escapeHtml(ctx.practice)} y me encantaría tu opinión rápida.`
      : `Hi Dr. ${escapeHtml(ctx.leadFirstName)}, just bumping this up. I sent over that bilingual preview for ${escapeHtml(ctx.practice)} on Monday and would love your quick thoughts.`;

  const close =
    lang === "es"
      ? "Con gusto agendamos una llamada rápida si te resulta más fácil — o ignora este mensaje si simplemente no es el momento."
      : "Happy to jump on a quick call if that's easier, or feel free to ignore if it's just not the right time.";

  const linkLabel =
    lang === "es" ? "Ver tu borrador aquí" : "See your draft here";

  const inner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.forest}" style="background:${C.forest};">
      <tr><td style="padding:40px 40px 32px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${C.textCream};">${intro}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 28px;background:rgba(20,46,32,0.5);border:1px solid rgba(197,165,111,0.15);border-radius:14px;">
          <tr>
            ${heroUrl
              ? `<td width="140" style="padding:14px 0 14px 14px;">
              <a href="${escapeHtml(ctx.ctaUrl)}" style="text-decoration:none;display:block;">
                <table role="presentation" width="120" cellpadding="0" cellspacing="0" border="0" style="background:${C.forestLight};border:1px solid rgba(197,165,111,0.2);border-radius:8px;overflow:hidden;">
                  <tr><td bgcolor="${C.forestMid}" height="14" style="font-size:1px;line-height:14px;">&nbsp;</td></tr>
                  <tr><td><img src="${escapeHtml(heroUrl)}" width="120" alt="Draft thumbnail" style="display:block;width:100%;height:auto;border:0;opacity:0.85;" /></td></tr>
                </table>
              </a>
            </td>`
              : ""}
            <td valign="middle" style="padding:14px 18px;">
              <a href="${escapeHtml(ctx.ctaUrl)}" style="font-size:14px;font-weight:600;color:${C.cream};text-decoration:none;border-bottom:1px solid rgba(197,165,111,0.5);padding-bottom:2px;">${escapeHtml(linkLabel)} →</a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:${C.textCream};">${escapeHtml(close)}</p>

        ${signature(ctx.repFirstName, ctx.repFullName)}
      </td></tr>
    </table>`;

  const html = wrapDocument(inner, { lang, preheader: close });

  const text = [
    lang === "es"
      ? `Hola Dr. ${ctx.leadFirstName},`
      : `Hi Dr. ${ctx.leadFirstName},`,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    `${linkLabel}: ${ctx.ctaUrl}`,
    "",
    close,
    "",
    `— ${ctx.repFullName}`,
  ].join("\n");

  return { subject, htmlBody: html, textBody: text };
};

// ---------------------------------------------------------------------------
// Day 7 — Mobile Angle (phone mockup + 92% headline)
// ---------------------------------------------------------------------------

const renderDay7 = (ctx: DripContext): RenderedDripEmail => {
  const lang = ctx.locale;
  const subject = SUBJECTS.day7[lang](ctx.leadFirstName);
  const heroUrl = validateHeroUrl(ctx.heroImageUrl);

  const headline =
    lang === "es"
      ? `92% de tus pacientes reservan <span style="color:${C.gold};">desde el móvil.</span>`
      : `92% of your patients book <span style="color:${C.gold};">on their phone.</span>`;

  const subhead =
    lang === "es"
      ? `Así se ve ${escapeHtml(ctx.practice)} en la palma de su mano.`
      : `Here is how ${escapeHtml(ctx.practice)} looks in the palm of their hand.`;

  const ctaLabel =
    lang === "es" ? "Abrir vista móvil" : "Open mobile preview";

  const intro =
    lang === "es"
      ? `Hola Dr. ${escapeHtml(ctx.leadFirstName)}, cuando una familia busca un especialista bilingüe, casi siempre lo hace desde el móvil en pequeños momentos del día.`
      : `Hi Dr. ${escapeHtml(ctx.leadFirstName)}, when families look for a bilingual specialist, they're almost always doing it from their phones in small moments of downtime.`;

  const intro2 =
    lang === "es"
      ? `Nos aseguramos de que ${escapeHtml(ctx.practice)} cargue al instante e incluya un toggle EN/ES — un paciente hispanohablante llega a la página correcta y puede llamar con un toque, en lugar de frustrarse y abandonar.`
      : `We made sure ${escapeHtml(ctx.practice)} loads instantly and includes a seamless EN/ES toggle — a Spanish-speaking patient lands on the right page and can tap to call in seconds rather than getting frustrated and bouncing.`;

  const ps =
    lang === "es"
      ? `"P.D. Si abres el enlace en tu móvil real, ves cómo funciona el flujo de admisión."`
      : `"P.S. If you open the link above on your actual phone, you can see how the intake flow works firsthand."`;

  const inner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.forest}" style="background:${C.forest};">
      <tr><td>${logoStrip()}</td></tr>
      <tr><td align="center" style="padding:0 32px 32px;">
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;color:${C.cream};font-weight:700;letter-spacing:-0.5px;">${headline}</h1>
        <p style="margin:0 auto 32px;max-width:420px;font-size:15px;line-height:1.55;color:${C.textMuted};">${subhead}</p>
        ${heroUrl
          ? phoneHero(heroUrl, ctx.ctaUrl, ctaLabel)
          : heroFallbackPanel(
              ctx.ctaUrl,
              ctaLabel,
              lang === "es"
                ? "Abre tu vista previa en el móvil para sentir el flujo real."
                : "Open your preview on your phone to feel the real flow.",
            )}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px auto 0;">
          <tr>
            <td style="color:${C.textCream};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:0 12px;">⚡ ${lang === "es" ? "Carga 3.2s" : "Avg 3.2s load"}</td>
            <td style="color:${C.gold};font-size:11px;padding:0 4px;">·</td>
            <td style="color:${C.textCream};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:0 12px;">🌐 EN/ES</td>
            <td style="color:${C.gold};font-size:11px;padding:0 4px;">·</td>
            <td style="color:${C.textCream};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;padding:0 12px;">📱 ${lang === "es" ? "Llamar al toque" : "Touch-to-call"}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:rgba(197,165,111,0.2);"></div></td></tr>
      <tr><td style="padding:36px 40px;max-width:520px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${C.textCream};">${intro}</p>
        <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:${C.textCream};">${intro2}</p>
        ${signature(ctx.repFirstName, ctx.repFullName)}
      </td></tr>
      <tr><td bgcolor="${C.cream}" align="center" style="padding:22px 32px 4px;">
        <p style="margin:0;font-size:13px;line-height:1.55;color:${C.bodyText};font-style:italic;max-width:420px;">${escapeHtml(ps)}</p>
      </td></tr>
    </table>`;

  const html = wrapDocument(inner, { lang, preheader: subhead.replace(/<[^>]+>/g, "") });

  const text = [
    lang === "es"
      ? `Hola Dr. ${ctx.leadFirstName},`
      : `Hi Dr. ${ctx.leadFirstName},`,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    intro2.replace(/<[^>]+>/g, ""),
    "",
    `${ctaLabel}: ${ctx.ctaUrl}`,
    "",
    `— ${ctx.repFullName}`,
  ].join("\n");

  return { subject, htmlBody: html, textBody: text };
};

// ---------------------------------------------------------------------------
// Day 14 — Before / After (split panel + 10-min CTA)
// ---------------------------------------------------------------------------

/**
 * Old-site placeholder rendered on the left of the Day 14 split. We can't
 * apply CSS filters reliably in email, so we hand-paint a generic 2010-era
 * WordPress aesthetic with muted blues + gray bars. Pairs with the modern
 * preview screenshot on the right to make the gap visceral.
 */
const oldSitePanel = (practice: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E8E8E8" style="background:#E8E8E8;">
    <tr><td bgcolor="#4A5D7A" style="padding:8px 14px;color:#FFFFFF;font-family:Georgia,'Times New Roman',serif;font-size:11px;">${escapeHtml(practice)}</td></tr>
    <tr><td style="padding:14px 14px 12px;">
      <div style="height:8px;width:75%;background:#D0D0D0;border-radius:2px;margin-bottom:8px;"></div>
      <div style="height:6px;width:50%;background:#D0D0D0;border-radius:2px;margin-bottom:14px;"></div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="60" valign="top"><div style="width:54px;height:54px;background:#C4C4C4;border-radius:2px;"></div></td>
          <td valign="top" style="padding-left:8px;">
            <div style="height:5px;width:100%;background:#C4C4C4;border-radius:2px;margin-bottom:5px;"></div>
            <div style="height:5px;width:90%;background:#C4C4C4;border-radius:2px;margin-bottom:5px;"></div>
            <div style="height:5px;width:75%;background:#C4C4C4;border-radius:2px;margin-bottom:5px;"></div>
            <div style="height:5px;width:85%;background:#C4C4C4;border-radius:2px;"></div>
          </td>
        </tr>
      </table>
      <div style="margin-top:14px;padding-top:8px;border-top:1px solid #D0D0D0;">
        <div style="height:5px;width:100%;background:#C4C4C4;border-radius:2px;margin-bottom:5px;"></div>
        <div style="height:5px;width:65%;background:#C4C4C4;border-radius:2px;"></div>
      </div>
    </td></tr>
  </table>`;

const renderDay14 = (ctx: DripContext): RenderedDripEmail => {
  const lang = ctx.locale;
  const subject = SUBJECTS.day14[lang](ctx.leadFirstName);
  const heroUrl = validateHeroUrl(ctx.heroImageUrl);

  const headline =
    lang === "es"
      ? `Vamos a verlos <span style="color:${C.gold};">lado a lado.</span>`
      : `Let's look at them <span style="color:${C.gold};">side by side.</span>`;

  const intro =
    lang === "es"
      ? `Hola Dr. ${escapeHtml(ctx.leadFirstName)}, ya pasaron un par de semanas desde que compartí la vista previa de tu nuevo sitio. Sé que estás ocupada con pacientes, pero quería mostrarte esta comparación lado a lado antes de cerrar el mes.`
      : `Hi Dr. ${escapeHtml(ctx.leadFirstName)}, it's been a couple of weeks since I shared the preview of your new site. I know you're busy with patients, but I wanted to show you this side-by-side comparison before we wrap up the month.`;

  const intro2 =
    lang === "es"
      ? "La diferencia entre tu experiencia móvil actual y la nueva plataforma bilingüe es significativa. Tus pacientes necesitan un sitio que se sienta seguro, profesional y accesible en EN/ES desde el móvil."
      : "The gap between your current mobile experience and the modern, bilingual platform we built is significant. Your patients need a site that feels safe, professional, and accessible in both English and Spanish on their phones.";

  const ctaPrompt =
    lang === "es" ? "¿10 minutos esta semana?" : "10 minutes this week?";
  const ctaLabel =
    lang === "es"
      ? "Reservar llamada de 10 min"
      : "Book a 10-min call this week";
  const ctaCaption =
    lang === "es"
      ? "Sólo una conversación rápida. Después del viernes archivo tu borrador."
      : "Just a quick chat. After this Friday I'll archive your draft.";

  const inner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.forest}" style="background:${C.forest};">
      <tr><td>${logoStrip()}</td></tr>
      <tr><td align="center" style="padding:0 24px 32px;">
        <h1 style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.15;color:${C.cream};font-weight:700;letter-spacing:-0.3px;">${headline}</h1>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:${C.forestLight};border:1px solid rgba(197,165,111,0.15);border-radius:14px;overflow:hidden;">
          <tr><td bgcolor="${C.forestMid}" style="padding:10px 14px;border-bottom:1px solid rgba(197,165,111,0.1);">
            <span style="display:inline-block;width:9px;height:9px;background:rgba(245,237,224,0.25);border-radius:50%;margin-right:5px;"></span>
            <span style="display:inline-block;width:9px;height:9px;background:rgba(245,237,224,0.25);border-radius:50%;margin-right:5px;"></span>
            <span style="display:inline-block;width:9px;height:9px;background:rgba(245,237,224,0.25);border-radius:50%;"></span>
          </td></tr>
          <tr>
            <td width="50%" valign="top" style="position:relative;">
              <div style="background:#dc2626;color:#FFFFFF;font-size:10px;font-weight:700;padding:5px 8px;border-radius:4px;display:inline-block;margin:10px 0 0 10px;">✗ ${lang === "es" ? "TU SITIO HOY" : "YOUR SITE TODAY"}</div>
              ${oldSitePanel(ctx.practice)}
            </td>
            <td width="50%" valign="top" bgcolor="${C.forest}" style="background:${C.forest};position:relative;">
              <div style="text-align:right;padding:10px 10px 0;">
                <span style="background:#4A7C5E;color:#FFFFFF;font-size:10px;font-weight:700;padding:5px 8px;border-radius:4px;display:inline-block;">✓ ${lang === "es" ? "TU NUEVO SITIO" : "YOUR NEW SITE"}</span>
              </div>
              ${heroUrl
                ? `<a href="${escapeHtml(ctx.ctaUrl)}" style="text-decoration:none;display:block;">
                <img src="${escapeHtml(heroUrl)}" width="300" alt="New site preview" style="display:block;width:100%;height:auto;border:0;outline:none;margin-top:6px;" />
              </a>`
                : `<div style="padding:32px 24px;text-align:center;">
                <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:${C.cream};font-style:italic;">${lang === "es" ? "Una plataforma bilingüe rápida y profesional, hecha para tu práctica." : "A fast, bilingual, professional platform — built for your practice."}</p>
                <a href="${escapeHtml(ctx.ctaUrl)}" style="display:inline-block;background:${C.cream};color:${C.forest};padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;">${lang === "es" ? "Ver el borrador" : "Open the draft"} →</a>
              </div>`}
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:rgba(197,165,111,0.2);"></div></td></tr>
      <tr><td style="padding:36px 40px;max-width:540px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${C.textCream};">${intro}</p>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:${C.textCream};">${escapeHtml(intro2)}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.forestLight};border:1px solid rgba(197,165,111,0.2);border-radius:14px;">
          <tr><td align="center" style="padding:24px;">
            <p style="margin:0 0 16px;font-size:15px;color:${C.cream};font-weight:600;">${escapeHtml(ctaPrompt)}</p>
            ${primaryCta(ctx.ctaUrl, `📅 ${ctaLabel}`, "cream")}
            <p style="margin:14px 0 0;font-size:12px;color:${C.textMuted};font-style:italic;">${escapeHtml(ctaCaption)}</p>
          </td></tr>
        </table>

        <div style="margin-top:28px;padding-top:24px;border-top:1px solid rgba(197,165,111,0.1);">
          ${signature(ctx.repFirstName, ctx.repFullName)}
        </div>
      </td></tr>
    </table>`;

  const html = wrapDocument(inner, {
    lang,
    preheader: ctaPrompt,
    panelMaxWidth: 700,
  });

  const text = [
    lang === "es"
      ? `Hola Dr. ${ctx.leadFirstName},`
      : `Hi Dr. ${ctx.leadFirstName},`,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    intro2,
    "",
    `${ctaPrompt} ${ctaLabel}: ${ctx.ctaUrl}`,
    ctaCaption,
    "",
    `— ${ctx.repFullName}`,
  ].join("\n");

  return { subject, htmlBody: html, textBody: text };
};

// ---------------------------------------------------------------------------
// Day 30 — Farewell (small thumbnail + "draft expires Friday" badge)
// ---------------------------------------------------------------------------

const renderDay30 = (ctx: DripContext): RenderedDripEmail => {
  const lang = ctx.locale;
  const subject = SUBJECTS.day30[lang](ctx.leadFirstName);
  const heroUrl = validateHeroUrl(ctx.heroImageUrl);

  const expires =
    ctx.draftExpiresLabel ??
    (lang === "es"
      ? "El borrador expira el viernes a las 5pm"
      : "Draft expires Friday at 5pm");

  const intro =
    lang === "es"
      ? `Hola Dr. ${escapeHtml(ctx.leadFirstName)}, ésta será mi última nota. Te escribo porque archivaremos el borrador que construimos para ${escapeHtml(ctx.practice)} este viernes a las 5pm.`
      : `Hi Dr. ${escapeHtml(ctx.leadFirstName)}, this will be my last note. I'm reaching out because we'll be archiving the draft site we built for ${escapeHtml(ctx.practice)} this Friday at 5pm.`;

  const intro2 =
    lang === "es"
      ? "Sé lo ocupada que puede ser una práctica bilingüe, así que entiendo perfectamente si simplemente no era el momento adecuado para una nueva presencia digital. Te deseo lo mejor con tu trabajo — la labor que haces para tu comunidad es muy importante."
      : "I know how busy running a bilingual practice can be, so I completely understand if timing just wasn't right for a new digital presence. I truly wish you the best with your practice — the work you're doing for your community is so important.";

  const closeLink =
    lang === "es"
      ? "Abrir tu borrador una última vez"
      : "Open your draft one more time";

  const closing =
    lang === "es"
      ? "Si las cosas cambian y quieres retomar esto, siempre tendrás mi correo."
      : "If things ever change and you want to revisit this, you'll always have my email.";

  const inner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.forest}" style="background:${C.forest};">
      <tr><td style="padding:48px 40px 32px;max-width:520px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${C.textCream};">${intro}</p>
        <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:${C.textCream};">${escapeHtml(intro2)}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="padding:8px 0;">
            ${heroUrl
              ? `<a href="${escapeHtml(ctx.ctaUrl)}" style="text-decoration:none;display:inline-block;">
              <table role="presentation" width="200" cellpadding="0" cellspacing="0" border="0" style="background:${C.forestLight};border:1px solid rgba(197,165,111,0.2);border-radius:10px;overflow:hidden;">
                <tr><td><img src="${escapeHtml(heroUrl)}" width="200" alt="Draft preview" style="display:block;width:100%;height:auto;border:0;outline:none;" /></td></tr>
              </table>
            </a>`
              : ""}
            <div style="margin:${heroUrl ? "18px" : "8px"} 0 8px;">
              <span style="display:inline-block;background:${C.forestLight};border:1px solid rgba(197,165,111,0.3);color:${C.gold};font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:7px 14px;border-radius:999px;">⏱ ${escapeHtml(expires)}</span>
            </div>
            <a href="${escapeHtml(ctx.ctaUrl)}" style="display:inline-block;font-size:14px;color:${C.gold};font-weight:600;text-decoration:none;margin-top:8px;">${escapeHtml(closeLink)} →</a>
          </td></tr>
        </table>

        <p style="margin:32px 0 32px;font-size:15px;line-height:1.7;color:${C.textCream};">${escapeHtml(closing)}</p>

        <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:22px;color:${C.gold};margin-bottom:8px;">${escapeHtml(TAKE_CARE[lang])}</div>
        <div style="color:${C.cream};font-size:15px;font-weight:600;">${escapeHtml(ctx.repFullName)}</div>
        <div style="color:${C.textMuted};font-size:13px;margin-top:2px;">Ashford Creative</div>
      </td></tr>
    </table>`;

  const html = wrapDocument(inner, { lang, preheader: expires });

  const text = [
    lang === "es"
      ? `Hola Dr. ${ctx.leadFirstName},`
      : `Hi Dr. ${ctx.leadFirstName},`,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    intro2,
    "",
    `${expires}.`,
    `${closeLink}: ${ctx.ctaUrl}`,
    "",
    closing,
    "",
    `${TAKE_CARE[lang]}`,
    ctx.repFullName,
    "Ashford Creative",
  ].join("\n");

  return { subject, htmlBody: html, textBody: text };
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export const renderDripEmail = (ctx: DripContext): RenderedDripEmail => {
  switch (ctx.touch) {
    case "day1":
      return renderDay1(ctx);
    case "day3":
      return renderDay3(ctx);
    case "day7":
      return renderDay7(ctx);
    case "day14":
      return renderDay14(ctx);
    case "day30":
      return renderDay30(ctx);
  }
};
