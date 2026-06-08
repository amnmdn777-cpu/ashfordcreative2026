import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MessageSquare, X, Send, ChevronLeft, ArrowUpRight } from "lucide-react";
import { useChatbot } from "./ChatbotProvider";
import { useI18n } from "@site/lib/i18n";
import { translations, type StringKey } from "@site/lib/strings";
import { SCRIPT } from "@site/chatbot/script";
import { api } from "@site/lib/api";
import { DomainCard } from "./DomainCard";
import { domainsApi } from "@site/lib/domains";
import type { DomainOffer } from "@workspace/api-zod";

interface BotTurn {
  who: "bot" | "user";
  text: string;
}

// Inline artifacts produced by the freeform-intent path. The
// `domain_suggest` path was removed on 2026-04-28 — domain selection
// is a sales-only conversation now (the rep proposes a name during
// onboarding), so the prospect chatbot only confirms availability of a
// FQDN the visitor types in directly.
type IntentArtifact = { kind: "domain_check"; offer: DomainOffer };

// Heuristic FQDN matcher anchored on a 2+ alpha TLD.
const DOMAIN_REGEX = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})+)\b/i;

// EN+ES keywords that route to the seeded picker when no FQDN was typed.
const DOMAIN_INTENT_WORDS = [
  "domain",
  "domains",
  "url",
  "website name",
  "available",
  "free",
  "dominio",
  "dominios",
  "disponible",
  "gratis",
];

function detectDomainIntent(text: string): {
  kind: "check" | "suggest" | "none";
  domain?: string;
  seed?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "none" };
  const m = trimmed.match(DOMAIN_REGEX);
  if (m) return { kind: "check", domain: m[1].toLowerCase() };
  const lower = trimmed.toLowerCase();
  if (DOMAIN_INTENT_WORDS.some((w) => lower.includes(w))) {
    // Strip the intent words from the seed so "domains for Bright Path" → "Bright Path".
    let seed = trimmed;
    for (const w of DOMAIN_INTENT_WORDS) {
      seed = seed.replace(new RegExp(`\\b${w}\\b`, "ig"), " ");
    }
    seed = seed
      .replace(/\b(for|para|my|mi|the|el|la|a|of|de)\b/gi, " ")
      .replace(/[?¿!¡.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { kind: "suggest", seed: seed || trimmed };
  }
  return { kind: "none" };
}

function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function tr(text: string, locale: "en" | "es") {
  // If `text` matches a translation key, translate; otherwise use literal.
  const dict: Record<string, string> = translations[locale] as Record<
    string,
    string
  >;
  return dict[text] ?? text;
}

export function ChatbotWidget() {
  const { isOpen, open, close } = useChatbot();
  const { t, locale } = useI18n();
  const [, navigate] = useLocation();
  const [nodeId, setNodeId] = useState("start");
  const [turns, setTurns] = useState<BotTurn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [intentArtifacts, setIntentArtifacts] = useState<IntentArtifact[]>([]);
  const [intentLoading, setIntentLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    practice: "",
    email: "",
    phone: "",
    preferredContact: "callback" as "callback" | "sms" | "email",
    message: "",
    bestTimeToReach: "",
    smsConsent: false,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen && turns.length === 0) {
      const node = SCRIPT.start;
      if (node.kind === "message") {
        setTurns([{ who: "bot", text: tr(node.bot as string, locale) }]);
      }
    }
  }, [isOpen, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, nodeId]);

  function handleReply(label: string, goto?: string, link?: string) {
    const labelText = tr(label, locale);
    if (link) {
      setTurns((prev) => [...prev, { who: "user", text: labelText }]);
      navigate(link);
      close();
      return;
    }
    if (!goto) return;
    const next = SCRIPT[goto];
    if (!next) return;
    const nextTurns: BotTurn[] = [
      ...turns,
      { who: "user", text: labelText },
      { who: "bot", text: tr(next.bot as string, locale) },
    ];
    setTurns(nextTurns);
    setNodeId(goto);
  }

  function reset() {
    setNodeId("start");
    setTurns([{ who: "bot", text: tr("cb_greeting", locale) }]);
    setSubmitted(false);
    setError(null);
    setIntentArtifacts([]);
  }

  // Freeform input: detect domain intent and either run a live check
  // (FQDN typed), mount an inline picker (seed-only), or fall back to
  // a help-menu reply. All paths pass surface="chatbot".
  async function handleFreeText(e: React.FormEvent) {
    e.preventDefault();
    const text = freeText.trim();
    if (!text || intentLoading) return;
    setFreeText("");
    setTurns((prev) => [...prev, { who: "user", text }]);
    let intent = detectDomainIntent(text);

    // When the user is parked on the dedicated domain_check node, the
    // bot has just asked for a practice name. The free-form check input
    // inside DomainPicker was removed on 2026-04-27 (suggestions-only
    // flow), so we now route ANY free text on that node into a seeded
    // suggest call — even when the heuristic intent matcher would have
    // returned "none" because the user simply typed "Bright Path"
    // without any domain keywords.
    if (intent.kind === "none" && node?.id === "domain_check") {
      intent = { kind: "suggest", seed: text };
    }

    if (intent.kind === "check" && intent.domain) {
      const domain = intent.domain;
      setIntentLoading(true);
      try {
        const offer = await domainsApi.check(domain, "chatbot");
        const retail = `$${offer.retailPrice.amount
          .toFixed(2)
          .replace(/\.00$/, "")}`;
        const surcharge = offer.premiumSurcharge
          ? `$${offer.premiumSurcharge.amount.toFixed(2).replace(/\.00$/, "")}`
          : "";
        const replyKey =
          offer.status === "available"
            ? "cb_intent_domain_available"
            : offer.status === "premium"
            ? "cb_intent_domain_premium"
            : offer.status === "taken"
            ? "cb_intent_domain_taken"
            : "cb_intent_domain_invalid";
        setTurns((prev) => [
          ...prev,
          {
            who: "bot",
            text: fmt(t(replyKey), { domain, retail, surcharge }),
          },
        ]);
        if (offer.status === "available" || offer.status === "premium") {
          setIntentArtifacts((prev) => [
            ...prev,
            { kind: "domain_check", offer },
          ]);
        }
        // No follow-up artifact for "taken" / "invalid" — a sales rep
        // proposes the actual practice domain during onboarding, so the
        // chatbot only confirms availability of names the visitor types
        // in directly. The textual reply above already explains the
        // result.
      } catch {
        setTurns((prev) => [
          ...prev,
          {
            who: "bot",
            text: fmt(t("cb_intent_domain_invalid"), { domain }),
          },
        ]);
      } finally {
        setIntentLoading(false);
      }
      return;
    }

    if (intent.kind === "suggest") {
      // Seeded suggestions ("domains for Bright Path") used to mount an
      // inline DomainPicker. Removed on 2026-04-28 — domain selection is
      // sales-only now. We keep the conversational acknowledgement so
      // the visitor knows the question landed, and we steer them to the
      // human rep who'll propose names during onboarding.
      setTurns((prev) => [
        ...prev,
        { who: "bot", text: t("cb_intent_domain_sales_only") },
      ]);
      return;
    }

    setTurns((prev) => [
      ...prev,
      { who: "bot", text: t("cb_intent_domain_no_match") },
    ]);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const phoneEntered = form.phone.trim().length > 0;
    if (!form.name.trim() || (!form.email.trim() && !phoneEntered)) {
      setError(t("error_generic"));
      return;
    }
    // TCR consent gate. The phone-bearing branch must include a ticked
    // checkbox AND the verbatim disclosure paragraph; mirrors the
    // server-side check so users see a helpful inline error rather than
    // an opaque 400.
    const phone = form.phone.trim();
    if (phone && !form.smsConsent) {
      setError(t("sms_consent_required_error"));
      return;
    }
    setSubmitting(true);
    try {
      await api.createContactRequest({
        source: "chatbot",
        name: form.name.trim(),
        practice: form.practice.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: phone || undefined,
        preferredContact: form.preferredContact,
        message: form.message.trim() || undefined,
        bestTimeToReach: form.bestTimeToReach.trim() || undefined,
        // Persist consent + verbatim disclosure when a phone is given.
        // The API enforces this pairing server-side; the snapshot we
        // pass here is the exact canonical paragraph rendered just
        // above the checkbox so the TCR audit record matches what was
        // shown.
        smsConsent: phone ? form.smsConsent : undefined,
        smsConsentText:
          phone && form.smsConsent ? t("sms_consent_disclosure") : undefined,
      });
      setSubmitted(true);
      setTurns((tr) => [...tr, { who: "bot", text: t("cb_thanks") }]);
    } catch (err) {
      setError(t("cb_error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={open}
        // Lifted above the CrisisFloatingButton so the two fixed-bottom
        // elements stop overlapping (founder report 2026-04-28). The
        // crisis pill anchors at `bottom-4` and is roughly 56–60px tall,
        // so we sit the launcher at `bottom-24` (96px) — leaves a clean
        // ~24px gap whether the crisis bar is collapsed (44px lifebuoy
        // button) or in its default pill state. When the crisis bar is
        // fully expanded with call/text actions the panel still owns
        // the corner, but at that moment the user is actively engaging
        // with crisis resources and the chat launcher should defer.
        className="fixed bottom-24 right-6 z-50 bg-ink text-cream rounded-full pl-4 pr-5 py-3 flex items-center gap-2 shadow-lg hover:bg-sage-light transition-all"
        aria-label={t("cb_open")}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-sm font-medium">{t("cb_open")}</span>
      </button>
    );
  }

  const node = SCRIPT[nodeId];
  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] max-w-md bg-cream border border-ink/15 shadow-2xl rounded-md flex flex-col"
      style={{ height: "min(620px, calc(100vh - 2rem))" }}>
      <div className="flex items-center justify-between p-4 border-b border-ink/10 bg-ink text-cream rounded-t-md">
        <div className="flex items-center gap-2">
          {nodeId !== "start" && !submitted && (
            <button
              onClick={reset}
              className="p-1 hover:bg-cream/10 rounded"
              aria-label={t("cb_back")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="font-display text-lg leading-none">Ashford</div>
            <div className="text-[10px] font-mono tracking-widest text-gold">CHAT</div>
          </div>
        </div>
        <button
          onClick={close}
          className="p-1 hover:bg-cream/10 rounded"
          aria-label={t("cb_close")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 py-2 bg-cream-warm border-b border-ink/10 text-[10.5px] text-ink/60 leading-snug">
        {t("cb_phi_disclaimer")}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {turns.map((m, i) => (
          <div
            key={i}
            className={
              m.who === "bot"
                ? "bg-paper border border-ink/10 rounded-lg p-3 text-sm text-ink/90 max-w-[85%]"
                : "bg-sage text-cream rounded-lg p-3 text-sm ml-auto max-w-[85%]"
            }
          >
            {m.text}
          </div>
        ))}

        {node?.kind === "message" && !submitted && (
          <div className="pt-2 space-y-2">
            {node.replies.map((r, i) => (
              <button
                key={i}
                onClick={() => handleReply(r.label as string, r.goto, r.link)}
                className="w-full text-left text-sm border border-sage/40 hover:border-sage hover:bg-sage/5 text-sage-light px-3 py-2 rounded-md transition-colors flex items-center justify-between gap-2"
              >
                <span>{tr(r.label as string, locale)}</span>
                {r.link && <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
              </button>
            ))}
          </div>
        )}

        {node?.kind === "domain" && !submitted && (
          <div className="pt-2 space-y-3">
            {/* The seedless DomainPicker that used to live here was a
                free-form check input the prospect typed into. It was
                removed on 2026-04-27 (suggestions-only flow). The
                bot's `cb_domain_prompt` now invites the user to type
                their practice name into the persistent freeform input
                at the bottom — handleFreeText special-cases this node
                so any text becomes a seeded suggest. The resulting
                seeded picker renders below the reply buttons via
                intentArtifacts. */}
            <div className="space-y-2 pt-1">
              {node.replies.map((r, i) => (
                <button
                  key={i}
                  onClick={() =>
                    handleReply(r.label as string, r.goto, r.link)
                  }
                  className="w-full text-left text-sm border border-sage/40 hover:border-sage hover:bg-sage/5 text-sage-light px-3 py-2 rounded-md transition-colors flex items-center justify-between gap-2"
                >
                  <span>{tr(r.label as string, locale)}</span>
                  {r.link && (
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {node?.kind === "form" && !submitted && (
          <form onSubmit={submitForm} className="space-y-2 pt-2">
            <input
              required
              placeholder={t("cb_form_name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
            />
            <input
              placeholder={t("cb_form_practice")}
              value={form.practice}
              onChange={(e) => setForm({ ...form, practice: e.target.value })}
              className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
            />
            <input
              type="email"
              placeholder={t("cb_form_email")}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
            />
            <input
              type="tel"
              placeholder={t("cb_form_phone")}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
            />
            {/* TCR-grade SMS consent. Hidden until a phone is filled to
                avoid scolding the email-only path. The disclosure
                paragraph above the box is what we ship to the server as
                `smsConsentText` — verbatim, single source of truth. */}
            {form.phone.trim() && (
              <div
                data-testid="cb-sms-consent-block"
                className="border border-ink/15 bg-cream/60 rounded-md p-2.5 space-y-2 mt-1"
              >
                <p
                  data-testid="cb-sms-disclosure"
                  className="text-[10.5px] leading-snug text-ink/70"
                >
                  {t("sms_consent_disclosure")}
                </p>
                <label className="flex items-start gap-2 cursor-pointer text-[11px] text-ink/85 leading-snug">
                  <input
                    type="checkbox"
                    data-testid="cb-sms-consent"
                    checked={form.smsConsent}
                    onChange={(e) =>
                      setForm({ ...form, smsConsent: e.target.checked })
                    }
                    className="mt-0.5 w-3.5 h-3.5 accent-sage shrink-0"
                  />
                  <span>{t("sms_consent_label")}</span>
                </label>
              </div>
            )}
            <div className="text-xs text-ink/70 pt-1">{t("cb_form_pref")}</div>
            <div className="flex gap-2">
              {(["callback", "sms", "email"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() =>
                    setForm({ ...form, preferredContact: p })
                  }
                  className={
                    "flex-1 py-1.5 text-xs rounded-md border transition-colors " +
                    (form.preferredContact === p
                      ? "bg-sage text-cream border-sage"
                      : "bg-paper text-ink/70 border-ink/15 hover:border-sage/50")
                  }
                >
                  {t(("cb_form_pref_" + p) as StringKey)}
                </button>
              ))}
            </div>
            <input
              placeholder={t("cb_form_time")}
              value={form.bestTimeToReach}
              onChange={(e) =>
                setForm({ ...form, bestTimeToReach: e.target.value })
              }
              className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
            />
            <textarea
              placeholder={t("cb_form_message")}
              rows={2}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage resize-none"
            />
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-ink text-cream text-sm font-medium rounded-md hover:bg-sage-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? t("sending") : (<><Send className="w-4 h-4" />{t("cb_form_submit")}</>)}
            </button>
          </form>
        )}

        {/* Inline artifacts produced by the freeform-intent path. Rendered
            after node-driven UI so the conversation flows top-to-bottom.
            We only show the offer card here — the seeded picker (for
            "domains for X" queries) was retired with the prospect-facing
            DomainPicker on 2026-04-28. */}
        {intentArtifacts.map((a, i) => (
          <div key={`ic-${i}`} data-testid="cb-intent-domain-check">
            <DomainCard offer={a.offer} />
          </div>
        ))}
      </div>

      {/* Persistent freeform input. Always present so the prospect can
          break out of the scripted branches and ask in their own words —
          the intent router catches domain questions and short-circuits
          to the live registrar. */}
      {!submitted && (
        <form
          onSubmit={handleFreeText}
          className="border-t border-ink/10 p-3 flex items-center gap-2"
        >
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={t("cb_input_placeholder")}
            data-testid="cb-freetext-input"
            className="flex-1 px-3 py-2 border border-ink/15 bg-paper text-sm rounded-md focus:outline-none focus:border-sage"
          />
          <button
            type="submit"
            disabled={!freeText.trim() || intentLoading}
            aria-label={t("cb_send")}
            className="p-2 bg-ink text-cream rounded-md hover:bg-sage-light transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
