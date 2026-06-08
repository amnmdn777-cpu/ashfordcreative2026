import { useI18n } from "@site/lib/i18n";
import type { PortalPublicResponse } from "@workspace/api-zod";
import type { StringKey } from "@site/lib/strings";
import { Home as HomeIcon, User, Briefcase, Users, Mail, FileText, Newspaper, FileQuestion, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Page shape consumed by `PortalPagesBar`. Mirrors `PortalPublicResponse["pages"][number]`
 * but adds an optional `drafted` marker so we can surface
 * `previewContent.draftedPages` (which we synthesized rather than
 * crawled) under the same nav, with a small "Already drafted for you"
 * badge so the prospect understands these aren't pages we found —
 * they're pages we already wrote.
 */
export interface PortalPageItem {
  path: string;
  title: string | null;
  h1: string | null;
  kind: string;
  drafted?: boolean;
}

const KIND_ICON: Record<string, LucideIcon> = {
  home: HomeIcon,
  about: User,
  services: Briefcase,
  service: Briefcase,
  team: Users,
  contact: Mail,
  fees: FileText,
  blog: Newspaper,
};

const KIND_LABEL_KEY: Record<string, StringKey> = {
  home: "portal_pagesbar_kind_home",
  about: "portal_pagesbar_kind_about",
  services: "portal_pagesbar_kind_services",
  service: "portal_pagesbar_kind_services",
  team: "portal_pagesbar_kind_team",
  contact: "portal_pagesbar_kind_contact",
  fees: "portal_pagesbar_kind_fees",
  blog: "portal_pagesbar_kind_blog",
  other: "portal_pagesbar_kind_other",
};

function prettifyPath(path: string, homeLabel: string): string {
  const stripped = path.replace(/^\/+|\/+$/g, "");
  if (!stripped) return homeLabel;
  // Drop trailing numeric/`-N` slug suffixes like "/emdr-intensives-2/" → "emdr-intensives".
  const last = stripped.split("/").pop() ?? stripped;
  const cleaned = last.replace(/-\d+$/, "");
  return cleaned
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Common English therapy page-title fragments → Spanish translation.
 * Page tabs come from the crawled site's `<title>` tags, which are
 * almost always English. We don't run them through an AI translator
 * (cost + latency); this table covers the recurring ~80% of titles
 * across our prospect base. Match is whole-string, case-insensitive,
 * AFTER the location-suffix strip in pageHeadline.
 */
const ES_PAGE_LABELS: Record<string, string> = {
  "home": "Inicio",
  "about": "Sobre mí",
  "about us": "Sobre nosotros",
  "about me": "Sobre mí",
  "contact": "Contacto",
  "contact us": "Contáctanos",
  "services": "Servicios",
  "our services": "Nuestros servicios",
  "team": "Equipo",
  "our team": "Nuestro equipo",
  "fees": "Tarifas",
  "fees & insurance": "Tarifas y seguro",
  "rates": "Tarifas",
  "blog": "Blog",
  "faq": "Preguntas frecuentes",
  "professional counselor": "Consejero profesional",
  "professional counseling": "Consejería profesional",
  "counseling center": "Centro de consejería",
  "therapy services": "Servicios de terapia",
  "our approach": "Nuestro enfoque",
  "meet the team": "Conoce al equipo",
  "counseling services": "Servicios de consejería",
  "counseling sessions": "Sesiones de consejería",
  "payment info": "Información de pago",
  "payment information": "Información de pago",
  "individual therapy": "Terapia individual",
  "couples therapy": "Terapia de pareja",
  "family therapy": "Terapia familiar",
  "child therapy": "Terapia infantil",
  "teen therapy": "Terapia para adolescentes",
  "group therapy": "Terapia grupal",
  "telehealth": "Telesalud",
  "privacy policy": "Política de privacidad",
  "terms": "Términos",
  "good faith estimate": "Estimación de buena fe",
  "getting started": "Empezando",
  "appointment": "Cita",
  "schedule": "Agenda",
  "resources": "Recursos",
};

function translateToSpanish(label: string): string {
  const key = label.trim().toLowerCase();
  return ES_PAGE_LABELS[key] ?? label;
}

function stripCitySuffix(label: string, city: string | null | undefined): string {
  if (!city) return label;
  const trimmed = city.trim();
  if (!trimmed) return label;
  const trailing = new RegExp(
    `\\s+${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "i",
  );
  return label.replace(trailing, "").trim() || label;
}

// 2026-05-14 V4: aggregator brand names that may appear inside page titles
// scraped from networks like Psychology Today, Headway, Headlight Health,
// etc. When a page title is just an aggregator brand (e.g. "Psychology
// Today - Headlight"), the PAGES nav would show "Psychology Today - Headlight"
// as a tab label — that's free advertising for a competitor inside a
// preview we're trying to sell. Strip the brand segments and fall back to
// the page path's prettified label instead.
const AGGREGATOR_BRANDS_PAGE = new Set([
  "care","carecom","headway","headwayco","alma","almacom",
  "grow","growtherapy","talkspace","betterhelp",
  "zencare","zocdoc","healthgrades","therapyden","goodtherapy",
  "psychology","psychologytoday","psych","psychtoday",
  "openpath","monarch","inclusivetherapists",
  "headlight","helloalma","simplepractice","theranest",
  "network","mentalhealth","mentalhealthcare",
]);
function isAggregatorLabel(s: string): boolean {
  const norm = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return AGGREGATOR_BRANDS_PAGE.has(norm);
}

function pageLabel(
  p: PortalPageItem,
  homeLabel: string,
  locale: "en" | "es",
  prospectCity?: string | null,
): string {
  // Split on em-dash, middle-dot, pipe, AND space-hyphen-space so we can
  // peel off aggregator brand prefixes like "Psychology Today - X".
  const segments = (p.title ?? p.h1 ?? "")
    .split(/[—|·|]|\s-\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Prefer the first segment that isn't an aggregator brand. If all
  // segments are aggregator brands (the worst case, where the title is
  // just brand soup), fall through to the path-derived label.
  const cleanSeg = segments.find((s) => !isAggregatorLabel(s));
  let raw =
    cleanSeg && cleanSeg.length > 0
      ? cleanSeg
      : prettifyPath(p.path, homeLabel);
  raw = stripCitySuffix(raw, prospectCity);
  return locale === "es" ? translateToSpanish(raw) : raw;
}

/**
 * Slim sticky nav bar that lists every page we crawled from the prospect's
 * existing website. Lives in the portal shell (above the rendered template)
 * because each individual template hides its own `<nav class="fixed">` to
 * avoid colliding with the portal toolbar (see ProspectPortal.tsx ~L1375).
 *
 * Clicking a link sets `activePagePath` on the parent — the parent then
 * either renders the full template (when the home page is active) or a
 * `RebuiltPageView` for any other page. Picks deep-link via the URL hash
 * (`#p=/about`) so a reload preserves the active page.
 */
export function PortalPagesBar({
  pages,
  activePath,
  onPick,
  prospectCity,
  draftedBadge,
}: {
  pages: ReadonlyArray<PortalPageItem | PortalPublicResponse["pages"][number]>;
  activePath: string;
  onPick: (path: string) => void;
  /** Strips a trailing "<City>" suffix from Yoast-concatenated titles. */
  prospectCity?: string | null;
  /** Localized label rendered as a small badge on pages flagged `drafted`. */
  draftedBadge?: string;
}) {
  const { t, locale } = useI18n();
  if (pages.length === 0) return null;
  // Resolve which page should display as active. Direct path match wins.
  // When the hash references a path we no longer crawl (or has been
  // cleared to ""), fall back to whichever page represents "home" so
  // the bar always has exactly one selected pill — matches the
  // template-vs-rebuilt fallback logic in ProspectPortal.
  const directMatch = pages.find((p) => p.path === activePath);
  const homeFallback =
    pages.find((p) => p.kind === "home" || p.path === "/") ?? pages[0];
  const effectiveActive = directMatch ?? homeFallback;
  return (
    <nav
      data-testid="portal-pages-bar"
      aria-label={t("portal_pagesbar_aria")}
      className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-ink/10"
    >
      <div className="px-4 sm:px-6 py-2 flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium shrink-0">
          {t("portal_pagesbar_eyebrow")}
        </span>
        <ul className="flex gap-1 overflow-x-auto -mx-1 px-1 flex-1 min-w-0">
          {pages.map((p) => {
            const isActive = p === effectiveActive;
            const Icon = KIND_ICON[p.kind] ?? FileQuestion;
            const kindKey = KIND_LABEL_KEY[p.kind] ?? KIND_LABEL_KEY.other;
            const drafted = (p as PortalPageItem).drafted === true;
            return (
              <li key={p.path} className="shrink-0">
                <button
                  type="button"
                  data-testid={`portal-pages-bar-link-${p.path}`}
                  onClick={() => onPick(p.path)}
                  aria-current={isActive ? "page" : undefined}
                  title={drafted && draftedBadge ? draftedBadge : t(kindKey)}
                  className={
                    "px-3 py-1.5 text-xs font-medium rounded-full inline-flex items-center gap-1.5 whitespace-nowrap transition-colors " +
                    (isActive
                      ? "text-cream"
                      : "text-ink/65 hover:text-ink hover:bg-ink/5")
                  }
                  // Active pill borrows the chosen template's accent
                  // so the bar reads as part of the template chrome
                  // instead of a generic portal toolbar.
                  style={
                    isActive
                      ? {
                          backgroundColor: "var(--p-primary, #1f2547)",
                          color: "var(--p-surface, #faf7f2)",
                        }
                      : undefined
                  }
                >
                  <Icon className="w-3 h-3" aria-hidden="true" />
                  {pageLabel(p, t("portal_pagesbar_kind_home"), locale, prospectCity)}
                  {drafted && draftedBadge ? (
                    <span
                      className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider"
                      style={{
                        backgroundColor: isActive
                          ? "rgba(255,255,255,0.18)"
                          : "var(--color-primary, rgba(0,0,0,0.06))",
                        color: isActive ? "var(--p-surface, #faf7f2)" : "var(--color-surface, #ffffff)",
                      }}
                    >
                      <Sparkles className="w-2.5 h-2.5" aria-hidden />
                      {draftedBadge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
