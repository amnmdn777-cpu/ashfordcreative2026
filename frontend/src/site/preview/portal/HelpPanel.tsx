import { useEffect, useRef, useState } from "react";
import { HelpCircle, Mail, MessageSquare, Phone, X, CalendarClock } from "lucide-react";
import type { PortalPublicResponse } from "@workspace/api-zod";
import { useI18n } from "@site/lib/i18n";
import { formatPhone, useContactInfo } from "@site/lib/api";
import { portalApi } from "./api";

type RepCard = NonNullable<PortalPublicResponse["rep"]>;

interface HelpPanelProps {
  /** Assigned rep info from the portal payload. Caller should not mount the
   * panel at all when this is null (pool lead) — the button has nothing to
   * surface. We accept a non-null prop here to keep the contract obvious. */
  rep: RepCard;
  /** Portal slug — used for the `help_panel_open` tracking event. */
  slug: string;
  /** Stable session id so events from the same visit can be grouped. */
  sessionId: string;
  /**
   * When the sticky toolbar above is expanded the floating button collapses
   * to a small icon-only pill so it never visually competes with the
   * toolbar's Reserve CTA on small screens. When the toolbar is collapsed
   * (more vertical breathing room) we expand to the full pill with text.
   *
   * AUDIT: this prop is strictly READ-ONLY here. HelpPanel must never
   * call back into its parent to flip toolbar state — toolbar
   * expand/collapse is owned exclusively by the parent (today
   * `ProspectPortal`, which renders this component and passes the
   * value of its own `toolbarExpanded` state). The standalone
   * `TemplateRoute` browse surface keeps an independent toolbar
   * default and does NOT mount HelpPanel. Coupling these surfaces
   * by adding a setter prop here would create a feedback loop where
   * opening the help popover could silently re-expand a panel the
   * prospect just collapsed. If you ever need to react to a toolbar
   * transition, derive it locally from this prop — do not introduce
   * a setter prop.
   */
  toolbarExpanded: boolean;
}

/**
 * Floating "Talk to a human" button + popover anchored to the bottom-right
 * of the portal viewport. Mobile-friendly: 48px tap target, popover sized
 * for one-handed use, all rows are real `tel:` / `sms:` / `mailto:` links
 * so OS default handlers do the right thing.
 *
 * Behaviour:
 *  - Click button → opens popover, fires one `help_panel_open` event.
 *  - ESC key or click outside → closes popover.
 *  - Hides any contact row whose corresponding rep field is missing.
 *  - When the parent toolbar is expanded, the button shrinks to an icon so
 *    it visually defers to the Reserve CTA above (per portal trust audit).
 */
export function HelpPanel({
  rep,
  slug,
  sessionId,
  toolbarExpanded,
}: HelpPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Guard so we only fire a tracking event the FIRST time the panel opens
  // in a given session — repeated opens are a noisy signal for reps.
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const c = containerRef.current;
      if (c && !c.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    if (!trackedRef.current) {
      trackedRef.current = true;
      void portalApi
        .event(slug, {
          eventType: "help_panel_open",
          sessionId,
          metadata: { firstName: rep.firstName },
        })
        .catch(() => {});
    }
  };

  // Rep direct line takes priority; the shared Austin voice number is
  // the fallback so prospects can still reach a human even when a rep
  // hasn't published a personal number. The shared `useContactInfo`
  // hook caches for 5min — cheap to mount alongside the panel.
  const { data: contact } = useContactInfo();
  const sharedVoice = contact?.voiceNumber ?? null;
  const callPhoneRaw = rep.phone ?? sharedVoice;
  const callPhonePretty = formatPhone(callPhoneRaw);
  const callPhoneDigits = callPhoneRaw?.replace(/[^\d+]/g, "") ?? "";
  // SMS only ever uses the rep's direct line — the shared voice number
  // isn't an SMS-enabled twilio profile and texting it would silently fail.
  const smsPhoneDigits = rep.phone?.replace(/[^\d+]/g, "") ?? "";
  const showCall = !!callPhoneRaw;
  const showText = !!rep.phone;
  const showEmail = !!rep.email;

  // Floating panel position: pushed up from `bottom-4` to
  // `bottom-20` so the collapsed pill stacks ABOVE the
  // CrisisFloatingButton (which lives at `bottom-4 right-4`, ~44px
  // tall). Without the offset the two floating CTAs overlapped on
  // the iPad — founder note #221.
  return (
    <div
      ref={containerRef}
      className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 flex flex-col items-end gap-2"
    >
      {open && (
        <div
          role="dialog"
          aria-label={t("portal_help_panel_eyebrow")}
          className="w-[min(calc(100vw-2rem),22rem)] rounded-2xl bg-paper border border-ink/15 shadow-xl overflow-hidden"
        >
          <div className="flex items-start gap-3 p-4 border-b border-ink/10">
            {rep.avatarUrl ? (
              <img
                src={rep.avatarUrl}
                alt={t("portal_help_avatar_alt", { firstName: rep.firstName })}
                className="w-12 h-12 rounded-full object-cover shrink-0 border border-ink/10"
              />
            ) : (
              <div
                aria-hidden
                className="w-12 h-12 rounded-full bg-ink text-cream flex items-center justify-center font-display text-lg shrink-0"
              >
                {rep.firstName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink/50">
                {t("portal_help_panel_eyebrow")}
              </div>
              <div className="text-sm font-medium text-ink truncate">
                {rep.displayName}
              </div>
              <p className="text-xs text-ink/65 mt-1.5 leading-snug">
                {t("portal_help_panel_intro", { firstName: rep.firstName })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("portal_help_aria_close")}
              className="p-1.5 -m-1.5 text-ink/50 hover:text-ink rounded-md hover:bg-ink/[0.06] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Founder feedback 2026-05-17: exactly three channels — Email,
              WhatsApp, Request callback. Removed Call + SMS rows. */}
          <ul className="flex flex-col">
            {showEmail && (
              <li>
                <a
                  href={`mailto:${rep.email}`}
                  className="flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-ink/[0.04] transition-colors border-b border-ink/[0.06]"
                >
                  <Mail className="w-4 h-4 text-ink/55 shrink-0" />
                  <span className="text-sm text-ink truncate">
                    {t("portal_help_email", { email: rep.email ?? "" })}
                  </span>
                </a>
              </li>
            )}
            {smsPhoneDigits ? (
              <li>
                <a
                  href={`https://wa.me/${smsPhoneDigits.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="portal-help-whatsapp"
                  className="flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-ink/[0.04] transition-colors border-b border-ink/[0.06]"
                >
                  <MessageSquare className="w-4 h-4 text-ink/55 shrink-0" />
                  <span className="text-sm text-ink">WhatsApp {rep.firstName}</span>
                </a>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                data-testid="portal-help-callback"
                onClick={() => {
                  void fetch(`/api/public/callback-requests`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slug, sessionId, source: "help_panel" }),
                    keepalive: true,
                  }).catch(() => {});
                  setOpen(false);
                }}
                className="w-full text-left flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-ink/[0.04] transition-colors"
              >
                <CalendarClock className="w-4 h-4 text-ink/55 shrink-0" />
                <span className="text-sm text-ink">Request a callback from {rep.firstName}</span>
              </button>
            </li>
          </ul>

          <div className="px-4 py-2.5 bg-ink/[0.03] border-t border-ink/[0.06]">
            <p className="text-[11px] text-ink/55 leading-snug">
              {t("portal_help_hours")}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={open ? () => setOpen(false) : handleOpen}
        aria-expanded={open}
        aria-label={
          open ? t("portal_help_aria_close") : t("portal_help_aria_open")
        }
        className={`bg-ink hover:bg-ink-deep text-cream rounded-full shadow-lg flex items-center justify-center transition-all min-h-[44px] min-w-[44px] ${
          toolbarExpanded
            ? "w-12 h-12"
            : "px-4 sm:px-5 h-12 gap-2 text-sm font-medium"
        }`}
      >
        <HelpCircle className="w-5 h-5 shrink-0" />
        {!toolbarExpanded && (
          <span className="hidden sm:inline">{t("portal_help_button")}</span>
        )}
      </button>
    </div>
  );
}
