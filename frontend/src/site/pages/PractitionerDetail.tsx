import * as React from "react";
import { Link, useParams } from "wouter";
import {
  TEMPLATES,
  PALETTES,
  TIERS,
  CAPABILITIES,
  type PaletteDef,
  type TemplateKey,
} from "@workspace/api-zod";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";
import { SAMPLES } from "@site/templates/sampleContent";
import { resolveTemplateKey } from "@site/templates";
import { cssVarsForPalette } from "@site/lib/palette";
import { CrisisFooter } from "@site/templates/CrisisFooter";
import type { TeamMember, TemplateContent } from "@site/templates/types";
import { ArrowLeft, Mail, Phone, ShieldAlert, Check } from "lucide-react";

// Spanish labels for the 7 Boutique foundation capabilities — kept local
// so this surface stays self-contained. Catalog-canonical English labels
// live in `CAPABILITIES[key].label`.
const FOUNDATION_LABELS_ES: Record<string, string> = {
  spanish_translation: "Traducción al español",
  crisis_hotline_button: "Botón de crisis 988",
  office_tour: "Tour fotográfico de la oficina",
  google_business_presence: "Presencia en Google Business",
  daily_schedule_digest: "Resumen diario de la agenda",
  social_row: "Pie de redes sociales",
  insurance_sliding_scale: "Distintivo de seguro y tarifa móvil",
};

/** Per-practitioner sub-page; styled to match the active template. */
export default function PractitionerDetail() {
  const params = useParams<{ templateKey: string; practitionerSlug: string }>();
  return (
    <PractitionerDetailView
      templateKey={params.templateKey ?? ""}
      practitionerSlug={params.practitionerSlug ?? ""}
      includeSeo
    />
  );
}

/**
 * Reusable practitioner-detail render. Used both by the public route and
 * by the prospect preview shell — the preview passes `onBack` so the
 * back affordance returns to the preview instead of navigating away.
 */
export function PractitionerDetailView({
  templateKey,
  practitionerSlug,
  onBack,
  includeSeo = false,
}: {
  templateKey: string;
  practitionerSlug: string;
  onBack?: () => void;
  includeSeo?: boolean;
}) {
  const { locale } = useI18n();

  const resolvedKey = resolveTemplateKey(templateKey);
  const tpl = resolvedKey ? TEMPLATES[resolvedKey] : undefined;

  const candidateContents = (() => {
    if (!tpl) return [];
    const base = SAMPLES[tpl.key as keyof typeof SAMPLES];
    return base ? [base] : [];
  })();

  const matchedContent = candidateContents.find((c) =>
    c.team.some((m) => m.slug === practitionerSlug),
  );
  const member = matchedContent?.team.find((m) => m.slug === practitionerSlug);

  if (!tpl || !matchedContent || !member) {
    return (
      <div className="px-6 py-32 text-center">
        <p className="font-display text-2xl text-ink mb-4">
          {locale === "es" ? "Clínico no encontrado." : "Practitioner not found."}
        </p>
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sage underline">
            ← {locale === "es" ? "Volver a la plantilla" : "Back to template"}
          </button>
        ) : (
          <Link href={`/template/${templateKey}`} className="text-sage underline">
            ← {locale === "es" ? "Volver a la plantilla" : "Back to template"}
          </Link>
        )}
      </div>
    );
  }

  const palette: PaletteDef = PALETTES[tpl.paletteKeys[0]!]!;
  const tplKey = tpl.key as TemplateKey;
  const Skin = SKINS[tplKey] ?? SKINS.garden;

  // Phase 1B-c: bandeau replaced with a static "in every Ashford site"
  // foundation-feature strip. The previous IncludedBandeau +
  // AddonPreviewDrawer combo (bundled-vs-paid split) is gone with the
  // tier migration — the public practitioner page now shows the 7
  // capabilities every tier ships with, no clickable preview drawer.
  const foundationLabels = TIERS.boutique.capabilities.map((key) => ({
    key,
    label:
      locale === "es"
        ? FOUNDATION_LABELS_ES[key] ?? CAPABILITIES[key].label
        : CAPABILITIES[key].label,
  }));

  const bandeau = foundationLabels.length > 0 ? (
    <section
      className="px-6 lg:px-12 py-10 border-t"
      style={{
        borderColor: "color-mix(in srgb, var(--p-ink) 12%, transparent)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
          style={{ color: "color-mix(in srgb, var(--p-ink) 60%, transparent)" }}
        >
          {locale === "es"
            ? "Incluido en todos los niveles"
            : "Included in every tier"}
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {foundationLabels.map((f) => (
            <li
              key={f.key}
              className="flex gap-2 items-start text-[14px]"
              style={{ color: "color-mix(in srgb, var(--p-ink) 80%, transparent)" }}
            >
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-sage" strokeWidth={2.5} />
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  ) : null;

  return (
    <>
      {includeSeo && (
        <Seo
          title={`${member.name} — ${matchedContent.practiceName}`}
          description={member.bio}
          path={`/templates/${tplKey}/practitioner/${member.slug}`}
        />
      )}
      <Skin
        member={member}
        content={matchedContent}
        palette={palette}
        templateKey={tplKey}
        locale={locale}
        onBack={onBack}
        bandeau={bandeau}
      />
    </>
  );
}

/**
 * Either a wouter Link back to the template page (public site) or a
 * button that calls onBack (prospect preview shell). Visual styling is
 * passed through unchanged so each skin's back affordance keeps its look.
 */
function BackControl({
  templateKey,
  onBack,
  className,
  style,
  children,
}: {
  templateKey: TemplateKey;
  onBack?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (onBack) {
    return (
      <button type="button" onClick={onBack} className={className} style={style}>
        {children}
      </button>
    );
  }
  return (
    <Link href={`/template/${templateKey}`} className={className} style={style}>
      {children}
    </Link>
  );
}

/* ─────────────────────────── Per-template skins ─────────────────────────── */

interface SkinProps {
  member: TeamMember;
  content: TemplateContent;
  palette: PaletteDef;
  templateKey: TemplateKey;
  locale: "en" | "es";
  onBack?: () => void;
  /** Optional "Also included / Could be added" bandeau rendered just
   * above the CrisisFooter so the prospect on the public showcase sees
   * the same bundled-value strip as a custom prospect portal (#221). */
  bandeau?: React.ReactNode;
}

const backLabel = (locale: "en" | "es") => (locale === "es" ? "Volver a" : "Back to");
const aboutLabel = (locale: "en" | "es") => (locale === "es" ? "Sobre mi trabajo" : "About my work");
const reachLabel = (locale: "en" | "es") => (locale === "es" ? "¿Listo para hablar?" : "Ready to reach out?");
const reachDesc = (locale: "en" | "es", practice: string) =>
  locale === "es"
    ? `Contacta a ${practice} para programar una consulta.`
    : `Contact ${practice} to schedule a consultation.`;
const practitionerLabel = (locale: "en" | "es") => (locale === "es" ? "Clínico" : "Practitioner");

function ContactBlock({ content, palette, locale, accent = "primary" }: { content: TemplateContent; palette: PaletteDef; locale: "en" | "es"; accent?: "primary" | "ink" }) {
  const bg = accent === "ink" ? "var(--p-ink)" : "var(--p-primary)";
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <a href={`tel:${content.contact.phone}`} className="inline-flex items-center gap-2 px-6 py-3 rounded-sm text-sm font-medium" style={{ background: bg, color: "var(--p-surface)" }}>
        <Phone className="w-4 h-4" /> {content.contact.phone}
      </a>
      <a href={`mailto:${content.contact.email}`} className="inline-flex items-center gap-2 px-6 py-3 rounded-sm text-sm font-medium border" style={{ borderColor: bg, color: bg }}>
        <Mail className="w-4 h-4" /> {content.contact.email}
      </a>
    </div>
  );
}

function DisclaimerBox({ disclaimer }: { disclaimer: string }) {
  return (
    <div className="mt-12 p-5 rounded-sm border flex items-start gap-3" style={{ borderColor: "color-mix(in srgb, var(--p-primary) 25%, transparent)", background: "color-mix(in srgb, var(--p-primary) 6%, transparent)" }}>
      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--p-primary)" }} />
      <div className="text-sm leading-relaxed" style={{ color: "var(--p-ink)" }}>{disclaimer}</div>
    </div>
  );
}

/* ── Warm Minimalist skin: quiet editorial, beige paper, Fraunces serif ── */
function WarmMinimalistSkin({ member, content, palette, templateKey, locale, onBack, bandeau }: SkinProps) {
  const longBio = member.longBio?.length ? member.longBio : [member.bio];
  return (
    <div className="font-sans" style={{ ...cssVarsForPalette(palette), background: "var(--p-surface)", color: "var(--p-ink)" }}>
      <style>{`.pd-serif{font-family:'Fraunces', Georgia, serif;font-feature-settings:'ss01';}`}</style>
      <div className="px-6 lg:px-12 pt-10 pb-6">
        <div className="max-w-5xl mx-auto">
          <BackControl templateKey={templateKey} onBack={onBack} className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase" style={{ color: "var(--p-primary)" }}>
            <ArrowLeft className="w-3 h-3" /> {backLabel(locale)} {content.practiceName}
          </BackControl>
        </div>
      </div>
      <section className="px-6 lg:px-12 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <div className="aspect-[4/5] overflow-hidden rounded-sm" style={{ background: "color-mix(in srgb, var(--p-ink) 8%, transparent)" }}>
              <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="md:col-span-7 md:pt-4">
            <div className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{ color: "var(--p-primary)" }}>{practitionerLabel(locale)} · {content.practiceName}</div>
            <h1 className="pd-serif text-[44px] md:text-[60px] leading-[1.05] mb-3 tracking-tight">{member.name}</h1>
            <div className="text-sm tracking-widest uppercase mb-6" style={{ color: "var(--p-primary)" }}>{member.credentials}{member.pronouns ? ` · ${member.pronouns}` : ""}</div>
            <ChipRow items={member.modalities} variant="outline" />
            {member.identities && member.identities.length > 0 && <ChipRow items={member.identities} variant="filled" />}
          </div>
        </div>
      </section>
      <section className="px-6 lg:px-12 py-16 border-t" style={{ borderColor: "color-mix(in srgb, var(--p-ink) 12%, transparent)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] tracking-[0.3em] uppercase mb-8" style={{ color: "var(--p-primary)" }}>{aboutLabel(locale)}</div>
          <div className="pd-serif space-y-6 text-[19px] md:text-[21px] leading-[1.55]">
            {longBio.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {member.disclaimer && <DisclaimerBox disclaimer={member.disclaimer} />}
        </div>
      </section>
      <section className="px-6 lg:px-12 py-20 border-t text-center" style={{ borderColor: "color-mix(in srgb, var(--p-ink) 12%, transparent)" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="pd-serif text-3xl md:text-4xl mb-4 tracking-tight">{reachLabel(locale)}</h2>
          <p className="text-base mb-8" style={{ color: "var(--p-muted)" }}>{reachDesc(locale, content.practiceName)}</p>
          <ContactBlock content={content} palette={palette} locale={locale} />
        </div>
      </section>
      {bandeau}
      <CrisisFooter content={content} />
    </div>
  );
}

/* ── Bold Editorial skin: magazine masthead, big display type, hard rules ── */
function BoldEditorialSkin({ member, content, palette, templateKey, locale, onBack }: SkinProps) {
  const longBio = member.longBio?.length ? member.longBio : [member.bio];
  return (
    <div className="font-sans" style={{ ...cssVarsForPalette(palette), background: "var(--p-surface)", color: "var(--p-ink)" }}>
      <style>{`.be-display{font-family:'Fraunces', Georgia, serif;font-weight:700;letter-spacing:-0.025em;font-feature-settings:'ss01';}`}</style>
      <header className="px-6 lg:px-12 py-6 border-b-[3px] flex items-center justify-between" style={{ borderColor: "var(--p-primary)" }}>
        <BackControl templateKey={templateKey} onBack={onBack} className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase font-bold" style={{ color: "var(--p-primary)" }}>
          <ArrowLeft className="w-3 h-3" /> {content.practiceName}
        </BackControl>
        <div className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "var(--p-muted)" }}>
          The Contributor File · {member.credentials}
        </div>
      </header>
      <section className="px-6 lg:px-12 py-16 md:py-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <div className="text-[11px] tracking-[0.3em] uppercase mb-6 inline-block px-2 py-1" style={{ background: "var(--p-primary)", color: "var(--p-surface)" }}>
              {practitionerLabel(locale)}
            </div>
            <h1 className="be-display text-[56px] md:text-[88px] lg:text-[110px] leading-[0.92] mb-6">
              {member.name}
            </h1>
            <div className="text-base font-medium mb-6" style={{ color: "var(--p-primary)" }}>
              {member.credentials}{member.pronouns ? ` · ${member.pronouns}` : ""}
            </div>
            <ChipRow items={member.modalities} variant="outline" />
            {member.identities && member.identities.length > 0 && <ChipRow items={member.identities} variant="filled" />}
          </div>
          <div className="lg:col-span-5 lg:pl-6">
            <div className="aspect-[3/4] overflow-hidden">
              <img src={member.photo} alt={member.name} className="w-full h-full object-cover grayscale-[15%]" />
            </div>
          </div>
        </div>
      </section>
      <section className="px-6 lg:px-12 py-20 border-t-[3px]" style={{ borderColor: "var(--p-primary)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-[11px] tracking-[0.3em] uppercase mb-8" style={{ color: "var(--p-primary)" }}>{aboutLabel(locale)}</div>
          <div className="space-y-6 text-lg md:text-xl leading-[1.55]">
            {longBio.map((p, i) => (
              <p key={i} className={i === 0 ? "be-display text-3xl md:text-4xl !leading-[1.2]" : ""}>{p}</p>
            ))}
          </div>
          {member.disclaimer && <DisclaimerBox disclaimer={member.disclaimer} />}
        </div>
      </section>
      <section className="px-6 lg:px-12 py-24 border-t-[3px] text-center" style={{ borderColor: "var(--p-primary)" }}>
        <h2 className="be-display text-4xl md:text-6xl mb-6">{reachLabel(locale)}</h2>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--p-muted)" }}>{reachDesc(locale, content.practiceName)}</p>
        <ContactBlock content={content} palette={palette} locale={locale} accent="ink" />
      </section>
      <CrisisFooter content={content} />
    </div>
  );
}

/* ── Photo Overlay skin: full-bleed portrait + serif overlay ── */
function PhotoOverlaySkin({ member, content, palette, templateKey, locale, onBack }: SkinProps) {
  const longBio = member.longBio?.length ? member.longBio : [member.bio];
  return (
    <div className="font-sans" style={{ ...cssVarsForPalette(palette), background: "var(--p-surface)", color: "var(--p-ink)" }}>
      <style>{`.po-serif{font-family:'Fraunces', Georgia, serif;font-feature-settings:'ss01';}`}</style>

      {/* Full-bleed practitioner portrait hero */}
      <section className="relative h-[80svh] min-h-[560px] overflow-hidden" style={{ background: "var(--p-ink)" }}>
        <img src={member.photo} alt={member.name} className="absolute inset-0 w-full h-full object-cover opacity-90" style={{ objectPosition: "center 20%" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--p-ink) 45%, transparent) 0%, color-mix(in srgb, var(--p-ink) 0%, transparent) 35%, color-mix(in srgb, var(--p-ink) 75%, transparent) 100%)" }} />

        <div className="absolute top-0 left-0 right-0 z-10 px-6 lg:px-12 pt-10 flex justify-between items-center">
          <BackControl templateKey={templateKey} onBack={onBack} className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase" style={{ color: "var(--p-surface)" }}>
            <ArrowLeft className="w-3 h-3" /> {content.practiceName}
          </BackControl>
          <a href={`tel:${content.contact.phone}`} className="text-xs tracking-[0.2em] uppercase px-4 py-2 rounded-sm" style={{ background: "var(--p-surface)", color: "var(--p-ink)" }}>
            {content.contact.phone}
          </a>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-6 lg:px-12 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{ color: "var(--p-surface)", opacity: 0.85 }}>{practitionerLabel(locale)}</div>
            <h1 className="po-serif text-[48px] md:text-[80px] lg:text-[96px] leading-[1.0] tracking-tight mb-3" style={{ color: "var(--p-surface)" }}>
              {member.name}
            </h1>
            <div className="text-sm tracking-widest uppercase" style={{ color: "var(--p-surface)", opacity: 0.85 }}>
              {member.credentials}{member.pronouns ? ` · ${member.pronouns}` : ""}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto">
          <ChipRow items={member.modalities} variant="outline" />
          {member.identities && member.identities.length > 0 && <ChipRow items={member.identities} variant="filled" />}
        </div>
      </section>

      <section className="px-6 lg:px-12 pb-20" style={{ background: "color-mix(in srgb, var(--p-primary) 6%, var(--p-surface))" }}>
        <div className="max-w-3xl mx-auto pt-16">
          <div className="text-[11px] tracking-[0.3em] uppercase mb-8" style={{ color: "var(--p-primary)" }}>{aboutLabel(locale)}</div>
          <div className="po-serif space-y-6 text-[19px] md:text-[22px] leading-[1.55]">
            {longBio.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {member.disclaimer && <DisclaimerBox disclaimer={member.disclaimer} />}
        </div>
      </section>

      <section className="px-6 lg:px-12 py-20 text-center">
        <h2 className="po-serif text-3xl md:text-5xl mb-4 tracking-tight">{reachLabel(locale)}</h2>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--p-muted)" }}>{reachDesc(locale, content.practiceName)}</p>
        <ContactBlock content={content} palette={palette} locale={locale} />
      </section>

      <CrisisFooter content={content} />
    </div>
  );
}

/* ── Wellness Center skin: friendly rounded healthcare layout ── */
function WellnessCenterSkin({ member, content, palette, templateKey, locale, onBack }: SkinProps) {
  const longBio = member.longBio?.length ? member.longBio : [member.bio];
  return (
    <div className="font-sans" style={{ ...cssVarsForPalette(palette), background: "var(--p-surface)", color: "var(--p-ink)" }}>
      <header className="sticky top-0 z-30 backdrop-blur-md border-b" style={{ background: "color-mix(in srgb, var(--p-surface) 92%, transparent)", borderColor: "color-mix(in srgb, var(--p-ink) 8%, transparent)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <BackControl templateKey={templateKey} onBack={onBack} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--p-primary)" }}>
            <ArrowLeft className="w-4 h-4" /> {content.practiceName}
          </BackControl>
          <a href={`tel:${content.contact.phone}`} className="text-sm font-medium px-5 py-2.5 rounded-full" style={{ background: "var(--p-primary)", color: "var(--p-surface)" }}>
            {content.contact.phone}
          </a>
        </div>
      </header>

      <section className="px-6 lg:px-12 py-16 md:py-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="aspect-square overflow-hidden rounded-3xl">
              <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full mb-5 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--p-primary) 15%, transparent)", color: "var(--p-primary)" }}>
              {practitionerLabel(locale)} · {content.practiceName}
            </div>
            <h1 className="text-[40px] md:text-[56px] leading-[1.05] mb-3 font-bold tracking-tight">{member.name}</h1>
            <div className="text-base font-medium mb-6" style={{ color: "var(--p-primary)" }}>
              {member.credentials}{member.pronouns ? ` · ${member.pronouns}` : ""}
            </div>
            <ChipRow items={member.modalities} variant="outline" />
            {member.identities && member.identities.length > 0 && <ChipRow items={member.identities} variant="filled" />}
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 py-16" style={{ background: "color-mix(in srgb, var(--p-primary) 6%, var(--p-surface))" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--p-primary)" }}>{aboutLabel(locale)}</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">A note from {member.name.split(" ")[0]}.</h2>
          <div className="space-y-5 text-[17px] leading-relaxed">
            {longBio.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {member.disclaimer && <DisclaimerBox disclaimer={member.disclaimer} />}
        </div>
      </section>

      <section className="px-6 lg:px-12 py-16 border-t" style={{ borderColor: "color-mix(in srgb, var(--p-ink) 8%, transparent)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">{reachLabel(locale)}</h2>
          <p className="text-base mb-8" style={{ color: "var(--p-muted)" }}>{reachDesc(locale, content.practiceName)}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={`tel:${content.contact.phone}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-medium" style={{ background: "var(--p-primary)", color: "var(--p-surface)" }}>
              <Phone className="w-4 h-4" /> {content.contact.phone}
            </a>
            <a href={`mailto:${content.contact.email}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-medium border" style={{ borderColor: "color-mix(in srgb, var(--p-ink) 18%, transparent)" }}>
              <Mail className="w-4 h-4" /> {content.contact.email}
            </a>
          </div>
        </div>
      </section>

      <CrisisFooter content={content} />
    </div>
  );
}

/* ── Generic skin (shared by all canvas-port templates).
 *
 * The canvas mockups are visual replicas built around a single hard-coded
 * practitioner (Maya Alvarado) and don't model multi-clinician practitioner
 * sub-pages the way the older skins did. Until per-template detail layouts
 * are designed, every template falls back to the warm minimalist sub-page
 * — which gracefully handles single-practitioner content. */
function GenericSkin(props: SkinProps) {
  return <WarmMinimalistSkin {...props} />;
}

const SKINS: Record<TemplateKey, (props: SkinProps) => React.ReactElement> = {
  garden: GenericSkin,
  sunrise: GenericSkin,
  constellation: GenericSkin,
  polaroid: GenericSkin,
  playful_modern: GenericSkin,
  front_porch: GenericSkin,
  hello_friend: GenericSkin,
};

/* ── shared chip row ── */
function ChipRow({ items, variant }: { items: string[]; variant: "outline" | "filled" }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((m) => (
        <span
          key={m}
          className={`text-xs px-3 py-1 rounded-full ${variant === "outline" ? "border" : ""}`}
          style={
            variant === "outline"
              ? { borderColor: "color-mix(in srgb, var(--p-primary) 30%, transparent)", color: "var(--p-primary)" }
              : { background: "color-mix(in srgb, var(--p-primary) 12%, transparent)", color: "var(--p-primary)" }
          }
        >
          {m}
        </span>
      ))}
    </div>
  );
}
