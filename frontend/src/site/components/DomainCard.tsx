import { CheckCircle2, Sparkles, Star, XCircle } from "lucide-react";
import type { DomainOffer } from "@workspace/api-zod";
import { useI18n } from "@site/lib/i18n";
import { fmtUsd } from "@site/lib/domains";

interface DomainCardProps {
  offer: DomainOffer;
  selectable?: boolean;
  chosen?: boolean;
  onChoose?: (offer: DomainOffer) => void;
  size?: "compact" | "default";
}

export function DomainCard({
  offer,
  selectable = false,
  chosen = false,
  onChoose,
  size = "default",
}: DomainCardProps) {
  const { t } = useI18n();
  const isCompact = size === "compact";
  const status = offer.status;

  const isAvailable = status === "available";
  const isPremium = status === "premium";
  const isTaken = status === "taken";
  const surcharge = offer.premiumSurcharge?.amount ?? 0;

  const shell = chosen
    ? "border-sage bg-sage/10"
    : isAvailable
    ? "border-sage/50 bg-paper hover:border-sage"
    : isPremium
    ? "border-gold/60 bg-paper hover:border-gold"
    : "border-ink/15 bg-paper opacity-75";

  return (
    <div
      data-testid={`domain-card-${offer.domain}`}
      data-domain={offer.domain}
      data-status={status}
      className={
        "border rounded-md transition-colors " +
        shell +
        " " +
        (isCompact ? "p-3" : "p-4")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            data-testid="domain-card-name"
            className={
              "font-mono text-ink leading-tight break-all " +
              (isCompact ? "text-sm" : "text-base sm:text-lg")
            }
          >
            {offer.domain}
          </div>

          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {isAvailable && (
              <span
                data-testid="domain-badge-free"
                className="inline-flex items-center gap-1 bg-sage text-cream text-[10px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-sm"
              >
                <Sparkles className="w-3 h-3" />
                {t("domain_free_badge")}
              </span>
            )}
            {isPremium && (
              <span
                data-testid="domain-badge-premium"
                className="inline-flex items-center gap-1 bg-gold/90 text-ink text-[10px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-sm"
              >
                <Star className="w-3 h-3" />
                {surcharge > 0
                  ? t("domain_premium_badge_with_amount", {
                      amount: fmtUsd(surcharge),
                    })
                  : t("domain_premium_badge")}
              </span>
            )}
            {isTaken && (
              <span className="inline-flex items-center gap-1 bg-ink/10 text-ink/70 text-[10px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-sm">
                <XCircle className="w-3 h-3" />
                {t("domain_taken")}
              </span>
            )}
            {chosen && (
              <span className="inline-flex items-center gap-1 bg-sage/20 text-sage text-[10px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-sm">
                <CheckCircle2 className="w-3 h-3" />
                {t("domain_chosen_label")}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          {isAvailable && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-ink/45 font-mono leading-none">
                {t("domain_retail_label")}
              </div>
              <div
                data-testid="domain-retail-strike"
                className="font-mono text-ink/55 line-through text-sm leading-tight"
              >
                {fmtUsd(offer.retailPrice.amount)}
                <span className="text-[10px]">/yr</span>
              </div>
              <div
                className={
                  "font-display font-semibold leading-none mt-1 text-sage " +
                  (isCompact ? "text-lg" : "text-2xl")
                }
              >
                $0
              </div>
            </>
          )}
          {isPremium && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-ink/45 font-mono leading-none">
                {t("domain_retail_label")}
              </div>
              <div className="font-mono text-ink text-sm leading-tight">
                {fmtUsd(offer.retailPrice.amount)}
                <span className="text-[10px]">/yr</span>
              </div>
              {surcharge > 0 && (
                <div
                  data-testid="domain-premium-surcharge"
                  className={
                    "font-display font-semibold text-gold leading-none mt-1 " +
                    (isCompact ? "text-base" : "text-xl")
                  }
                >
                  +{fmtUsd(surcharge)}
                  <span className="text-[10px] ml-1 text-ink/55">
                    {t("domain_premium_one_time")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isAvailable && !isCompact && (
        <div className="mt-2 text-[11px] text-ink/60">
          {t("domain_included_note")}
        </div>
      )}
      {isPremium && !isCompact && (
        <div className="mt-2 text-[11px] text-ink/60">
          {t("domain_premium_note", { amount: fmtUsd(surcharge) })}
        </div>
      )}

      {selectable && isAvailable && !chosen && (
        <button
          type="button"
          onClick={() => onChoose?.(offer)}
          className={
            "mt-3 w-full text-cream bg-ink hover:bg-ink-deep transition-colors rounded-md font-medium " +
            (isCompact ? "py-1.5 text-xs" : "py-2 text-sm")
          }
        >
          {t("domain_pick_cta")}
        </button>
      )}
      {selectable && isPremium && !chosen && (
        <button
          type="button"
          onClick={() => onChoose?.(offer)}
          className={
            "mt-3 w-full text-ink bg-gold/90 hover:bg-gold transition-colors rounded-md font-medium " +
            (isCompact ? "py-1.5 text-xs" : "py-2 text-sm")
          }
        >
          {t("domain_pick_premium_cta")}
        </button>
      )}
    </div>
  );
}
