import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { translations, type Locale, type StringKey } from "./strings";
import { TEMPLATE_COUNT, numberWord, numberWordCap } from "./templateCount";

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: StringKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "ashford_locale";

const interpolate = (
  template: string,
  vars?: Record<string, string | number>,
): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] === undefined ? `{${k}}` : String(vars[k]),
  );
};

/**
 * Top-level provider. Reads the locale from localStorage / navigator on
 * first render, and persists changes back to localStorage so the choice
 * sticks across pages.
 *
 * For surfaces that need to seed an initial locale from a data source
 * (e.g. the prospect portal mounting in the lead's `lead.locale`), pass
 * `initial`. To prevent the prospect's per-portal toggle from clobbering
 * the global site-wide preference, also pass `scoped`: scoped providers
 * keep `locale` in memory only and never read/write localStorage, while
 * still allowing `setLocale` so the prospect can flip languages.
 *
 * (We dropped the previous `pinned` mode because it made the in-portal
 * EN/ES toggle a dead UI affordance — prospects expected the click to
 * flip the page and it didn't.)
 */
export function I18nProvider({
  children,
  initial,
  scoped,
}: {
  children: React.ReactNode;
  /** Seed the locale on first render. Overrides navigator/localStorage. */
  initial?: Locale;
  /**
   * When true, the provider keeps locale in memory only — it neither
   * reads nor writes localStorage. Use for surfaces (portals, embeds)
   * that should not influence the visitor's site-wide preference.
   */
  scoped?: boolean;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initial) return initial;
    if (typeof window === "undefined") return "en";
    if (!scoped) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "es") return stored;
    }
    const nav = navigator.language?.toLowerCase() || "";
    return nav.startsWith("es") ? "es" : "en";
  });

  // If the parent swaps `initial` (e.g. portal switches lead mid-mount),
  // re-seed the locale to the new initial value.
  useEffect(() => {
    if (initial) setLocaleState(initial);
  }, [initial]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (l: Locale) => {
      if (!scoped) {
        localStorage.setItem(STORAGE_KEY, l);
      }
      setLocaleState(l);
    },
    [scoped],
  );

  // Memoize `t` against the current locale so consumers comparing
  // function identity (e.g. inside their own useMemo deps) don't see
  // a fresh function on every parent re-render. The translation
  // tables are static, `interpolate` is pure — only `locale` matters.
  const t = useCallback<I18nCtx["t"]>(
    (k, vars) => {
      const raw =
        translations[locale][k] ??
        translations.en[k] ??
        (k as unknown as string);
      // Auto-injected vars — every t() call gets these without
      // each site having to remember to pass them. Caller-supplied
      // vars win if they override the same key.
      const enrichedVars = {
        template_count: TEMPLATE_COUNT,
        template_count_word: numberWord(TEMPLATE_COUNT, locale),
        template_count_word_cap: numberWordCap(TEMPLATE_COUNT, locale),
        ...vars,
      };
      return interpolate(raw, enrichedVars);
    },
    [locale],
  );

  // Stable context value — without `useMemo`, every render would mint
  // a fresh `{ locale, setLocale, t }` object and trigger a re-render
  // of every `useI18n()` consumer in the tree (templates, chatbot,
  // ~100 sites). The value is now stable across renders unless one of
  // its three slots actually changes.
  const value = useMemo<I18nCtx>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be inside I18nProvider");
  return v;
}
