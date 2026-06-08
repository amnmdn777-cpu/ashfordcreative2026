import { Link } from "wouter";
import { useI18n } from "@site/lib/i18n";
import { Seo } from "@site/lib/seo";

export default function NotFound() {
  const { t, locale } = useI18n();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <Seo
        title={t("nf_title")}
        description={
          locale === "es"
            ? "No encontramos esa página. Vuelve a la portada."
            : "We couldn't find that page. Head back to the homepage."
        }
        path="/404"
        noindex
      />
      <div className="font-mono text-xs tracking-widest uppercase text-gold mb-3">
        {t("nf_eyebrow")}
      </div>
      <h1 className="font-display text-4xl md:text-6xl text-ink mb-4">
        {t("nf_title")}
      </h1>
      <p className="text-ink/65 mb-8 max-w-md">{t("nf_body")}</p>
      <Link
        href="/"
        className="px-6 py-3 bg-ink text-cream rounded-sm hover:bg-sage-light transition-colors text-sm"
      >
        {t("nf_cta")}
      </Link>
    </div>
  );
}
