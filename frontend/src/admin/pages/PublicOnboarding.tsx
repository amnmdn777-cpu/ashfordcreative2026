import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import {
  TEMPLATES,
  PALETTES,
  TIERS,
  TierKey,
  type ContentSubmission,
  type TemplateKey,
} from "@workspace/api-zod";

const isTierKey = (v: unknown): v is TierKey =>
  v === "boutique" || v === "boutique_pro" || v === "boutique_concierge";
import { api, fmtCents } from "@admin/lib/api";

type Step = "consent" | "content" | "design" | "done";

export default function PublicOnboardingPage() {
  const [match, params] = useRoute<{ token: string }>("/onboarding/:token");
  const token = match ? params.token : null;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public", "onboarding", token],
    queryFn: () => api.publicOnboarding(token!),
    enabled: !!token,
  });

  const status = data?.onboarding.status;
  const step: Step = useMemo(() => {
    if (!status) return "consent";
    if (status === "pending") return "consent";
    if (status === "consent_recorded") return "content";
    if (status === "content_collected") return "design";
    return "done";
  }, [status]);

  if (!token) {
    return <Centered title="Invalid link" body="This onboarding link is missing a token." />;
  }
  if (isLoading) {
    return (
      <Centered
        title="Loading your onboarding…"
        body={<Loader2 className="animate-spin mx-auto mt-4" />}
      />
    );
  }
  if (error) {
    return (
      <Centered
        title="We couldn't load your onboarding"
        body={
          <p className="text-sm">
            {error instanceof Error ? error.message : "Try the link again, or contact support."}
          </p>
        }
      />
    );
  }
  if (!data) return null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["public", "onboarding", token] });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <div className="font-serif text-xl">Ashford Creative</div>
            <div className="text-xs uppercase tracking-widest text-accent">
              Welcome — let's build your site
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground hidden sm:block">
              {/* sale.planKey is typed as the shim's "A"|"B" union, but the
                  Phase 1A enum migration means it now carries TierKey
                  values at runtime. Cast to string for the runtime guard. */}
              {(() => {
                const rawPlan: string = data.sale.planKey as unknown as string;
                return isTierKey(rawPlan)
                  ? TIERS[rawPlan].label
                  : `Plan ${rawPlan}`;
              })()}
              {" · "}
              {fmtCents(data.sale.monthlyAmountCents)}/mo
            </div>
            <ManageBillingButton token={token} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <Stepper current={step} />

        {step === "consent" && (
          <ConsentStep token={token} onDone={refresh} />
        )}
        {step === "content" && <ContentStep token={token} onDone={refresh} />}
        {step === "design" && (
          <DesignStep
            token={token}
            tierKey={(() => {
              const rawPlan: string = data.sale.planKey as unknown as string;
              return isTierKey(rawPlan) ? rawPlan : "boutique";
            })()}
            onDone={refresh}
          />
        )}
        {step === "done" && (
          <Centered
            title="🎉 You're all set"
            body={
              <p className="text-sm text-muted-foreground">
                Our team has everything they need. We'll email you when your site preview is
                ready (usually within 5 business days).
              </p>
            }
            inline
          />
        )}
      </div>
    </div>
  );
}

function ManageBillingButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { url } = await api.openBillingPortal(token);
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to open billing portal");
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {err && <div className="text-[11px] text-destructive max-w-[16rem] text-right">{err}</div>}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "consent", label: "Consent" },
    { key: "content", label: "Content" },
    { key: "design", label: "Design" },
    { key: "done", label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={`grid place-items-center w-7 h-7 rounded-full text-xs border ${
                done
                  ? "bg-primary text-primary-foreground border-primary"
                  : active
                  ? "bg-card border-primary text-primary"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              {done ? <Check size={14} /> : i + 1}
            </div>
            <span
              className={`text-xs uppercase tracking-wide ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ConsentStep({ token, onDone }: { token: string; onDone: () => void }) {
  const [consent, setConsent] = useState<boolean | null>(null);
  const m = useMutation({
    mutationFn: (c: boolean) => api.scrapeConsent(token, c),
    onSuccess: () => onDone(),
  });
  return (
    <Card title="Can we look at your existing site?">
      <p className="text-sm text-muted-foreground mb-4">
        If you have an existing website, we can scrape its public content (hours, services, team,
        bios) to save you time. We only read pages that are already public — never anything
        behind a login.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setConsent(true);
            m.mutate(true);
          }}
          disabled={m.isPending}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {m.isPending && consent === true ? "Saving…" : "Yes, please scrape it"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConsent(false);
            m.mutate(false);
          }}
          disabled={m.isPending}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
        >
          {m.isPending && consent === false ? "Saving…" : "No, I'll provide content myself"}
        </button>
      </div>
      {m.error && (
        <div className="text-sm text-destructive mt-3">
          {m.error instanceof Error ? m.error.message : "Failed to save"}
        </div>
      )}
    </Card>
  );
}

const EMPTY_CONTENT: ContentSubmission = {
  practiceName: "",
  tagline: "",
  about: "",
  services: [""],
  modalities: [],
  insurances: [],
  contact: { phone: "", email: "", address: "" },
  bookingUrl: undefined,
  team: [],
};

function ContentStep({ token, onDone }: { token: string; onDone: () => void }) {
  const [c, setC] = useState<ContentSubmission>(EMPTY_CONTENT);
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: (body: ContentSubmission) => api.submitContent(token, body),
    onSuccess: () => onDone(),
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  const setField = <K extends keyof ContentSubmission>(k: K, v: ContentSubmission[K]) =>
    setC((s) => ({ ...s, [k]: v }));

  const setService = (i: number, v: string) => {
    const next = [...c.services];
    next[i] = v;
    setField("services", next);
  };

  const submit = () => {
    setError(null);
    const payload: ContentSubmission = {
      ...c,
      tagline: c.tagline || undefined,
      services: c.services.map((s) => s.trim()).filter(Boolean),
      modalities: (c.modalities ?? []).map((s) => s.trim()).filter(Boolean),
      insurances: (c.insurances ?? []).map((s) => s.trim()).filter(Boolean),
      contact: {
        phone: c.contact.phone.trim(),
        email: c.contact.email?.trim() || undefined,
        address: c.contact.address?.trim() || undefined,
      },
      bookingUrl: c.bookingUrl?.trim() || undefined,
      team: (c.team ?? []).filter((t) => t.name?.trim()),
    };
    if (payload.services.length === 0) {
      setError("Add at least one service.");
      return;
    }
    if (payload.about.trim().length < 20) {
      setError("Tell us a little more about your practice (at least 20 characters).");
      return;
    }
    m.mutate(payload);
  };

  const csv = (s: string[] | undefined) => (s ?? []).join(", ");
  const fromCsv = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <Card title="Tell us about your practice">
      <div className="space-y-4">
        <Row label="Practice name *">
          <input
            required
            value={c.practiceName}
            onChange={(e) => setField("practiceName", e.target.value)}
            className={INPUT}
          />
        </Row>
        <Row label="Tagline (1 sentence)">
          <input
            value={c.tagline ?? ""}
            onChange={(e) => setField("tagline", e.target.value)}
            className={INPUT}
            placeholder="Compassionate therapy for Austin's helpers."
          />
        </Row>
        <Row label="About your practice * (3–5 paragraphs)">
          <textarea
            required
            rows={6}
            value={c.about}
            onChange={(e) => setField("about", e.target.value)}
            className={INPUT}
          />
        </Row>
        <Row label="Services *">
          <div className="space-y-2">
            {c.services.map((s, i) => (
              <input
                key={i}
                value={s}
                onChange={(e) => setService(i, e.target.value)}
                placeholder={`Service ${i + 1}`}
                className={INPUT}
              />
            ))}
            <button
              type="button"
              onClick={() => setField("services", [...c.services, ""])}
              className="text-xs text-primary hover:underline"
            >
              + Add service
            </button>
          </div>
        </Row>
        <Row label="Modalities (comma-separated)">
          <input
            value={csv(c.modalities)}
            onChange={(e) => setField("modalities", fromCsv(e.target.value))}
            placeholder="CBT, EMDR, ACT"
            className={INPUT}
          />
        </Row>
        <Row label="Insurances accepted (comma-separated)">
          <input
            value={csv(c.insurances)}
            onChange={(e) => setField("insurances", fromCsv(e.target.value))}
            placeholder="BCBS, Aetna, self-pay"
            className={INPUT}
          />
        </Row>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Row label="Phone *">
            <input
              required
              value={c.contact.phone}
              onChange={(e) =>
                setField("contact", { ...c.contact, phone: e.target.value })
              }
              className={INPUT}
            />
          </Row>
          <Row label="Email">
            <input
              type="email"
              value={c.contact.email ?? ""}
              onChange={(e) =>
                setField("contact", { ...c.contact, email: e.target.value })
              }
              className={INPUT}
            />
          </Row>
        </div>
        <Row label="Address (street, city, zip)">
          <input
            value={c.contact.address ?? ""}
            onChange={(e) =>
              setField("contact", { ...c.contact, address: e.target.value })
            }
            className={INPUT}
          />
        </Row>
        <Row label="Booking link (Calendly, etc.)">
          <input
            type="url"
            value={c.bookingUrl ?? ""}
            onChange={(e) => setField("bookingUrl", e.target.value)}
            placeholder="https://calendly.com/your-practice"
            className={INPUT}
          />
        </Row>

        <div>
          <div className="text-sm font-medium mb-2">Team members (optional)</div>
          {(c.team ?? []).map((t, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2 bg-muted/30 rounded p-2"
            >
              <input
                placeholder="Name"
                value={t.name}
                onChange={(e) => {
                  const next = [...(c.team ?? [])];
                  next[i] = { ...t, name: e.target.value };
                  setField("team", next);
                }}
                className={INPUT}
              />
              <input
                placeholder="Title"
                value={t.title ?? ""}
                onChange={(e) => {
                  const next = [...(c.team ?? [])];
                  next[i] = { ...t, title: e.target.value };
                  setField("team", next);
                }}
                className={INPUT}
              />
              <input
                placeholder="Short bio"
                value={t.bio ?? ""}
                onChange={(e) => {
                  const next = [...(c.team ?? [])];
                  next[i] = { ...t, bio: e.target.value };
                  setField("team", next);
                }}
                className={INPUT}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setField("team", [...(c.team ?? []), { name: "" }])}
            className="text-xs text-primary hover:underline"
          >
            + Add team member
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive mt-3">{error}</div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={m.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {m.isPending ? "Saving…" : "Continue to design"} <ChevronRight size={14} />
        </button>
      </div>
    </Card>
  );
}

function DesignStep({
  token,
  tierKey: initialTierKey,
  onDone,
}: {
  token: string;
  // Customer's currently-purchased tier — surfaces as the default
  // selection so the admin sees the same tier the prospect agreed to.
  // Phase 1B-c rewires the finalize endpoint to accept tier changes.
  tierKey: TierKey;
  onDone: () => void;
}) {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("garden");
  const [paletteKey, setPaletteKey] = useState<string>(
    TEMPLATES.garden!.paletteKeys[0]!,
  );
  const [selectedTier, setSelectedTier] = useState<TierKey>(initialTierKey);

  useEffect(() => {
    const tpl = TEMPLATES[templateKey];
    if (!tpl) return;
    if (!tpl.paletteKeys.includes(paletteKey)) {
      const first = tpl.paletteKeys[0];
      if (first) setPaletteKey(first);
    }
  }, [templateKey, paletteKey]);

  const monthlyTotal = TIERS[selectedTier].monthlyCents;

  const m = useMutation({
    mutationFn: () =>
      api.finalizeOnboarding(token, {
        templateKey,
        paletteKey: paletteKey as any,
        // Phase 1B-b: finalize endpoint still accepts an addon list for
        // backwards compatibility, but with tier-based pricing every new
        // sale ships an empty array (tiers don't compose addons).
        selectedAddons: [],
      }),
    onSuccess: () => onDone(),
  });

  return (
    <Card title="Pick your design">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-medium mb-3">Template</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.values(TEMPLATES).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplateKey(t.key)}
                className={`text-left rounded-lg p-4 border transition-colors ${
                  templateKey === t.key
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="font-serif text-lg">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.font}</div>
                <p className="text-xs text-muted-foreground mt-2">{t.description}</p>
              </button>
            ))}
          </div>
          {TEMPLATES[templateKey]?.voiceHint && (
            <VoiceHintBlock templateKey={templateKey} />
          )}
        </div>

        <div>
          <div className="text-sm font-medium mb-3">Palette</div>
          <div className="grid grid-cols-3 gap-3">
            {(TEMPLATES[templateKey]?.paletteKeys ?? []).map((pk: string) => {
              const p = PALETTES[pk];
              if (!p) return null;
              const active = paletteKey === pk;
              return (
                <button
                  key={pk}
                  type="button"
                  onClick={() => setPaletteKey(pk)}
                  className={`text-left rounded-lg overflow-hidden border transition-colors ${
                    active ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                >
                  <div className="flex h-10">
                    <span style={{ background: p.primary }} className="flex-1" />
                    <span style={{ background: p.accent }} className="flex-1" />
                    <span style={{ background: p.surface }} className="flex-1" />
                    <span style={{ background: p.ink }} className="flex-1" />
                  </div>
                  <div className="px-3 py-2 text-xs">
                    <div className="font-medium">{p.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-3">Tier</div>
          {/* Phase 1B-b: admin sees the prospect's currently-purchased
              tier as the default selection (per-prospect snapshot — admin
              sees what customer saw at signup). The picker lets the admin
              preview pricing for a different tier; actual tier changes
              flow through Stripe-side subscription updates in a separate
              flow, not the public-onboarding finalize endpoint. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                "boutique",
                "boutique_pro",
                "boutique_concierge",
              ] as const
            ).map((k) => {
              const tier = TIERS[k];
              const active = selectedTier === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedTier(k)}
                  data-testid={`admin-tier-card-${k}`}
                  className={`relative text-left rounded-lg p-4 border transition-colors ${
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border bg-card hover-elevate"
                  }`}
                >
                  {tier.recommended && (
                    <span className="absolute -top-2 right-3 text-[9px] font-mono uppercase tracking-widest bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  )}
                  <div className="font-serif text-lg">{tier.label}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">
                    {fmtCents(tier.monthlyCents)}/mo
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-snug">
                    {tier.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md bg-secondary p-4">
          <div className="text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              New monthly total
            </div>
            <div className="font-serif text-2xl">{fmtCents(monthlyTotal)}/mo</div>
          </div>
          <button
            type="button"
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {m.isPending ? "Submitting…" : "Submit & finish"}
          </button>
        </div>
        {m.error && (
          <div className="text-sm text-destructive">
            {m.error instanceof Error ? m.error.message : "Failed"}
          </div>
        )}
      </div>
    </Card>
  );
}

function VoiceHintBlock({ templateKey }: { templateKey: TemplateKey }) {
  const tpl = TEMPLATES[templateKey];
  const hint = tpl?.voiceHint?.en;
  if (!tpl || !hint) return null;
  return (
    <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-4">
      <div className="text-xs uppercase tracking-widest text-accent mb-1">
        How to write for {tpl.label}
      </div>
      <p className="text-sm text-foreground/90">{hint.paragraph}</p>
      {hint.examples.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {hint.examples.map((ex, i) => (
            <li
              key={i}
              className="text-xs text-muted-foreground italic before:content-['“'] after:content-['”']"
            >
              {ex}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-card-border rounded-lg p-6 shadow-sm">
      <h2 className="font-serif text-xl mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Centered({
  title,
  body,
  inline,
}: {
  title: string;
  body: React.ReactNode;
  inline?: boolean;
}) {
  const wrapper = inline ? "" : "min-h-screen grid place-items-center bg-background px-4";
  return (
    <div className={wrapper}>
      <div className="bg-card border border-card-border rounded-xl shadow-sm p-8 text-center max-w-md w-full">
        <h1 className="font-serif text-2xl mb-3">{title}</h1>
        <div>{body}</div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const INPUT =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
