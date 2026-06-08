import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@rep/components/RepLayout";
import { useState } from "react";

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 md:p-6">
      <h2 className="font-serif text-lg md:text-xl mb-4 text-foreground">{title}</h2>
      {children}
    </div>
  );
}

const ADDONS = [
  { name: "Online Booking", price: "$20/mo", desc: "Calendly-style booking widget built into the site. Syncs with Google Calendar so the practitioner stays in control of their hours." },
  { name: "Insurance & Sliding Scale Badge", price: "$15/mo", desc: "Clear inline panel showing accepted insurance plans, out-of-network rates, and sliding-scale eligibility — answers the #1 question prospective clients ask." },
  { name: "First-Visit Video", price: "$15/mo", desc: "Short bilingual landing video walking a new client through what to expect at session one. Cuts no-show anxiety." },
  { name: "Insights Journal", price: "$20/mo", desc: "Lightweight blog/notes section with bilingual auto-formatting. Builds clinical authority without an outside CMS." },
  { name: "Google Profile Sync", price: "$15/mo", desc: "We mirror site updates (hours, services, photos) to the practitioner's Google Business Profile. Keeps local search consistent." },
  { name: "New Patient Welcome Kit", price: "$10/mo", desc: "Branded PDF + email sequence sent automatically when a contact-form lead converts. Reduces back-and-forth before the first session." },
  { name: "Intake Forms Hub", price: "$15/mo", desc: "Secure, no-PHI intake form builder hosted on the practitioner's own domain. Forms are emailed to them — no portal to manage." },
  { name: "Cancellation Self-Serve", price: "$10/mo", desc: "Patients reschedule or cancel via a private link instead of calling. Respects the practitioner's cancellation policy automatically." },
];

const FAQ = [
  {
    q: "Do clients own their domain?",
    a: "Plan A: yes — they bring their domain and keep it. Plan B: we register a new domain; ownership can be transferred to the client at any time. We keep hosting, they keep the URL.",
  },
  {
    q: "What CMS does the site use?",
    a: "Our sites don't use a traditional CMS. Content is set at build time and updated by the Ashford design team on request. This is intentional — practitioners don't want to manage a site; they want it managed for them.",
  },
  {
    q: "How long until the site is live?",
    a: "48 hours after the client completes the onboarding form (typically 15 minutes). Plan B adds ~1 day for DNS propagation.",
  },
  {
    q: "Can they add more pages later?",
    a: "Yes. Additional pages are quoted before work starts — never any in-flight surprise charges. Minor text edits are included.",
  },
  {
    q: "Is there a setup fee for Plan B?",
    a: "No. Plan B is $0 setup, $199/mo. We absorb the domain registration cost.",
  },
  {
    q: "Can they use the same site if they move from solo to group practice?",
    a: "Yes. We add clinician profile pages as a custom-dev quote (typically $150–$400 depending on team size). No site rebuild needed and the base $199/mo doesn't change.",
  },
  {
    q: "What if they cancel?",
    a: "Cancel anytime in the first 90 days with no notice required. After that, 30 days written notice. No prorated refund. We export their content either way so they don't leave empty-handed. For Plan B, their domain stays theirs. For Plan A, we transfer the domain to them.",
  },
  {
    q: "Do you offer HIPAA BAAs?",
    a: "No. We are not a covered entity. The contact form collects name and email only — no PHI. Clients who need a full HIPAA-covered EHR integration are out of scope for Ashford.",
  },
];

const COMPETITORS = [
  { label: "Psychology Today", cost: "$30–$100/mo", own: "No", bilingual: "No", design: "Profile", contract: "Annual", verdict: "They rent space; clients don't own anything." },
  { label: "Alma / Headway", cost: "Revenue share", own: "No", bilingual: "No", design: "Profile", contract: "Ongoing", verdict: "Insurance-heavy; wrong fit for private pay." },
  { label: "Squarespace / Wix", cost: "$16–$46/mo + time", own: "Domain", bilingual: "Manual", design: "DIY", contract: "Annual", verdict: "Practitioners end up with a half-finished site they hate." },
  { label: "Local web agency", cost: "$3k–$10k build", own: "Yes", bilingual: "Extra", design: "Custom", contract: "One-time", verdict: "High cost, no ongoing support, they have to manage hosting." },
  { label: "Ashford Creative", cost: "$199/mo", own: "Yes", bilingual: "Included", design: "Custom", contract: "None", verdict: "The only option that's boutique, affordable, and theirs." },
];

function FAQ_Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button type="button" className="w-full text-left py-3 flex justify-between items-start gap-2" onClick={() => setOpen(!open)}>
        <span className="text-sm font-medium">{q}</span>
        <span className="text-muted-foreground text-lg leading-none shrink-0">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="text-sm text-muted-foreground pb-3 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function ReferenceGuide() {
  const [location] = useLocation();
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href={location.startsWith("/kb") ? "/kb" : "/resources"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back
      </Link>

      <PageHeader
        title="Reference Guide"
        description="Plans, add-ons, comparisons, and FAQs — bookmark this and keep it open during calls."
      />

      <div className="space-y-4">

        <SectionBlock title="Plans at a Glance">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { plan: "A", tag: "New Domain — Lead with this", setup: "$0", monthly: "$199/mo", best: "New practices or anyone who wants zero upfront cost", includes: ["We register a fresh domain", "Design + build from scratch", "Hosting, SSL, daily backups", "Spanish translation included", "Domain ownership transferable", "Easiest first-time close"] },
              { plan: "B", tag: "Bring Your Own Domain", setup: "$299", monthly: "$199/mo", best: "Practitioners with an existing URL they want to keep", includes: ["Keep existing domain", "We migrate + redesign", "Same inclusions as Plan A", "Crisis-resources footer", "HIPAA-aware contact form"] },
            ].map(({ plan, tag, setup, monthly, best, includes }) => (
              <div key={plan} className={`rounded-xl p-4 border ${plan === "A" ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan === "A" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Plan {plan}</span>
                  <span className="text-sm font-medium">{tag}</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-serif text-2xl">{setup}</span>
                  <span className="text-xs text-muted-foreground">setup</span>
                </div>
                <div className="text-primary text-sm font-medium mb-3">{monthly}</div>
                <div className="text-xs text-muted-foreground mb-2">Best for: {best}</div>
                <ul className="space-y-1">
                  {includes.map((i) => <li key={i} className="text-xs flex gap-2"><span className="text-primary">✓</span>{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="Add-Ons (À la Carte)">
          <p className="text-sm text-muted-foreground mb-4">All add-ons are optional and can be added or removed at any time. They're billed monthly alongside the base plan.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-xs text-muted-foreground uppercase tracking-wide">Add-on</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs text-muted-foreground uppercase tracking-wide">Price</th>
                  <th className="text-left py-2 font-medium text-xs text-muted-foreground uppercase tracking-wide">What it does</th>
                </tr>
              </thead>
              <tbody>
                {ADDONS.map(({ name, price, desc }) => (
                  <tr key={name} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{name}</td>
                    <td className="py-2.5 pr-4 text-primary font-medium whitespace-nowrap">{price}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionBlock>

        <SectionBlock title="Competitor Comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Option", "Cost", "Own domain?", "Bilingual?", "Design", "Contract", "Bottom line"].map((h) => (
                    <th key={h} className="text-left py-2 pr-3 font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPETITORS.map((c, i) => (
                  <tr key={c.label} className={`border-b border-border last:border-0 ${i === COMPETITORS.length - 1 ? "bg-primary/5" : ""}`}>
                    <td className={`py-2.5 pr-3 font-medium whitespace-nowrap ${i === COMPETITORS.length - 1 ? "text-primary" : ""}`}>{c.label}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{c.cost}</td>
                    <td className="py-2.5 pr-3">{c.own}</td>
                    <td className="py-2.5 pr-3">{c.bilingual}</td>
                    <td className="py-2.5 pr-3">{c.design}</td>
                    <td className="py-2.5 pr-3">{c.contract}</td>
                    <td className="py-2.5 text-muted-foreground">{c.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionBlock>

        <SectionBlock title="Compliance Red Lines">
          <p className="text-sm text-muted-foreground mb-3">Memorize these. If a prospect pushes on any of them, be direct — don't hedge.</p>
          <div className="space-y-3">
            {[
              { label: "HIPAA BAA", detail: "We do not offer Business Associate Agreements. Our sites don't store PHI. If a prospect needs HIPAA-covered storage, they need an EHR — that's a different product." },
              { label: "Clinical efficacy claims", detail: "Never say the site will help their clients get better. We market the practitioner, not the therapy." },
              { label: "Insurance billing / credentialing", detail: "We don't touch insurance. If a prospect wants billing integration, that's a specialty platform (TherapyNotes, SimplePractice, etc.)." },
              { label: "Guaranteed rankings", detail: "SEO is not guaranteed. We build sites that are structured for discoverability; we can't promise page-one placement." },
              { label: "Crisis intervention", detail: "Every Ashford site includes a crisis-resources footer (988, local crisis lines). We don't offer crisis intervention services ourselves." },
            ].map(({ label, detail }) => (
              <div key={label} className="flex gap-3">
                <span className="shrink-0 mt-0.5 w-2 h-2 rounded-full bg-destructive/70 mt-1.5" />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="FAQ">
          <div className="divide-y divide-border">
            {FAQ.map((item) => <FAQ_Item key={item.q} {...item} />)}
          </div>
        </SectionBlock>

      </div>
    </div>
  );
}
