import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Mail, Phone, Clock, MapPin, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";
import { api, formatPhone, useContactInfo } from "@site/lib/api";
import { PageCTA } from "@site/components/PageCTA";

type PrefChannel = "callback" | "sms" | "email";

// Investor / partner inquiries route to a typed inbox so they don't pollute
// the rep queue. The address is read from `VITE_PARTNERSHIPS_EMAIL` so ops
// can re-point the link the moment the real `partnerships@` mailbox stands
// up — until then the fallback (`hello@`) keeps the CTA from sending mail
// into the void. To override at build time, set `VITE_PARTNERSHIPS_EMAIL`
// in the site's `.env` (or environment-secrets) before `pnpm build`.
const PARTNERSHIPS_EMAIL =
  (import.meta.env.VITE_PARTNERSHIPS_EMAIL as string | undefined)?.trim() ||
  "hello@ashfordcreative.org";

export default function Contact() {
  const { t, locale } = useI18n();

  // Voice number is server-owned; shared cache with Footer + HelpPanel.
  const { data: contactInfo } = useContactInfo();
  const voicePretty = formatPhone(contactInfo?.voiceNumber ?? null);
  const voiceTel = (contactInfo?.voiceNumber ?? "").replace(/[^\d+]/g, "");

  const [form, setForm] = useState({
    name: "",
    practice: "",
    email: "",
    phone: "",
    preferredContact: "callback" as PrefChannel,
    bestTimeToReach: "",
    message: "",
    smsConsent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneFilled = form.phone.trim().length > 0;
  const disclosure = t("sms_consent_disclosure");

  // The submit button is disabled when phone is filled but consent has
  // not been given. We keep the form openly readable so the user
  // understands what's blocking submission rather than getting an
  // opaque server 400.
  const consentBlocking = phoneFilled && !form.smsConsent;

  const canSubmit = useMemo(() => {
    if (!form.name.trim()) return false;
    if (!form.email.trim() && !form.phone.trim()) return false;
    if (consentBlocking) return false;
    return true;
  }, [form, consentBlocking]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t("contact_form_error_email_or_phone"));
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError(t("contact_form_error_email_or_phone"));
      return;
    }
    if (consentBlocking) {
      setError(t("sms_consent_required_error"));
      return;
    }

    setSubmitting(true);
    try {
      await api.createContactRequest({
        source: "contact_page",
        name: form.name.trim(),
        practice: form.practice.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        preferredContact: form.preferredContact,
        message: form.message.trim() || undefined,
        bestTimeToReach: form.bestTimeToReach.trim() || undefined,
        // Only send the consent payload when the user actually filled
        // a phone number — otherwise these fields are meaningless. The
        // server enforces this same rule, so we mirror it client-side
        // to keep the audit trail clean.
        smsConsent: phoneFilled ? form.smsConsent : undefined,
        smsConsentText: phoneFilled && form.smsConsent ? disclosure : undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === "es"
            ? "Algo salió mal. Inténtalo de nuevo."
            : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Seo
        title={t("contact_seo_title")}
        description={t("contact_seo_desc")}
        path="/contact"
      />

      {/* Hero */}
      <section className="bg-ink text-cream py-24 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[10px] tracking-[0.4em] uppercase text-gold mb-5">
            {t("contact_eyebrow")}
          </div>
          <h1 className="font-display text-[44px] md:text-[64px] leading-tight mb-6">
            {t("contact_title")}
          </h1>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.55] text-cream/80 max-w-3xl">
            {t("contact_subtitle")}
          </p>
          <p className="mt-4 font-mono text-[11px] text-cream/55 leading-snug max-w-3xl">
            {t("pricing_tax_note")}
          </p>
        </div>
      </section>

      <section className="py-20 px-6 lg:px-12 bg-cream">
        <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-12">
          {/* Form */}
          <div className="md:col-span-3">
            {/* Investor / partner escape hatch (Investor roleplay
                2026-05-02 — story I4.) The main form below is shaped
                for therapists (practice name, callback window, SMS
                consent) — an investor doing diligence would either
                fill it out incorrectly or bounce. This thin band
                above the form gives them a one-click mailto to a
                typed inbox so partnerships routes outside the rep
                queue without polluting it. */}
            <a
              href={`mailto:${PARTNERSHIPS_EMAIL}?subject=Investor%2FPartner%20Inquiry`}
              className="block mb-4 bg-ink/[0.03] border border-ink/15 hover:border-ink/35 rounded-sm px-5 py-3 text-sm text-ink/75 hover:text-ink transition-colors"
            >
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gold-deep mr-3">
                {t("contact_investor_banner_label")}
              </span>
              <span className="underline underline-offset-2 decoration-ink/25">
                {t("contact_investor_banner_cta", { email: PARTNERSHIPS_EMAIL })}
              </span>
            </a>
            <div className="bg-paper border border-ink/10 rounded-sm p-8">
              <h2 className="font-display text-2xl text-ink mb-6">
                {t("contact_form_heading")}
              </h2>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-sage/40 bg-sage/10 rounded-sm p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-sage/20 text-sage flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl text-ink mb-2">
                        {t("contact_form_success_title")}
                      </h3>
                      <p className="text-sm text-ink/75 leading-relaxed">
                        {t("contact_form_success_body")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Field
                    label={t("contact_form_name")}
                    required
                    value={form.name}
                    onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                    autoComplete="name"
                  />
                  <Field
                    label={t("contact_form_practice")}
                    value={form.practice}
                    onChange={(v) => setForm((f) => ({ ...f, practice: v }))}
                    autoComplete="organization"
                  />
                  <Field
                    label={t("contact_form_email")}
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    autoComplete="email"
                  />
                  <Field
                    label={t("contact_form_phone")}
                    type="tel"
                    value={form.phone}
                    onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    autoComplete="tel"
                    hint={t("contact_form_phone_hint")}
                  />

                  {/*
                   * SMS consent block. Renders only when a phone number
                   * has actually been filled — pre-rendering the
                   * disclosure when there's no phone would feel
                   * scolding. The disclosure paragraph ABOVE the box
                   * is the verbatim string we ship to the server as
                   * `smsConsentText`, which is also what the
                   * /legal/sms-consent page quotes. Single source of
                   * truth lives in strings.ts.
                   */}
                  {phoneFilled && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border border-ink/15 bg-cream/60 rounded-sm p-4 space-y-3"
                    >
                      <p className="text-[12.5px] leading-[1.55] text-ink/75">
                        {disclosure}
                      </p>
                      <label className="flex items-start gap-3 cursor-pointer text-sm text-ink/85">
                        <input
                          type="checkbox"
                          checked={form.smsConsent}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              smsConsent: e.target.checked,
                            }))
                          }
                          className="mt-1 w-4 h-4 accent-sage"
                          required={phoneFilled}
                        />
                        <span>{t("sms_consent_label")}</span>
                      </label>
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-sm text-ink/70 mb-2">
                      {t("contact_form_pref")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["callback", "cb_form_pref_callback"],
                          ["sms", "cb_form_pref_sms"],
                          ["email", "cb_form_pref_email"],
                        ] as const
                      ).map(([value, labelKey]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, preferredContact: value }))
                          }
                          className={
                            form.preferredContact === value
                              ? "px-4 py-2 text-sm rounded-sm border border-ink bg-ink text-cream"
                              : "px-4 py-2 text-sm rounded-sm border border-ink/20 bg-paper text-ink/75 hover:border-ink/40"
                          }
                        >
                          {t(labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field
                    label={t("contact_form_time")}
                    value={form.bestTimeToReach}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, bestTimeToReach: v }))
                    }
                  />

                  <div>
                    <label className="block text-sm text-ink/70 mb-2">
                      {t("contact_form_message")}
                    </label>
                    <textarea
                      value={form.message}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, message: e.target.value }))
                      }
                      rows={4}
                      maxLength={2000}
                      className="w-full px-3 py-2 text-sm bg-cream border border-ink/20 rounded-sm focus:outline-none focus:border-ink"
                    />
                    <p className="text-xs text-ink/50 mt-1.5 leading-snug">
                      {locale === "es"
                        ? "No comparta información médica de pacientes aquí — use el portal de su EHR."
                        : "Please don't share patient health info here — for those, use your EHR portal."}
                    </p>
                  </div>

                  {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit || submitting}
                    className="w-full px-6 py-3 bg-ink text-cream font-medium rounded-sm hover:bg-ink-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? t("contact_form_sending")
                      : t("contact_form_submit")}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Direct channels */}
          <aside className="md:col-span-2 space-y-6">
            <div className="font-mono text-[10px] tracking-[0.4em] uppercase text-gold-deep">
              {t("contact_other_ways_eyebrow")}
            </div>
            <h2 className="font-display text-2xl text-ink leading-tight">
              {t("contact_other_ways_title")}
            </h2>

            <ul className="space-y-5">
              <ContactLine
                icon={Mail}
                label={t("contact_other_ways_email_label")}
                value={
                  <a
                    href="mailto:hello@ashfordcreative.org"
                    className="text-ink hover:text-sage underline-offset-2 hover:underline"
                  >
                    hello@ashfordcreative.org
                  </a>
                }
              />
              {voicePretty && (
                <ContactLine
                  icon={Phone}
                  label={t("contact_other_ways_voice_label")}
                  value={
                    <a
                      href={`tel:${voiceTel}`}
                      className="text-ink hover:text-sage underline-offset-2 hover:underline"
                    >
                      {voicePretty}
                    </a>
                  }
                />
              )}
              <ContactLine
                icon={Clock}
                label={t("contact_other_ways_hours_label")}
                value={
                  <span className="text-ink/80">
                    {t("contact_other_ways_hours_value")}
                  </span>
                }
              />
              <ContactLine
                icon={MapPin}
                label={t("contact_other_ways_address_label")}
                value={
                  <span className="text-ink/80">
                    {t("contact_other_ways_address_value")}
                  </span>
                }
              />
            </ul>

            <div className="pt-4 border-t border-ink/10 text-xs text-ink/55 leading-relaxed">
              {locale === "es" ? (
                <>
                  Más detalles del programa de SMS en{" "}
                  <Link
                    href="/legal/sms-consent"
                    className="underline hover:text-ink"
                  >
                    /legal/sms-consent
                  </Link>
                  . Política de privacidad en{" "}
                  <Link
                    href="/legal/privacy"
                    className="underline hover:text-ink"
                  >
                    /legal/privacy
                  </Link>
                  .
                </>
              ) : (
                <>
                  Full SMS program details at{" "}
                  <Link
                    href="/legal/sms-consent"
                    className="underline hover:text-ink"
                  >
                    /legal/sms-consent
                  </Link>
                  . Privacy policy at{" "}
                  <Link
                    href="/legal/privacy"
                    className="underline hover:text-ink"
                  >
                    /legal/privacy
                  </Link>
                  .
                </>
              )}
            </div>
          </aside>
        </div>
      </section>

      <PageCTA />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-ink/70 mb-2">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full px-3 py-2 text-sm bg-cream border border-ink/20 rounded-sm focus:outline-none focus:border-ink"
      />
      {hint && (
        <p className="mt-1.5 text-xs text-ink/55 leading-snug">{hint}</p>
      )}
    </div>
  );
}

function ContactLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="shrink-0 w-9 h-9 rounded-sm bg-sage/15 text-sage flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="font-mono text-[10px] tracking-widest uppercase text-ink/45 mb-0.5">
          {label}
        </div>
        <div className="text-sm">{value}</div>
      </div>
    </li>
  );
}
