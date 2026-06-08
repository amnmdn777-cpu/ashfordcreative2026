import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { I18nProvider } from "@site/lib/i18n";
import { Layout } from "@site/components/Layout";
import { ChatbotProvider } from "@site/components/ChatbotProvider";
import { ChatbotWidget } from "@site/components/Chatbot";
import { CrisisFloatingButton } from "@site/components/CrisisFloatingButton";
import { resolveTemplateKey } from "@site/templates";

// Phase 12 Commit 7 — lazy-load every page so the initial JS bundle
// only includes the routing skeleton + global chrome (Layout, Chatbot,
// CrisisFloatingButton). Each page is its own chunk that fetches on
// first navigation. The 9 template routes also lazy-load TemplateRoute,
// which is the largest single page on /template/<key> — biggest mobile
// perf win in the bundle-split pass.
const Home = lazy(() => import("@site/pages/Home"));
const Templates = lazy(() => import("@site/pages/Templates"));
const PractitionerDetail = lazy(() => import("@site/pages/PractitionerDetail"));
const TemplateRoute = lazy(() => import("@site/pages/TemplateRoute"));
const ProspectPreview = lazy(() => import("@site/preview/ProspectPreview"));
const ProspectPortal = lazy(() => import("@site/preview/portal/ProspectPortal"));
const PreviewIndex = lazy(() => import("@site/preview/PreviewIndex"));
const Pricing = lazy(() => import("@site/pages/Pricing"));
const HowItWorks = lazy(() => import("@site/pages/HowItWorks"));
const Blog = lazy(() => import("@site/pages/Blog"));
const BlogPost = lazy(() => import("@site/pages/BlogPost"));
const InsightsPost = lazy(() => import("@site/pages/InsightsPost"));
const About = lazy(() => import("@site/pages/About"));
const Contact = lazy(() => import("@site/pages/Contact"));
const LegalPrivacy = lazy(() => import("@site/pages/LegalPrivacy"));
const LegalTerms = lazy(() => import("@site/pages/LegalTerms"));
const LegalRefund = lazy(() => import("@site/pages/LegalRefund"));
const LegalSmsConsent = lazy(() => import("@site/pages/LegalSmsConsent"));
const CheckoutSuccess = lazy(() => import("@site/pages/CheckoutSuccess"));
const IntakeForm = lazy(() => import("@site/pages/intake/IntakeForm"));
const Inquire = lazy(() => import("@site/pages/Inquire"));
const VisitPage = lazy(() => import("@site/pages/Visit"));
const ComparedPage = lazy(() => import("@site/pages/Compared"));
// LOT SEO-1 — programmatic SEO pages targeting "[specialty] therapist
// [city] TX" long-tail intent. One component, 100 city × specialty
// combinations, sitemap entries emitted at build time. See
// src/data/seoMatrix.ts for the matrix and src/pages/FindTherapist.tsx
// for the rendered page.
const FindTherapist = lazy(() => import("@site/pages/FindTherapist"));
const FindTherapistIndex = lazy(() => import("@site/pages/FindTherapistIndex"));
const NotFound = lazy(() => import("@site/pages/not-found"));

/** Cream-band loading fallback shown while a lazy-loaded page fetches.
 *  Deliberately minimal — anything heavier would defeat the bundle-
 *  split (the fallback can't pull in framer-motion or other vendors). */
const PageLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-cream">
    <div className="font-mono text-xs uppercase tracking-widest text-ink/50 animate-pulse">
      Loading…
    </div>
  </div>
);

/** Routes that render full-bleed without the marketing Layout chrome or chatbot. */
function isStandaloneRoute(path: string): boolean {
  return (
    path.startsWith("/template/") ||
    // `/t/<slug>` is the short alias used in inbound campaign links, QR
    // codes, and SMS — it resolves to the same TemplateRoute so a click
    // from a marketing email lands on the live demo, not the index page.
    path.startsWith("/t/") ||
    path.startsWith("/p/") ||
    path === "/preview" ||
    path.startsWith("/preview/") ||
    // The Quiet Practice inquiry form is reached only from inside the
    // Quiet Practice template; the marketing header + chatbot widget
    // would fight the template's restraint, so it renders full-bleed.
    path === "/inquire"
  );
}

/**
 * Backward-compat redirect: the old `/templates/:key` detail page was
 * collapsed into the full-bleed `/template/:key` showcase. Pre-existing
 * shared links and any cached search results land here, get 301-equivalent
 * client-side redirected, and never see the marketing chrome.
 */
function TemplateDetailRedirect({ params }: { params: { key: string } }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(`/template/${params.key}`, { replace: true });
  }, [params.key, navigate]);
  return null;
}

function MarketingRoutes() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:templateKey/practitioner/:practitionerSlug" component={PractitionerDetail} />
      <Route path="/templates/:key" component={TemplateDetailRedirect} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/insights/:postId" component={InsightsPost} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/legal/privacy" component={LegalPrivacy} />
      <Route path="/legal/terms" component={LegalTerms} />
      <Route path="/legal/refund" component={LegalRefund} />
      <Route path="/legal/sms-consent" component={LegalSmsConsent} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      {/* LOT 3.3 — telehealth_bridge: branded prep page that opens the
       *  practitioner's existing Doxy/Zoom/SimplePractice room. */}
      <Route path="/visit" component={VisitPage} />
      <Route path="/sesion" component={VisitPage} />
      {/* LOT 3.B7 — coming-soon comparison page. */}
      <Route path="/compared" component={ComparedPage} />
      {/* LOT SEO-1 — programmatic SEO matrix (20 cities × 5 specialties). */}
      <Route path="/therapists" component={FindTherapistIndex} />
      <Route path="/therapists/:citySlug/:specialtySlug" component={FindTherapist} />
      {/* Intake form for the Hello Friend template — the only template
       *  whose hero CTA opens an intake form rather than a calendar. */}
      <Route path="/intake/:personaKey" component={IntakeForm} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

/**
 * Wrapper that renders TemplateRoute only for known template slugs (and
 * legacy aliases resolved by `resolveTemplateKey`). Unknown slugs fall
 * through to the marketing NotFound page, which is what reps and direct
 * marketing links should land on for typos like `/t/atruim` — keeps the
 * 404 experience consistent with the rest of the public site instead of
 * the bespoke "Template not found" panel TemplateRoute used to render.
 */
function TemplateGuard({ params }: { params: { key: string } }) {
  if (!resolveTemplateKey(params.key)) return <NotFound />;
  return <TemplateRoute />;
}

function StandaloneRoutes() {
  // Patient-facing surfaces: include the crisis 988 floater because
  // these pages are what an in-pain visitor would actually see on a
  // delivered client site. (Founder note 2026-05-02.)
  return (
    <>
      <Suspense fallback={<PageLoadingFallback />}>
      <Switch>
        <Route path="/template/:key" component={TemplateGuard} />
        {/* Short alias `/t/<slug>` for inbound campaign links, QR codes
            and SMS — resolves to the same showcase. The TemplateRoute
            internals preserve the `/t/` prefix on every URL sync so the
            short link stays canonical (no silent rewrite to /template/).
            Unknown slugs fall through to the site NotFound page. */}
        <Route path="/t/:key" component={TemplateGuard} />
        <Route path="/p/:token" component={ProspectPreview} />
        {/* Quiet Practice's inquiry form — full-bleed (no marketing
         *  chrome / chatbot) so the page reads as part of Catherine
         *  Whitfield's practice, not Ashford Creative's marketing site. */}
        <Route path="/inquire" component={Inquire} />
        <Route path="/preview" component={PreviewIndex} />
        <Route path="/preview/:slug" component={ProspectPortal} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
      <CrisisFloatingButton />
    </>
  );
}

function RoutedShell() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  if (isStandaloneRoute(location)) {
    // Full-bleed: no header/footer/chatbot — these pages own their own chrome.
    return <StandaloneRoutes />;
  }
  return (
    <>
      <Layout>
        <MarketingRoutes />
      </Layout>
      <ChatbotWidget />
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ChatbotProvider>
        <RoutedShell />
      </ChatbotProvider>
    </I18nProvider>
  );
}
