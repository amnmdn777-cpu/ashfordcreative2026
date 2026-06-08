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
import { getCandidateSession } from "@rep/lib/candidate";
import { CandidateQuizHero } from "@rep/components/CandidateQuizHero";

const CARDS = [
  {
    href: "/kb/play-cards",
    icon: Layers,
    title: "Play Cards",
    desc: "Six proven approach styles — openers, pivots, and closes for every type of prospect. The fastest way to level up your calls.",
    badge: "Start here",
    badgeColor: "bg-rose-100 text-rose-700",
  },
  {
    href: "/kb/training",
    icon: GraduationCap,
    title: "Training Materials",
    desc: "The perfect day schedule, 6 training modules, and the weekly checklist that top reps follow.",
    badge: "With perfect day",
    badgeColor: "bg-sky-100 text-sky-700",
  },
  {
    href: "/kb/call-scripts",
    icon: Phone,
    title: "Call Scripts",
    desc: "Word-for-word cold-call openers, voicemail drops, SMS follow-ups, and objection counters.",
    badge: "7 scripts",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/kb/company",
    icon: Building2,
    title: "Company Overview",
    desc: "Who Ashford is, what we sell, the market opportunity, and what to say about our constraints.",
    badge: "Know the product",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    href: "/kb/reference",
    icon: BookOpen,
    title: "Reference Guide",
    desc: "Plans, add-on pricing, competitor comparison, and FAQ — keep this open during calls.",
    badge: "Quick-ref",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    href: "/kb/payment-plans",
    icon: CreditCard,
    title: "Payment Plans & Earnings",
    desc: "Invoice examples, what you earn per deal, and the interactive earnings calculator.",
    badge: "With calculator",
    badgeColor: "bg-violet-100 text-violet-700",
  },
];

export default function KBHub() {
  const candidateSession = getCandidateSession();
  // The task spec calls for the secondary CTA to point candidates at the
  // Company Overview specifically (it sets the most context for the rest of
  // the KB), regardless of grid order.
  const startHere =
    CARDS.find((c) => c.href === "/kb/company") ?? CARDS[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {candidateSession && (
          <CandidateQuizHero
            session={candidateSession}
            sectionCount={CARDS.length}
            firstSectionHref={startHere.href}
            firstSectionTitle={startHere.title}
          />
        )}

        <div className="mb-6">
          <div className="font-serif text-3xl mb-1">Ashford Creative</div>
          <div className="text-xs uppercase tracking-widest text-primary mb-3">Knowledge Base</div>
          <p className="text-sm text-muted-foreground">
            You have everything you need to close. This is your playbook.
          </p>
        </div>

        <div className="bg-primary text-primary-foreground rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
          <Zap size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm text-primary-foreground/90 leading-relaxed">
            <strong>Every lead in the dashboard is available for you to open.</strong> You don't source leads — we do. Your job: work the queue, send previews, close. 3 closes a week = $447+ in bonuses before hourly.
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
      </div>
    </div>
  );
}
