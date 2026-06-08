import { Link } from "wouter";
import {
  Building2,
  Phone,
  BookOpen,
  GraduationCap,
  CreditCard,
  Layers,
  ArrowRight,
  Zap,
} from "lucide-react";
import { PageHeader } from "@rep/components/RepLayout";

const CARDS = [
  {
    href: "/resources/play-cards",
    icon: Layers,
    title: "Play Cards",
    desc: "Six proven approach styles with word-for-word openers, pivots, and closes. Pick the play that fits the prospect.",
    badge: "New",
    badgeColor: "bg-rose-100 text-rose-700",
  },
  {
    href: "/resources/company",
    icon: Building2,
    title: "Company Overview",
    desc: "Who Ashford is, what we sell, why mental-health practitioners are the right market, and what makes us different.",
    badge: "Start here",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    href: "/resources/training",
    icon: GraduationCap,
    title: "Training Materials",
    desc: "The perfect day schedule, 6 training modules, finding leads, closing techniques, and the weekly success checklist.",
    badge: "With perfect day",
    badgeColor: "bg-sky-100 text-sky-700",
  },
  {
    href: "/resources/call-scripts",
    icon: Phone,
    title: "Call Scripts",
    desc: "Cold-call openers, voicemail drops, SMS follow-ups, re-engagement scripts, and word-for-word objection counters.",
    badge: "7 scripts",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/resources/reference",
    icon: BookOpen,
    title: "Reference Guide",
    desc: "Plans A & B at a glance, every add-on priced, competitor comparison, compliance red-lines, and FAQ.",
    badge: "Quick-ref",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    href: "/resources/payment-plans",
    icon: CreditCard,
    title: "Payment Plans & Examples",
    desc: "Invoice examples, your earnings breakdown, and the interactive earnings calculator.",
    badge: "With calculator",
    badgeColor: "bg-violet-100 text-violet-700",
  },
];

const APPROVAL_KIND_BLURB: { label: string; help: string }[] = [
  {
    label: "Setup-fee discount",
    help: "Lead is on the fence about the one-time $99 setup. Ask for $50 or $0 with reason.",
  },
  {
    label: "Free first month",
    help: "Use sparingly to land a brand-name client or a referral source.",
  },
  {
    label: "Refund an invoice",
    help: "Client churned within 30 days and is asking for money back — escalate, do not promise.",
  },
  {
    label: "Custom add-on price",
    help: "Lead wants something not on our menu (e.g. blog migration). Quote with Ashford first.",
  },
];

export default function ResourcesPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Resources"
        description="Everything you need to pitch, close, and grow — in one place."
      />

      <div className="bg-primary text-primary-foreground rounded-xl px-5 py-4 mb-5 flex items-start gap-3">
        <Zap size={18} className="shrink-0 mt-0.5" />
        <p className="text-sm text-primary-foreground/90 leading-relaxed">
          <strong>Every lead in Available Leads is yours to open.</strong> We source and generate all leads — you don't need to prospect from scratch. Work the queue, send previews, and close. That's the whole job.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {CARDS.map(({ href, icon: Icon, title, desc, badge, badgeColor }) => (
          <Link key={href} href={href}>
            <div className="group bg-card border border-card-border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
                  <Icon size={20} />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeColor}`}>
                  {badge}
                </span>
              </div>
              <h2 className="font-serif text-lg mb-1.5">{title}</h2>
              <p className="text-sm text-muted-foreground flex-1">{desc}</p>
              <div className="mt-4 flex items-center gap-1 text-sm text-primary font-medium group-hover:gap-2 transition-all">
                Open <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-card border border-card-border rounded-xl p-5">
        <h2 className="font-serif text-lg mb-2">When to ask Ashford for approval</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Inside any lead, the <strong>Request approval</strong> button sends a request
          straight to Ashford (email + SMS). Use it instead of promising
          something off-policy. You will see Ashford's decision and any note
          on the lead's sidebar — usually within a few hours.
        </p>
        <ul className="space-y-2 text-sm">
          {APPROVAL_KIND_BLURB.map((k) => (
            <li key={k.label} className="flex gap-2">
              <span className="font-medium shrink-0">{k.label}:</span>
              <span className="text-muted-foreground">{k.help}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          Ashford notification routing (which categories ping email vs SMS, when the
          daily digest arrives) is configured by Ashford via the
          <code className="mx-1 px-1 py-0.5 bg-muted rounded">OWNER_NOTIFICATION_*</code>
          environment variables. If you stop seeing approval responses, ping
          Ashford directly.
        </p>
      </div>
    </div>
  );
}
