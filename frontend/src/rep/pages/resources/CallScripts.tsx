import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Copy, Check, Phone, MessageSquare, Voicemail, RefreshCw, MailOpen, UserCheck } from "lucide-react";
import { PageHeader } from "@rep/components/RepLayout";

interface Script {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  tags: string[];
  content: string;
}

const SCRIPTS: Script[] = [
  {
    id: "cold-call-opener",
    icon: Phone,
    title: "Cold Call — Opener",
    subtitle: "First 60 seconds. Goal: get 2 minutes, not close the deal.",
    tags: ["Cold", "Phone", "Primary"],
    content: `"Hi, am I speaking with [Name]?

[Yes] Great — my name is [Your Name], I'm with Ashford Creative. We build websites for therapists and counselors in Texas — I'll be quick, I promise. Do you have two minutes?

[If yes] Awesome. We work with solo practitioners here in Texas who are either on Psychology Today and tired of paying for a profile they don't own, or who have a site that hasn't been updated in years. We build a custom site — bilingual, your own domain, hosted by us — for a flat $199 a month with no contract. No surprise bills, cancel anytime.

I'm not asking you to sign anything today. What I'd love to do is put together a free personalized preview using your actual practice name and specialty — it takes about 20 minutes on our end. Would that be worth looking at?

[If they say they already have a site] Totally understand. Can I ask — is it on your own domain, or through a directory like Psychology Today? [pause] The reason I ask is that if it's through a directory, you don't actually own your URL or your reviews. A lot of practitioners don't realize that until the directory raises rates or changes its algorithm."`,
  },
  {
    id: "voicemail",
    icon: Voicemail,
    title: "Voicemail Drop",
    subtitle: "Under 30 seconds. Curiosity hook, not a pitch.",
    tags: ["Cold", "Voicemail"],
    content: `"Hi [Name], this is [Your Name] with Ashford Creative — we build websites for therapists in Texas. I wanted to put together a free preview of what your site could look like using your actual practice name. No cost, no strings. If you're curious, give me a call back at [number] — or I'll try you again [day]. Have a great day."

TIP: Say your callback number slowly. Twice. Don't add "I know you're busy" — it's filler and practitioners hear it in every voicemail.`,
  },
  {
    id: "sms-followup",
    icon: MessageSquare,
    title: "SMS / Text Follow-Up",
    subtitle: "After a missed call or voicemail. Keep it short and low-pressure.",
    tags: ["SMS", "Follow-up", "Warm"],
    content: `After voicemail (same day):
"Hi [Name], [Your Name] here from Ashford Creative — left you a voicemail. We build custom websites for Texas therapists, $199/mo, no contract. Happy to put together a free preview of your practice. Reply anytime or just ignore this if it's not a fit — no hard feelings."

After preview link sent (24 hours later):
"Hey [Name] — just checking in. Sent a personalized preview of what your Ashford site might look like. Totally low pressure — just curious if anything caught your eye. Happy to walk you through it on a quick call if helpful."

Re-engagement (lead hasn't responded in 7+ days):
"Hey [Name], [Your Name] from Ashford. Circling back one last time — if the timing isn't right, totally understand. If it ever makes sense to have a site you own (vs. a directory profile), we're here. Take care."

RULE: Max 3 texts across the life of a cold lead. After that, archive and move on.`,
  },
  {
    id: "warm-followup",
    icon: MailOpen,
    title: "Warm Follow-Up (After Preview Sent)",
    subtitle: "They asked for a preview. Now they've gone quiet. Use this call.",
    tags: ["Warm", "Phone", "Post-preview"],
    content: `"Hi [Name] — this is [Your Name] from Ashford Creative. I sent over a personalized preview of your site a couple of days ago and wanted to follow up to see what you thought.

[If they've seen it] Great — what stood out to you? [listen] ... The part I find most practitioners react to is [X]. Did anything feel off or like it didn't match your style?

[If they haven't seen it] No worries at all — I can walk you through it right now if you have 5 minutes. It's built specifically around your practice name and specialty, so it's actually useful to look at together.

[Transition to close] I want to be straightforward with you — we're capping our client list at 200 practices. We're not there yet, but once we are, there's a waitlist. If the site looks right, the easiest next step is Plan B: no upfront cost, just $199 a month, and we go live within 48 hours. Want to move forward?"`,
  },
  {
    id: "objections",
    icon: UserCheck,
    title: "Objection Counters",
    subtitle: "Word-for-word responses to the 6 most common pushbacks.",
    tags: ["Objections", "All stages"],
    content: `OBJECTION: "I already have a Psychology Today profile."
COUNTER: "A lot of our clients had one too. Can I ask — do you own the URL? [pause] That's the core difference. On Psychology Today, you're renting space on their platform. If they raise rates — which they have — or change their algorithm, your leads disappear. With Ashford, your site is on a domain you own. Your SEO, your reputation, your contact form — all yours. We're $199 a month, often cheaper than what you're paying them, and you get out when you want."

OBJECTION: "I don't have time to deal with a website."
COUNTER: "That's exactly why we exist. You don't do any of the work — we handle design, hosting, updates, backups, everything. Our clients spend zero time on their site after it goes live. The only thing we ask is 20 minutes of your time upfront to answer a few content questions."

OBJECTION: "I'm not sure I need one — I get referrals."
COUNTER: "Referrals are great, and we're not replacing that. But here's the thing — when a referred client gets your name, the first thing they do is Google you. If there's nothing there, or there's a directory profile that looks like everyone else's, you're making it harder for them to feel confident. A clean, professional site validates the referral."

OBJECTION: "What about HIPAA?"
COUNTER: "Good question. Our sites don't store any PHI — the contact form asks for name and email, nothing clinical. We're not a covered entity and we don't offer BAAs, and we're upfront about that. If you need HIPAA-covered storage or a patient portal, that's a different product — we're the public-facing website layer only."

OBJECTION: "It's too expensive."
COUNTER: "$199 a month — that's $6.60 a day. If your site brings in even one new client in a year, it's paid for itself many times over. And the cancellation is generous — anytime in the first 90 days with no notice, then 30 days written notice after that. There's no financial risk here."

OBJECTION: "I want to think about it."
COUNTER: "Absolutely — I want you to be sure. Can I ask what specifically you'd be thinking through? [listen] ... Most of the time when I hear that, it's either budget, or wanting to see what the site would actually look like. I can solve both of those right now — the preview is free and takes 20 minutes on our end. Would it help to see it first before deciding?"

OBJECTION (from a gatekeeper): "The doctor handles all this — let me take a message."
COUNTER: "Totally fair. The reason I'm hoping to walk YOU through it first is the front-desk side: the intake forms hub, the new-patient welcome kit, the cancellation self-serve. If the new site adds half an hour of admin to your week, the doc isn't going to like it either. So before the doctor even sees the preview, I'd love to make sure it makes your job easier — five minutes? And whenever they call back I'll just say you and I already mapped it out."`,
  },
  {
    id: "spanish-script",
    icon: Phone,
    title: "Script — Spanish-Speaking Prospects",
    subtitle: "Opening in Spanish, transitioning to English if preferred.",
    tags: ["Spanish", "Cold", "Phone"],
    content: `OPENING (Spanish):
"Hola, ¿hablo con [Nombre]? Me llamo [Tu Nombre], soy de Ashford Creative. Diseñamos páginas web para terapeutas y consejeros en Texas — páginas bilingües, con su propio dominio, por $199 al mes sin contrato. ¿Tiene dos minutos?

[Continúe en el idioma que elija el prospecto]

Nos especializamos en prácticas de salud mental en Texas. Cada sitio que hacemos viene con versión en español incluida — no es un extra, es estándar. Para muchos terapeutas en Texas, eso marca una diferencia real para llegar a más pacientes."

ENGLISH TRANSITION (if they switch):
"Feel free to switch to English — we work in both. Our sites ship with a full Spanish version included at no extra cost, which is one of the reasons a lot of Texas practitioners choose us over the generic page builders."

NOTE: Never assume a Spanish-speaking prospect wants to conduct the whole call in Spanish. Follow their lead. The point is to open the door and demonstrate that we take bilingual seriously.`,
  },
  {
    id: "post-close",
    icon: RefreshCw,
    title: "Post-Close Thank You + Handoff",
    subtitle: "Right after a prospect signs up. Set expectations, create warmth.",
    tags: ["Post-close", "Warm"],
    content: `"[Name], I just wanted to take a second and say — you made a really good decision. A lot of practitioners I talk to have been meaning to do this for years and just haven't gotten around to it. You got it done.

Here's what happens next: you'll get an email from our team within a few hours with a short onboarding form — it takes about 15 minutes. The main things we need are your bio, your specialties, and any photos you'd like to use. If you don't have photos, no problem, we have resources for that.

Your site will be live within 48 hours of us receiving your form. You'll get a preview link to approve before anything goes public.

My job is done on the sales side, but I want you to know — if you have any questions in the first week, feel free to text me directly. I want to make sure the handoff to the design team goes smoothly for you.

And hey — if you know any other therapists or counselors who might be interested, we pay a referral bonus. Just have them mention your name when they sign up."

AFTER THE CALL: Log the close in the dashboard, record the closing bonus, and move the lead to "Closed" status.`,
  },
];

function ScriptCard({ script }: { script: Script }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(script.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full text-left p-5 flex items-start gap-4 hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 grid place-items-center text-primary mt-0.5">
          <script.icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{script.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{script.subtitle}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {script.tags.map((t) => (
              <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{t}</span>
            ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{open ? "Collapse ▲" : "Expand ▼"}</span>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="p-5">
            <pre className="whitespace-pre-wrap text-sm text-foreground/85 leading-relaxed font-sans">
              {script.content}
            </pre>
          </div>
          <div className="px-5 pb-5 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy script"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallScripts() {
  const [location] = useLocation();
  const backHref = location.startsWith("/kb") ? "/kb" : "/resources";
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back
      </Link>

      <PageHeader
        title="Call Scripts"
        description="7 scripts for every stage of the funnel. Expand any card to read, collapse to scan."
      />

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
        <strong>Golden rule:</strong> These are starting points, not scripts to read robotically. Adapt to the conversation. The goal of a cold call is one thing: get permission to send a free preview. That's it.
      </div>

      <div className="space-y-3">
        {SCRIPTS.map((s) => <ScriptCard key={s.id} script={s} />)}
      </div>
    </div>
  );
}
