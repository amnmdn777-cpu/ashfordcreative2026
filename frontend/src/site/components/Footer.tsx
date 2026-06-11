import { Link } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { formatPhone, useContactInfo } from "@site/lib/api";
import { WcagGuaranteeBadge } from "@site/components/WcagGuaranteeBadge";

export function Footer() {
  const { t, locale } = useI18n();
  // Voice number lives in env on the server — never hard-code it in
  // copy. The shared `useContactInfo` hook caches for 5min, so the
  // extra request is essentially free across navigations.
  const { data: contact } = useContactInfo();
  const voicePretty = formatPhone(contact?.voiceNumber ?? null);
  const voiceTel = (contact?.voiceNumber ?? "").replace(/[^\d+]/g, "");
  return (
    <footer className="bg-ink-deep text-cream/85 pt-20 pb-8 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="font-display text-2xl text-cream mb-3">Ashford</div>
            <div className="h-px bg-gold w-12 mb-3" />
            <div className="font-mono text-[9px] tracking-[0.35em] uppercase text-gold mb-4">
              Creative
            </div>
            <p className="text-sm text-cream/60 leading-relaxed max-w-xs">
              {t("footer_tagline")}
            </p>
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase text-gold mb-4">
              {t("footer_col_product")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/templates" className="hover:text-cream">{t("nav_templates")}</Link></li>
              <li><Link href="/pricing" className="hover:text-cream">{t("nav_pricing")}</Link></li>
              <li><Link href="/how-it-works" className="hover:text-cream">{t("nav_how")}</Link></li>
              <li><Link href="/therapists" className="hover:text-cream">{locale === "es" ? "Cobertura Texas" : "Texas Coverage"}</Link></li>
              <li><Link href="/blog" className="hover:text-cream">{t("nav_blog")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase text-gold mb-4">
              {t("footer_col_company")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-cream">{t("nav_about")}</Link></li>
              <li><Link href="/contact" className="hover:text-cream">{t("nav_contact")}</Link></li>
              <li><a href="mailto:hello@ashfordhealthcreative.com" className="hover:text-cream break-all">hello@ashfordhealthcreative.com</a></li>
              {voicePretty && (
                <li>
                  <a href={`tel:${voiceTel}`} className="hover:text-cream">
                    {voicePretty}
                  </a>
                </li>
              )}
              <li><span className="text-cream/50">Austin, Texas</span></li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase text-gold mb-4">
              {t("footer_col_legal")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/legal/privacy" className="hover:text-cream">{t("footer_privacy")}</Link></li>
              <li><Link href="/legal/terms" className="hover:text-cream">{t("footer_terms")}</Link></li>
              <li><Link href="/legal/refund" className="hover:text-cream">{t("footer_refund")}</Link></li>
              <li><Link href="/legal/sms-consent" className="hover:text-cream">{t("footer_sms")}</Link></li>
            </ul>
          </div>
        </div>

        {/* Trust strip — rendered ABOVE the copyright row so an investor
            scrolling for HIPAA + jurisdiction signals finds them on the
            first scan, and a clinician doing a "are these people serious"
            sniff test gets the same answer. Plain mono text only — no
            fake SOC2/ISO badge graphics, since those would imply audits
            we don't yet hold and read as theater under any real scrutiny.
            (Investor roleplay 2026-05-02 — story I3.) */}
        <div className="pt-8 border-t border-cream/10 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.15em] uppercase text-cream/45">
          <span>{t("footer_trust_hipaa")}</span>
          <span aria-hidden="true" className="text-cream/20">·</span>
          <span>{t("footer_trust_residency")}</span>
          <span aria-hidden="true" className="text-cream/20">·</span>
          <span>{t("footer_trust_owned")}</span>
          <span aria-hidden="true" className="text-cream/20">·</span>
          <WcagGuaranteeBadge variant="compact" />
        </div>
        <p className="font-mono text-[10px] text-cream/45 leading-snug mb-6 max-w-3xl">
          {t("footer_tax_line")}
        </p>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="font-mono text-[10px] text-cream/40">
            © {new Date().getFullYear()} Ashford Creative. {t("footer_rights")}
          </div>
          <div className="text-[10px] text-cream/35 max-w-xl leading-snug">
            {t("footer_disclaimer")}
          </div>
        </div>
      </div>
    </footer>
  );
}
