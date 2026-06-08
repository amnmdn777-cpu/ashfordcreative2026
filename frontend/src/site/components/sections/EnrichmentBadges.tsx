import React from "react";
import {
  Sparkles,
  HeartHandshake,
  Languages,
  Shield,
  Users as UsersIcon,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Portal "WOW" enrichment band. Surfaces specialties / modalities /
 * languages / accepted insurances (computed by
 * `services/previewContent.ts`) as themed badge clusters, plus pills
 * for in-person / telehealth / sliding-scale availability.
 *
 * Renders nothing when every input is empty. All colors / fonts via
 * the per-template CSS variables emitted by `ThemeProvider`.
 */
export interface EnrichmentBadgesProps {
  specialtiesLabel: string;
  modalitiesLabel: string;
  languagesLabel: string;
  insuranceLabel: string;
  inPersonLabel: string;
  telehealthLabel: string;
  slidingScaleLabel: string;
  specialties?: string[];
  modalities?: string[];
  languages?: string[];
  acceptedInsurances?: string[];
  offersInPerson?: boolean | null;
  offersTelehealth?: boolean | null;
  acceptsSlidingScale?: boolean | null;
}

interface GroupProps {
  label: string;
  items: string[];
  Icon: LucideIcon;
}

function Group({ label, items, Icon }: GroupProps) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Icon className="w-3.5 h-3.5" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center px-2.5 py-1 text-xs rounded-full border"
            style={{
              borderColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)",
              backgroundColor:
                "color-mix(in srgb, var(--color-primary) 6%, transparent)",
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
            }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EnrichmentBadges(props: EnrichmentBadgesProps) {
  const {
    specialties = [],
    modalities = [],
    languages = [],
    acceptedInsurances = [],
    offersInPerson,
    offersTelehealth,
    acceptsSlidingScale,
  } = props;

  const anyPill = !!(
    offersInPerson ||
    offersTelehealth ||
    acceptsSlidingScale
  );
  const anyGroup =
    specialties.length > 0 ||
    modalities.length > 0 ||
    languages.length > 0 ||
    acceptedInsurances.length > 0;

  if (!anyPill && !anyGroup) return null;

  return (
    <section
      className="w-full px-6 md:px-12 py-14 md:py-16"
      style={{
        backgroundColor: "var(--color-surface-soft, var(--color-surface))",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {anyPill && (
          <div className="flex flex-wrap gap-2.5">
            {offersInPerson ? (
              <Pill Icon={UsersIcon} label={props.inPersonLabel} />
            ) : null}
            {offersTelehealth ? (
              <Pill Icon={Video} label={props.telehealthLabel} />
            ) : null}
            {acceptsSlidingScale ? (
              <Pill Icon={Wallet} label={props.slidingScaleLabel} />
            ) : null}
          </div>
        )}
        {anyGroup && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Group
              label={props.specialtiesLabel}
              items={specialties}
              Icon={Sparkles}
            />
            <Group
              label={props.modalitiesLabel}
              items={modalities}
              Icon={HeartHandshake}
            />
            <Group
              label={props.languagesLabel}
              items={languages}
              Icon={Languages}
            />
            <Group
              label={props.insuranceLabel}
              items={acceptedInsurances}
              Icon={Shield}
            />
          </div>
        )}
      </div>
    </section>
  );
}

interface PillProps {
  Icon: LucideIcon;
  label: string;
}

function Pill({ Icon, label }: PillProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full"
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-surface, #ffffff)",
        fontFamily: "var(--font-body)",
      }}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </span>
  );
}

export default EnrichmentBadges;
