import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@rep/components/RepLayout";

interface Play {
  id: string;
  name: string;
  tagline: string;
  bestFor: string;
  color: string;
  bgColor: string;
  approach: string;
  opener: string;
  pivot: string;
  close: string;
  watchOut: string;
  tip: string;
}

const PLAYS: Play[] = [
  {
    id: "educator",
    name: "The Educator",
    tagline: "Lead with insight. Make them realize the problem before you pitch the solution.",
    bestFor: "Practitioners who seem satisfied with their current setup (Psychology Today profile, word of mouth). They don't think they need a website.",
    color: "text-sky-700",
    bgColor: "bg-sky-50 border-sky-200",
    approach: "Don't pitch. Teach. Ask questions that help them realize what they're missing. The goal is to create awareness of a problem they haven't named yet.",
    opener: `"Dr. [Name], quick question — when a potential new client Googles your name right now, what's the first thing they find? … Is that a Psychology Today profile? … And do you know what shows up right next to it? Every other therapist in a 10-mile radius with the same gray headshot layout. There's no way for someone to tell you apart from the crowd."`,
    pivot: `"We build you a site on your own domain — so when someone searches 'therapist in [City]' or specifically looks you up, they find you, not a directory. No profile next to 40 competitors. Just your practice, your voice, your design."`,
    close: `"I'd love to put together a free personalized preview of what your site could look like. Takes us 20 minutes to build, costs you nothing to look at. Can I send it to you today?"`,
    watchOut: "Don't lecture. Ask, don't tell. If they push back ('I get plenty of referrals'), acknowledge it and pivot to the long game: 'Referrals are great — a site makes sure those people can actually find you when they go to verify you exist.'",
    tip: "The best educators pause after asking a question and let the silence work. Practitioners will often fill the silence with exactly the frustration you're looking for.",
  },
  {
    id: "mirror",
    name: "The Mirror",
    tagline: "Match their energy, speak their language, and earn trust before you earn the sale.",
    bestFor: "Therapists who are warm on the phone but cautious about vendors. People who've been burned before by website builders or agencies that overpromised.",
    color: "text-violet-700",
    bgColor: "bg-violet-50 border-violet-200",
    approach: "Listen more than you talk in the first two minutes. Mirror their pace, vocabulary, and tone. Build rapport before you pivot to the pitch. They need to like you first.",
    opener: `"Hi Dr. [Name], this is [Your Name] from Ashford Creative. We work with therapists in [City] to help them get found online — but honestly, before I say anything else, I'd love to hear how your practice is going right now. Are you finding it easy to get new clients, or is that something you're actively working on?"`,
    pivot: `"That makes sense. [Paraphrase what they said back to them.] A lot of the practitioners we work with felt the same way until they saw how different it is to have their own site versus a directory profile. The biggest thing is owning the URL — it's yours forever, unlike renting space on someone else's platform."`,
    close: `"I won't take up more of your time — I know you're busy. What if I put together a quick visual mockup of what your site could look like, completely free? You can share it with anyone you want and tell me what you think."`,
    watchOut: "Don't rush. If they're thoughtful and deliberate, being high-energy will feel off. Match their pace exactly. If they speak slowly and carefully, do the same.",
    tip: "Use their name exactly as they introduce themselves. If they say 'Dr. Smith', use Dr. Smith. If they say 'Call me Maria', use Maria. This alone builds more trust than most pitches.",
  },
  {
    id: "direct",
    name: "The Direct Closer",
    tagline: "Respect their time. Get to the point. Ask fast, close fast.",
    bestFor: "Busy group practice owners, psychiatrists, or practitioners who cut you off early. People who say 'I only have 2 minutes' and mean it.",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
    approach: "State the value in one sentence. Ask for the preview. Don't over-explain. These prospects respect efficiency — the longer you talk, the more trust you lose.",
    opener: `"Dr. [Name], 30 seconds — we build professional websites for therapists in Texas for $199 a month, no contract, live in 48 hours. Most of the practices we work with were on Psychology Today before. Can I send you a free personalized preview of what your site would look like?"`,
    pivot: `[If they say yes]: "Perfect. What's the best number for a text? I'll have it over to you by end of day." [If they say 'tell me more']: "Plan A is $0 setup — we pick the domain, build the site, handle hosting. You just answer 15 minutes of onboarding questions. That's it."`,
    close: `"Do you want me to put together the preview? Takes us about 20 minutes on our end, costs you nothing. If you like it, great. If not, no hard feelings."`,
    watchOut: "Don't confuse directness with rushing. If they want to ask a question, stop and answer fully. The 'direct' energy is about respecting their time, not steamrolling them.",
    tip: "If they say 'I'm interested but not right now,' book a specific callback before you hang up. 'Is [day] at [time] a good time to circle back?' A time on the calendar is worth 10 follow-up texts.",
  },
  {
    id: "demo_first",
    name: "The Demo-First",
    tagline: "Skip the pitch. Show the product. Let the preview close the deal.",
    bestFor: "Visual thinkers. Practitioners who are skeptical of 'what it could look like' claims but will believe it when they see it. Also great for anyone who's said 'just send me something.'",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
    approach: "Don't sell the concept — sell the preview. Get permission to send the mockup as fast as possible. The preview does the selling for you.",
    opener: `"Dr. [Name], quick one — we put together personalized website mockups for therapists in [City] at no charge. I can build one using your name, specialty, and city and send it to you today. Would it be okay if I texted you a link so you can take a look when you have 5 minutes?"`,
    pivot: `[When they ask what you actually sell]: "We build and host the real site for $199 a month — no annual contract, live in 48 hours. But I'd rather just show you first. Once you see it, you'll know immediately whether it's something worth talking about."`,
    close: `"What's the best number for a text? I'll send it over this afternoon and you can share it with anyone you'd like."`,
    watchOut: "Don't send the preview before you have a follow-up plan. Always say: 'I'll send it now — and I'll follow up in 24 hours to see what you think. Is morning or afternoon better for a quick call?'",
    tip: "After sending the preview, your follow-up text should be: 'Hey [Name], just sent the preview to [number]. Link is [link]. Quick question: what's your favorite design out of the three?' Asking a specific question is 3× more likely to get a reply than 'let me know what you think.'",
  },
  {
    id: "challenger",
    name: "The Challenger",
    tagline: "Challenge their assumptions. Make them think differently about their online presence.",
    bestFor: "Confident practitioners who think they have their marketing figured out. 'I have a website already' or 'I get all my clients from referrals.'",
    color: "text-rose-700",
    bgColor: "bg-rose-50 border-rose-200",
    approach: "Don't back down from their objection — use it. Reframe their existing assumption as the actual problem. Be respectful but direct. Challengers don't apologize for their perspective.",
    opener: `"Dr. [Name], I know you've probably heard this pitch before, so I'll be different — can I ask you one quick question? When a potential client Googles you tonight, what comes up? … [Let them answer.] Here's what I've seen with a lot of practices: even if you have a site, if it's not built for search in 2026, it's essentially invisible. Your Psychology Today profile outranks your own website in most cases."`,
    pivot: `"The reason we exist is because we build sites that are specifically structured to outrank directory profiles in local search. We've done it for practices across Texas. It's not magic — it's the right domain, the right structure, and the right content. $199 a month, no contract."`,
    close: `"I'm happy to be wrong — let me put together a preview and you can decide for yourself. If your current setup is doing what you need, you'll know in about 5 minutes. What's the best number to send the link?"`,
    watchOut: "The Challenger only works if you're confident and the prospect senses you genuinely believe what you're saying. If you're second-guessing yourself, they'll feel it. Own the perspective.",
    tip: "If they say 'I already have a website,' ask: 'Can I look it up right now while we talk? I want to see how it shows up in search.' Then open it, describe what you see, and show them exactly what's missing.",
  },
  {
    id: "social_proof",
    name: "The Social Mirror",
    tagline: "Peers are the most powerful sales tool. Use them.",
    bestFor: "Practitioners who are community-minded, active in NASW or LPC associations, or who respond well to 'others like you are doing this.'",
    color: "text-teal-700",
    bgColor: "bg-teal-50 border-teal-200",
    approach: "Reference real or representative peers without revealing client information. Make the practitioner feel like they're joining something, not buying something. FOMO done respectfully.",
    opener: `"Dr. [Name], I'm reaching out because we've recently launched sites for a few other [specialty] practices in [City] and the response has been really strong — practitioners are getting found in ways they weren't before with just a directory profile. I thought you might want to see what that looks like for your practice specifically."`,
    pivot: `"What we've found is that the practices that get the most out of it are the ones where the practitioner has a clear specialty — [compliment their specialty or focus area if you know it]. A site lets you speak to exactly the kind of client you want to work with, rather than being generic."`,
    close: `"A few of the therapists we've launched said they wished they'd done it sooner. I'd love to put together a free preview for your practice — nothing to commit to, just so you can see what it would look like. Can I send it over today?"`,
    watchOut: "Never fabricate specifics. Don't say 'Dr. Smith in Austin' if you don't have a real reference. Use 'several practices in [city]' or 'a group practice we recently launched' — that's honest and still effective.",
    tip: "If they ask 'can I talk to someone you've worked with?' — treat that as a buying signal, not a roadblock. Say: 'Absolutely, let me check with a few clients. In the meantime, let me send you the preview so you can see the work quality yourself.' Then follow up.",
  },
];

function PlayCard({ play }: { play: Play }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden ${play.bgColor}`}>
      <button
        type="button"
        className="w-full p-5 text-left flex items-start justify-between gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className={`font-serif text-xl mb-1 ${play.color}`}>{play.name}</div>
          <p className="text-sm text-foreground/80 leading-relaxed">{play.tagline}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            <strong>Best for:</strong> {play.bestFor}
          </div>
        </div>
        <div className="shrink-0 mt-1 text-muted-foreground">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-current/10 pt-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">The Approach</div>
            <p className="text-sm text-foreground/80 leading-relaxed">{play.approach}</p>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Opener</div>
            <div className="bg-white/70 border border-current/10 rounded-lg p-3 text-sm text-foreground/80 leading-relaxed italic">
              {play.opener}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Pivot to the Product</div>
            <div className="bg-white/70 border border-current/10 rounded-lg p-3 text-sm text-foreground/80 leading-relaxed italic">
              {play.pivot}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">The Ask</div>
            <div className="bg-white/70 border border-current/10 rounded-lg p-3 text-sm text-foreground/80 leading-relaxed italic">
              {play.close}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Watch Out For</div>
              <p className="text-xs text-foreground/70 leading-relaxed">{play.watchOut}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs font-medium text-amber-700 mb-1">Pro tip</div>
              <p className="text-xs text-amber-800 leading-relaxed">{play.tip}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayCards() {
  const [location] = useLocation();
  const backHref = location.startsWith("/kb") ? "/kb" : "/resources";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back
      </Link>

      <PageHeader
        title="Play Cards"
        description="Six proven approach styles. Read your prospect, pick your play, close the deal."
      />

      <div className="bg-primary text-primary-foreground rounded-xl p-5 mb-6">
        <div className="font-serif text-lg mb-1">Every rep has a default style. The best reps have all six.</div>
        <p className="text-sm text-primary-foreground/80 leading-relaxed">
          You don't need to memorize these word-for-word. Read through them once, find the one that feels most natural, and use that on your first 20 calls. Then experiment with the others. The rep who can switch styles mid-call — that's who closes the most deals.
        </p>
      </div>

      <div className="space-y-3">
        {PLAYS.map((play) => (
          <PlayCard key={play.id} play={play} />
        ))}
      </div>
    </div>
  );
}
