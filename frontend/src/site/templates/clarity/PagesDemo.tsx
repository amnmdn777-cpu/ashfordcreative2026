import React, { useState } from "react";
import type { ReactNode } from "react";
import type {
  PaletteDef,
  PreviewWebsitePage,
  TemplateKey,
} from "@workspace/api-zod";
import { ThemeProvider } from "@site/components/ThemeProvider";
import { resolvePersona } from "@site/data/resolvePersona";
import { useI18n } from "@site/lib/i18n";
import { img } from "@site/lib/api";
import type { TemplateContent } from "../types";
import { ClarityNavContext } from "./navContext";
import {
  ClarityBlog,
  ClarityPageHero,
  ClarityProse,
  ClarityValueCards,
  ClarityProcess,
  ClarityCtaBand,
  ClarityServices,
  ClarityTeam,
  ClarityStats,
} from "./sections";
import { TopBar } from "./skin";

/**
 * Showcase-only demo of the portal multi-page experience.
 *
 * The real PAGES bar + rebuilt sub-pages live in the prospect portal
 * (ProspectPortal), driven by pages crawled from the client's site. The
 * `/template/:key` showcase route doesn't have that data, so this wrapper
 * feeds the SAME real components (`PortalPagesBar` + `RebuiltPageView`)
 * a small set of sample pages so we can click through the multi-page
 * experience locally — rendered in Clarity's own sub-page skin. This is
 * a preview harness; on a live portal the pages come from the crawl.
 */

const mkPage = (
  path: string,
  kind: string,
  title: string,
  h1: string,
  rewrittenIntro: string,
  paragraphs: string[],
  images: string[] = [],
): PreviewWebsitePage => ({
  url: `https://example-practice.com${path}`,
  path,
  title,
  h1,
  summary: rewrittenIntro,
  paragraphs,
  images,
  kind,
  rewrittenIntro,
});

const PORTRAIT = img("images/atrium-portrait.jpg");

const SAMPLE_PAGES: PreviewWebsitePage[] = [
  mkPage(
    "/about",
    "about",
    "About the practice",
    "About the practice",
    "A calm, modern practice built around one idea: therapy should meet you where you are.",
    [
      "We're a group of licensed clinicians who believe good therapy is equal parts evidence and warmth. Every clinician here is trained in modalities that actually move the needle — EMDR, CBT, and depth-oriented work — and chosen as much for how they make people feel as for their credentials.",
      "We opened our doors because too many people told us their last therapy experience felt transactional — a waiting-room form, a rushed intake, a clinician watching the clock. We built the opposite: small caseloads, unhurried sessions, and a front desk that actually answers.",
      "Our work is trauma-informed and culturally responsive. Several of our clinicians are bilingual, and we see individuals, couples, and families across the lifespan — from teens finding their footing to adults navigating burnout, grief, and the quieter transitions no one warns you about.",
      "New clients tell us the same thing: it finally felt like someone was listening. That's the bar we hold ourselves to, session after session.",
    ],
    [PORTRAIT],
  ),
  mkPage(
    "/services",
    "services",
    "Services",
    "What we work on",
    "Focused, evidence-based support — individual, couples, and family therapy, in person or over secure video.",
    [
      "Individual therapy for anxiety, burnout, depression, grief, and life transitions. We lead with what's actually happening for you, then choose the approach to fit — CBT, EMDR, ACT, or depth-oriented work — rather than forcing you into a single protocol.",
      "Couples therapy for connection, communication, and the patterns that keep repeating. We use Gottman-informed and emotionally-focused methods to help you understand each other again, not just keep score.",
      "Family therapy for the seasons that ask the most of a family — a new diagnosis, a blended household, a teen in crisis, a parent in decline. We make room for every voice and help you move as one.",
      "Sessions are 50 minutes, weekly to start, available in person or over secure video. Sliding-scale spots open up regularly — just ask.",
    ],
  ),
  mkPage(
    "/team",
    "team",
    "Our clinicians",
    "Meet the team",
    "The clinicians you'll actually be working with — real people, real specialties.",
    [
      "Each clinician keeps a deliberately small caseload so the people they see get their full attention. We hire for warmth as much as credentials, and every therapist here has a focus — perinatal, trauma, couples, adolescents — so we can match you with someone who actually fits.",
      "Not sure who to pick? Start with a free 15-minute call and we'll point you to the right person. If it's not a fit after the first session, we'll help you find a better one — no awkwardness, no charge.",
    ],
    [PORTRAIT],
  ),
  mkPage(
    "/blog",
    "blog",
    "On the blog",
    "On the blog",
    "Notes from our clinicians — practical, plain-spoken, and never clickbait.",
    [
      "“Why your nervous system thinks a deadline is a bear.” A short primer on the stress response, and three things that actually bring it down in the moment (none of them are ‘just breathe’).",
      "“What a first session is really like.” We walk through exactly what happens in your first 50 minutes, so the unknown feels a little less unknown before you ever book.",
      "“EMDR, explained without the jargon.” One of our trauma specialists breaks down how reprocessing works and who it tends to help most.",
      "“Couples: the four-minute check-in.” A simple weekly ritual that heads off most of the fights that send couples to our door in the first place.",
    ],
  ),
  mkPage(
    "/privacy",
    "other",
    "Privacy Practices & No Surprises Act",
    "Privacy Practices & No Surprises Act",
    "Your privacy and your right to a clear estimate of costs, in plain language.",
    [
      "We follow HIPAA and applicable state law to keep your health information private. You have the right to access your records, request corrections, and know how your information is used and shared.",
      "We never sell your data. We use it only to provide your care, coordinate with providers you authorize, and handle billing — and we tell you plainly whenever the law requires a disclosure.",
      "Under the No Surprises Act, you're entitled to a Good Faith Estimate of expected charges before care if you're uninsured or paying out of pocket. Ask us any time and we'll provide one in writing, usually the same day.",
      "Questions about your privacy or an estimate? Call the office and a real person will walk you through it.",
    ],
  ),
];

export function ClarityPagesDemo({
  templateKey,
  palette,
  content,
  children,
}: {
  templateKey: TemplateKey;
  palette: PaletteDef;
  content: TemplateContent;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  const [activePath, setActivePath] = useState<string>("/");
  const activePage = SAMPLE_PAGES.find((p) => p.path === activePath) ?? null;
  const tt = (en: string, es: string) => (locale === "es" ? es : en);

  // Same resolved identity the homepage header uses, so the sub-page
  // header reads identically (one consistent nav across all pages).
  const r = resolvePersona("clarity", { content });
  const navItems = [
    { label: tt("Home", "Inicio"), href: "/" },
    { label: tt("About", "Acerca"), href: "/about" },
    { label: tt("Services", "Servicios"), href: "/services" },
    { label: tt("Team", "Equipo"), href: "/team" },
    { label: tt("Blog", "Blog"), href: "/blog" },
  ];

  // ── Shared content for designed sub-pages ──
  const thisYear = new Date().getFullYear();
  const years = content.yearFounded
    ? Math.max(1, thisYear - content.yearFounded)
    : 12;
  const stats = [
    {
      to: years,
      suffix: "+",
      label: tt("Years in practice", "Años de experiencia"),
    },
    {
      to: 500,
      suffix: "+",
      label: tt("Clients supported", "Pacientes atendidos"),
    },
    {
      to: content.insurance?.length ?? 3,
      label: tt("Insurance plans", "Planes de seguro"),
    },
    { to: 5, label: tt("Star-rated care", "Atención 5 estrellas") },
  ];
  const valueItems = [
    {
      title: tt("Evidence-based", "Basado en evidencia"),
      body: tt(
        "Every clinician is trained in approaches that actually move the needle — EMDR, CBT, and depth work.",
        "Cada clínico domina enfoques que de verdad funcionan — EMDR, TCC y trabajo profundo.",
      ),
    },
    {
      title: tt("Genuinely warm", "Genuinamente cálido"),
      body: tt(
        "Small caseloads, unhurried sessions, and a front desk that actually answers.",
        "Pocos pacientes por clínico, sesiones sin prisa y una recepción que de verdad responde.",
      ),
    },
    {
      title: tt("For everyone", "Para todos"),
      body: tt(
        "Trauma-informed, culturally responsive care, with bilingual clinicians on the team.",
        "Atención sensible al trauma y culturalmente receptiva, con clínicos bilingües en el equipo.",
      ),
    },
  ];
  const processSteps = [
    {
      title: tt("Reach out", "Escríbenos"),
      body: tt(
        "Book a free 15-minute call — no forms, no pressure.",
        "Reserva una llamada gratuita de 15 minutos — sin formularios ni presión.",
      ),
    },
    {
      title: tt("Get matched", "Te emparejamos"),
      body: tt(
        "We point you to the clinician whose focus and style fit you.",
        "Te conectamos con el clínico cuyo enfoque y estilo encajan contigo.",
      ),
    },
    {
      title: tt("Start sessions", "Empieza"),
      body: tt(
        "Weekly to start, in person or over secure video — your call.",
        "Semanal para empezar, en persona o por video seguro — tú decides.",
      ),
    },
  ];
  const ctaBand = (
    <ClarityCtaBand
      heading={tt("Ready when you are.", "Cuando tú estés listo.")}
      subhead={tt(
        "A free 15-minute call to see if we're the right fit — no pressure.",
        "Una llamada gratuita de 15 minutos para ver si encajamos — sin presión.",
      )}
      ctaLabel={tt(
        "Book a free 15-min call",
        "Reserva una llamada gratis de 15 min",
      )}
      ctaHref={r.bookingUrl}
    />
  );

  const renderSubPage = (page: PreviewWebsitePage) => {
    const paras = page.paragraphs ?? [];
    const title = page.h1 || page.title || "";
    const intro = page.rewrittenIntro ?? undefined;
    switch (page.kind) {
      case "blog":
        return (
          <ClarityBlog
            heading={tt("On the blog", "En el blog")}
            subhead={tt(
              "Notes from our clinicians — practical, plain-spoken, and never clickbait.",
              "Notas de nuestros clínicos — prácticas, claras y sin clickbait.",
            )}
            locale={locale}
            readLabel={tt("min read", "min de lectura")}
          />
        );
      case "about":
        return (
          <>
            <ClarityPageHero
              eyebrow={tt("About", "Acerca")}
              title={title}
              intro={intro}
            />
            <ClarityProse paragraphs={paras} />
            <ClarityValueCards
              heading={tt("What we stand for", "En qué creemos")}
              items={valueItems}
            />
            <ClarityStats items={stats} />
            {ctaBand}
          </>
        );
      case "services":
        return (
          <>
            <ClarityPageHero
              eyebrow={tt("Services", "Servicios")}
              title={title}
              intro={intro}
            />
            <ClarityServices
              heading={tt("What we work on", "En qué trabajamos")}
              subhead={tt(
                "Focused, evidence-based support — matched to where you are.",
                "Apoyo enfocado y basado en evidencia — a la medida de dónde estás.",
              )}
              items={r.focus_areas}
            />
            <ClarityProcess
              heading={tt("How it works", "Cómo funciona")}
              steps={processSteps}
            />
            {ctaBand}
          </>
        );
      case "team":
        return (
          <>
            <ClarityPageHero
              eyebrow={tt("Team", "Equipo")}
              title={title}
              intro={intro}
            />
            <ClarityTeam
              heading={tt("Meet the team", "Conoce al equipo")}
              members={content.team}
              locale={locale}
            />
            {ctaBand}
          </>
        );
      default:
        return (
          <>
            <ClarityPageHero
              eyebrow={tt("Legal", "Legal")}
              title={title}
              intro={intro}
            />
            <ClarityProse paragraphs={paras} />
          </>
        );
    }
  };

  return (
    <ClarityNavContext.Provider value={{ activePath, navigate: setActivePath }}>
      {activePage ? (
        // Sub-page: render Clarity's own header (one nav, no separate bar)
        // above the rebuilt page, in the template theme.
        <ThemeProvider templateKey={templateKey}>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
            }}
          >
            <TopBar
              name={r.name}
              logoUrl={r.isReal ? (content.brand?.logoUrl ?? null) : null}
              navItems={navItems}
              onNavigate={setActivePath}
              activePath={activePath}
              contactHref={r.bookingUrl}
              contactLabel={tt("Contact", "Contacto")}
            />
            {renderSubPage(activePage)}
          </div>
        </ThemeProvider>
      ) : (
        // Home: the Clarity homepage renders its own (context-aware) header.
        children
      )}
    </ClarityNavContext.Provider>
  );
}
