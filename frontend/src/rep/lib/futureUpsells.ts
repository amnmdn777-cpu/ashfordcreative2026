/**
 * Future upsell catalog — products we don't sell yet but plan to roll out
 * once a practice is live on the website + done with onboarding.
 *
 * Surfaced in the rep dashboard's "Future upsells" card so reps can plant
 * seeds with prospects ("we're shipping an AI receptionist in Q1, want
 * me to add you to the early-access list?") without overpromising.
 *
 * NOT a Stripe SKU. NOT in `pricing.ts` ADDONS. Numbers below are
 * targets, not committed pricing — flagged "estimate" in the UI so a
 * rep doesn't quote them as firm.
 *
 * When a product graduates from this list to live SKU:
 *   1. Add it to `pricing.ts` ADDONS with real cents + COGS.
 *   2. Remove it from this catalog.
 *   3. Reps' "first month bonus" math picks up automatically.
 */
export type FutureUpsell = {
  key: string;
  label: string;
  oneLiner: string;
  /** What problem the practice has TODAY that this solves. */
  problem: string;
  /** Target ETA — rough quarter, never a firm date. */
  eta: string;
  /** Estimated monthly price in dollars (target, not committed). */
  estMonthly: number;
  /** Estimated one-time setup in dollars, when applicable. */
  estSetup?: number;
  /** Estimated rep first-month bonus in dollars (rep visibility only). */
  estFirstMonthBonus: number;
};

export const FUTURE_UPSELLS: readonly FutureUpsell[] = [
  {
    key: "ai_receptionist",
    label: "AI Receptionist",
    oneLiner:
      "24/7 voice agent that answers booking calls and qualifies new patients while you're with clients.",
    problem:
      "Solo practices miss 30-40% of new-patient calls — they hit voicemail and the prospect calls the next clinic on Google.",
    eta: "Q1 2026",
    estMonthly: 249,
    estSetup: 299,
    estFirstMonthBonus: 99,
  },
  {
    key: "social_media_manager",
    label: "Social Media Manager",
    oneLiner:
      "12 branded posts/month across Instagram + Facebook, scheduled and published — written in your voice.",
    problem:
      "Most therapists know they should post but don't have 4 hours/week to design + caption + schedule.",
    eta: "Q2 2026",
    estMonthly: 199,
    estFirstMonthBonus: 79,
  },
  {
    key: "review_engine",
    label: "Patient Review Engine",
    oneLiner:
      "Automated post-visit text/email asking happy patients to drop a Google review — the #1 ranking signal for local search.",
    problem:
      "Practices have 40+ great patients and 4 Google reviews because asking feels awkward. We make the ask for them.",
    eta: "Q4 2025",
    estMonthly: 49,
    estFirstMonthBonus: 19,
  },
  {
    key: "campaigns_suite",
    label: "Email + SMS Campaigns",
    oneLiner:
      "Recall reminders, seasonal newsletters, and re-engagement flows for lapsed patients — drag-and-drop builder.",
    problem:
      "70% of past patients never come back. A single 'we miss you' SMS recovers 8-12% of them.",
    eta: "Q4 2025",
    estMonthly: 79,
    estFirstMonthBonus: 29,
  },
  {
    key: "paid_ads",
    label: "Paid Ads Concierge",
    oneLiner:
      "Managed Google Search + Meta ad spend with monthly creative refresh and full attribution back to bookings.",
    problem:
      "Solo practices burn $400-800/month on Google Ads with no targeting and no attribution — and assume 'ads don't work'.",
    eta: "Q3 2026",
    estMonthly: 299,
    estFirstMonthBonus: 99,
  },
  {
    key: "mobile_app",
    label: "Branded Mobile App",
    oneLiner:
      "iOS + Android companion app for patients — booking, intake, secure messaging, session reminders, all in your brand.",
    problem:
      "Patients live in their phones. A branded app puts you on the home screen and drops no-shows another 10-15%.",
    eta: "Q4 2026",
    estMonthly: 399,
    estSetup: 1499,
    estFirstMonthBonus: 199,
  },
];
