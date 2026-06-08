import { Link, useLocation } from "wouter";
import { ArrowLeft, Target, TrendingUp, Shield, Zap, Users, Star } from "lucide-react";
import { PageHeader } from "@rep/components/RepLayout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6 md:p-8">
      <h2 className="font-serif text-xl md:text-2xl mb-4 text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif text-3xl text-primary mb-1">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-foreground/80">
      <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
      <span>{children}</span>
    </li>
  );
}

export default function CompanyPresentation() {
  const [location] = useLocation();
  const backHref = location.startsWith("/kb") ? "/kb" : "/resources";
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back
      </Link>

      <PageHeader
        title="Ashford Creative"
        description="Boutique websites for Texas mental-health practitioners. Here's the full story."
      />

      {/* Hero stats */}
      <div className="bg-primary text-primary-foreground rounded-xl p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat value="From $199/mo" label="Three-tier pricing" />
        <Stat value="48 hr" label="Site launch" />
        <Stat value="200" label="Client cap" />
        <Stat value="100%" label="Bilingual" />
      </div>

      <div className="space-y-4">

        <Section title="Who We Are">
          <p className="text-sm text-foreground/80 leading-relaxed mb-4">
            Ashford Creative is a boutique web agency that designs, builds, and hosts professional websites exclusively for mental-health practitioners in Texas — therapists, counselors, psychologists, LCSWs, LPCs, and psychiatrists.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed mb-4">
            We are not a marketplace, a directory, or a page-builder. We are an agency. A real human designer works on every site. We own the hosting infrastructure and are responsible for it staying up 24/7.
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            Our model: one flat monthly price, no annual contracts, cancel anytime in the first 90 days — after that, with 30 days notice. No prorated refund. The simplicity is the product — practitioners spend their energy on clients, not websites.
          </p>
        </Section>

        <Section title="The Market Opportunity">
          <p className="text-sm text-foreground/80 leading-relaxed mb-4">
            Texas has over 30,000 licensed mental-health professionals. The majority have no independent website, or have one that hasn't been touched since 2016. They rely on Psychology Today, Alma, and similar directories — paying $30–$100/month for a profile they don't own, can't customize, and can't take with them if the platform changes its pricing.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="font-serif text-2xl text-primary">30,000+</div>
              <div className="text-xs text-muted-foreground mt-1">Licensed practitioners in TX</div>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="font-serif text-2xl text-primary">~70%</div>
              <div className="text-xs text-muted-foreground mt-1">No independent site</div>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="font-serif text-2xl text-primary">$30–$100</div>
              <div className="text-xs text-muted-foreground mt-1">Monthly directory cost</div>
            </div>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">
            The pitch writes itself: for less than most practitioners pay a directory, they get a site they own, a domain they control, and a design that actually represents them professionally.
          </p>
        </Section>

        <Section title="What We Sell">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="border border-border rounded-lg p-4">
              <div className="font-medium text-sm mb-2 flex items-center gap-2">
                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">Plan B</span>
                Bring Your Own Domain
              </div>
              <div className="text-2xl font-serif mb-1">$299 setup</div>
              <div className="text-sm text-primary font-medium mb-3">+ $199/mo</div>
              <ul className="space-y-1.5">
                <Bullet>Keep your existing URL</Bullet>
                <Bullet>We migrate, redesign, and host</Bullet>
                <Bullet>Practitioner keeps brand equity</Bullet>
              </ul>
            </div>
            <div className="border border-primary/40 rounded-lg p-4 bg-primary/5">
              <div className="font-medium text-sm mb-2 flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">Plan A</span>
                New Domain — Lead with this
              </div>
              <div className="text-2xl font-serif mb-1">$0 setup</div>
              <div className="text-sm text-primary font-medium mb-3">+ $199/mo</div>
              <ul className="space-y-1.5">
                <Bullet>We register a new domain for them</Bullet>
                <Bullet>Design, build, and host from scratch</Bullet>
                <Bullet>Easiest close — zero upfront friction</Bullet>
              </ul>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Both plans include: custom design, hosting, SSL, daily backups, Spanish translation, crisis-resources footer, and HIPAA-aware contact form. Optional add-ons available à la carte.
          </p>
        </Section>

        <Section title="Why We Win">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: Target, title: "Niche focus", desc: "We only serve mental-health practitioners. Every template, every word, every feature is built for this market — not dentists, not restaurants." },
              { icon: Zap, title: "48-hour launch", desc: "Most practitioners wait months for agencies or fumble with website builders for years. We launch in 48 hours." },
              { icon: Shield, title: "No annual contract", desc: "Cancel anytime in the first 90 days; after that, 30 days notice. No prorated refund. No long-term lock-in removes a major objection before it's raised." },
              { icon: Users, title: "Bilingual standard", desc: "Every site ships in English and Spanish. In Texas, this isn't a feature — it's table stakes." },
              { icon: TrendingUp, title: "Their own domain", desc: "Unlike directories, they own the URL. They build their own SEO. Their reputation is portable." },
              { icon: Star, title: "Three tiers, no upsells", desc: "Boutique $199, Pro $299, Concierge $649 — pick one and that's the all-in price. No surprise invoices on top." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 grid place-items-center text-primary mt-0.5">
                  <Icon size={15} />
                </div>
                <div>
                  <div className="text-sm font-medium mb-0.5">{title}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Our Constraints (Be Honest About These)">
          <p className="text-sm text-foreground/80 leading-relaxed mb-3">
            We intentionally cap active clients at 200. This isn't a limit we apologize for — it's how we guarantee quality. When a practitioner calls, a real person answers.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium text-amber-800">What we do NOT offer:</div>
            <ul className="space-y-1">
              {[
                "HIPAA Business Associate Agreements (BAAs) — we are not a covered entity",
                "Clinical outcomes claims or therapy efficacy promises",
                "Insurance credentialing or billing integrations",
                "Guaranteed first-page Google rankings",
                "24/7 tech support (we're a small team)",
              ].map((item) => (
                <li key={item} className="text-xs text-amber-700 flex gap-2">
                  <span>–</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Being upfront about these keeps client expectations right and reduces churn. Never promise something we don't deliver.
          </p>
        </Section>

        <Section title="Who You're Talking To">
          <p className="text-sm text-foreground/80 leading-relaxed mb-4">
            Our ideal prospect is a solo or small-group practice owner with 3–20 years of experience, licensed in Texas, currently on Psychology Today or with no web presence at all. They care about being findable by the right clients, they are time-poor, and they are skeptical of technology vendors.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: "Best-fit prospect", items: ["Solo practitioner or small group", "On Psychology Today / no site", "Values independence from platforms", "Time-poor, tech-skeptical"] },
              { label: "Warm signals", items: ["New private-pay practice", "Recently left a group practice", "Recently licensed", "Spanish-speaking clientele"] },
              { label: "Hard pass", items: ["Wants HIPAA BAA in writing", "Wants EHR integration", "Large hospital or DSO", "Under 1 year licensed"] },
            ].map(({ label, items }) => (
              <div key={label} className="bg-muted rounded-lg p-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
                <ul className="space-y-1">
                  {items.map((i) => <Bullet key={i}>{i}</Bullet>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
