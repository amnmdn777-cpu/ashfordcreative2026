import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useI18n } from "@site/lib/i18n";
import { useChatbot } from "./ChatbotProvider";

export function Header() {
  const [open, setOpen] = useState(false);
  const { t, locale, setLocale } = useI18n();
  const [, setLoc] = useLocation();
  const { open: openChat } = useChatbot();

  const links: Array<[string, string]> = [
    ["/templates", t("nav_templates")],
    ["/pricing", t("nav_pricing")],
    ["/how-it-works", t("nav_how")],
    ["/blog", t("nav_blog")],
    ["/about", t("nav_about")],
    ["/contact", t("nav_contact")],
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-40 bg-cream/85 backdrop-blur-md border-b border-ink/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex justify-between items-center h-20">
        <Link href="/" className="flex flex-col leading-none cursor-pointer">
          <div className="font-display text-[26px] text-ink tracking-tight leading-none">
            Ashford
          </div>
          <div className="h-px bg-gold my-[5px]" />
          <div className="flex items-center justify-between gap-4">
            <span className="font-sans text-[9px] tracking-[0.35em] uppercase text-sage font-medium leading-none">
              Creative
            </span>
            <span className="font-mono text-[7px] text-gold tracking-[0.15em] leading-none">
              Est. 2014
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-ink/80 hover:text-ink transition-colors"
            >
              {label}
            </Link>
          ))}
          <button
            onClick={() => openChat()}
            className="px-5 py-2 border border-ink text-ink text-sm font-medium hover:bg-ink hover:text-cream transition-all rounded-sm"
          >
            {t("nav_talk")}
          </button>
          {/* Bilingual switch: render EN and ES side-by-side (segmented
              control) instead of a single globe + current-locale label.
              For Texas-bilingual therapists landing cold, the ES option
              must be visible without a click — the previous "Globe · EN"
              read like a generic country selector. (Founder note
              2026-05-02 — first-time-visitor story 7.) */}
          <div
            className="flex items-center font-mono text-[11px] tracking-widest text-ink/55"
            role="group"
            aria-label={t("nav_lang_select")}
          >
            <button
              type="button"
              onClick={() => setLocale("en")}
              aria-pressed={locale === "en"}
              aria-label={t("nav_lang_en")}
              className={
                "px-1.5 py-0.5 transition-colors " +
                (locale === "en"
                  ? "text-ink font-semibold"
                  : "text-ink/45 hover:text-ink/80")
              }
            >
              EN
            </button>
            <span aria-hidden="true" className="text-ink/25">|</span>
            <button
              type="button"
              onClick={() => setLocale("es")}
              aria-pressed={locale === "es"}
              aria-label={t("nav_lang_es")}
              className={
                "px-1.5 py-0.5 transition-colors " +
                (locale === "es"
                  ? "text-ink font-semibold"
                  : "text-ink/45 hover:text-ink/80")
              }
            >
              ES
            </button>
          </div>
        </div>

        <button
          className="md:hidden text-ink"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-cream border-t border-ink/10 px-6 py-6 space-y-4">
          {links.map(([href, label]) => (
            <button
              key={href}
              className="block w-full text-left text-base text-ink/85"
              onClick={() => {
                setOpen(false);
                setLoc(href);
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              openChat();
            }}
            className="block w-full text-left text-base font-medium text-sage"
          >
            {t("nav_talk")}
          </button>
          <div
            className="flex items-center font-mono text-[11px] tracking-widest text-ink/55"
            role="group"
            aria-label={t("nav_lang_select")}
          >
            <button
              type="button"
              onClick={() => setLocale("en")}
              aria-pressed={locale === "en"}
              aria-label={t("nav_lang_en")}
              className={
                "px-1.5 py-0.5 " +
                (locale === "en" ? "text-ink font-semibold" : "text-ink/45")
              }
            >
              EN
            </button>
            <span aria-hidden="true" className="text-ink/25">|</span>
            <button
              type="button"
              onClick={() => setLocale("es")}
              aria-pressed={locale === "es"}
              aria-label={t("nav_lang_es")}
              className={
                "px-1.5 py-0.5 " +
                (locale === "es" ? "text-ink font-semibold" : "text-ink/45")
              }
            >
              ES
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
