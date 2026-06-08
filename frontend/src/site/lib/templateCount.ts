import { TEMPLATE_COMPONENTS } from "@site/templates";
import type { Locale } from "./strings";

/**
 * Single source of truth for how many templates ship today. Derived
 * from the registry in `templates/index.tsx` so retiring or adding a
 * template auto-updates every "X templates / nine designs / nueve
 * direcciones" mention across the marketing site, EN+ES.
 *
 * Wire-up: the i18n provider injects { template_count,
 * template_count_word, template_count_word_cap } into every t() call
 * so strings.ts can use these placeholders without each call site
 * having to remember to pass them. Components that render outside
 * the t() pipeline (About, Compared, HowItWorks, FindTherapist) call
 * numberWord(TEMPLATE_COUNT, locale) directly.
 */
export const TEMPLATE_COUNT: number = Object.keys(TEMPLATE_COMPONENTS).length;

const EN_WORDS: Record<number, string> = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
  6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
  11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen",
  16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty",
};

// Spanish cardinal numbers. We use "una" (feminine) at 1 because every
// site-wide use refers to "plantilla(s)" (feminine) — never the
// masculine "un". If a future copy hook needs the masculine form, add
// a `numberWordMasculine` variant rather than flipping this table.
const ES_WORDS: Record<number, string> = {
  1: "una", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
  6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
  11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
  16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve", 20: "veinte",
};

export const numberWord = (n: number, locale: Locale): string => {
  const table = locale === "es" ? ES_WORDS : EN_WORDS;
  return table[n] ?? String(n);
};

export const numberWordCap = (n: number, locale: Locale): string => {
  const w = numberWord(n, locale);
  return w.charAt(0).toUpperCase() + w.slice(1);
};
