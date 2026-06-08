import type { PreviewContent, PreviewLeadInfo } from "@workspace/api-zod";

const CYNTHIA_PHOTO =
  "https://assets.headway.co/provider_photos/196578/49a01942-27a5-11f1-af85-0a58a9feac02-196578-1774372626977.jpeg";

const CYNTHIA: PreviewContent = {
  practiceName: "Cynthia De Los Santos, LMFT",
  tagline:
    "Family-systems therapy for individuals, couples, and families — Houston, online across Texas.",
  mission:
    "Hello and welcome. Life can be hard, and you do not have to cope alone. I'm a Licensed Marriage & Family Therapist with more than twenty years of experience supporting individuals, couples, and families through anxiety, depression, grief, and the relationships that shape who we become. My approach is rooted in family systems — we begin by understanding where you come from, then tailor a combination of therapeutic tools to fit your goals. I'm ASL-fluent and serve the Deaf and hard-of-hearing community, and I bring lived experience as a mother to a teen on the autism spectrum to my work with neurodivergent families. My promise is a safe, warm, and participatory space where you can be fully yourself while we walk this journey together.",
  heroImage: CYNTHIA_PHOTO,
  services: [
    { name: "Individual therapy", description: "One-on-one work for anxiety, depression, grief, and life transitions." },
    { name: "Couples therapy", description: "Improving communication, repairing connection, and navigating conflict together." },
    { name: "Family therapy", description: "Family-systems work for parents, teens, and families navigating change or neurodivergence." },
    { name: "Therapy in ASL", description: "Fluent ASL sessions for Deaf and hard-of-hearing clients across Texas." },
    { name: "Online sessions", description: "Secure video sessions available to anyone located in Texas." },
    { name: "Free 15-minute consultation", description: "A short call to see if we're the right fit before you commit." },
  ],
  team: [
    {
      name: "Cynthia De Los Santos",
      credentials: "MA, LMFT",
      photo: CYNTHIA_PHOTO,
      bio: "Licensed Marriage & Family Therapist (Texas) with 20+ years of clinical experience. Master of Arts in Counseling, University of Houston-Clear Lake. Trained in family systems, with additional focus on anxiety, depression, grief, women's issues, and autism-spectrum families. ASL fluent.",
    },
  ],
  reviews: [],
  testimonials: [],
  locations: [
    {
      name: "Houston (online across Texas)",
      address: "Houston, TX 77002",
      hours: [
        { day: "Mon", open: "9:00 AM – 6:00 PM" },
        { day: "Tue", open: "9:00 AM – 6:00 PM" },
        { day: "Wed", open: "9:00 AM – 6:00 PM" },
        { day: "Thu", open: "9:00 AM – 6:00 PM" },
        { day: "Fri", open: "9:00 AM – 3:00 PM" },
      ],
    },
  ],
  contact: {
    phone: "(346) 409-7761",
    email: null,
    website: "https://care.headway.co/providers/cynthia-de-los-santos",
  },
  socialLinks: {
    instagram: null,
    facebook: null,
    linkedin: null,
    tiktok: null,
    youtube: null,
    psychologyToday: null,
    headway: "https://care.headway.co/providers/cynthia-de-los-santos",
  },
  brand: {
    logoUrl: null,
    faviconUrl: null,
    accentColor: null,
    fontFamily: null,
  },
  specialties: [
    "Family issues",
    "Relationship issues",
    "Anxiety",
    "Depression",
    "Grief & loss",
    "Stress management",
    "Women's issues",
    "Autism-spectrum families",
    "Deaf & hard-of-hearing clients",
  ],
  acceptedInsurances: [
    "Aetna",
    "Ascension",
    "Blue Cross Blue Shield of Texas",
    "Carelon Behavioral Health",
    "Cigna",
    "Quest Behavioral Health",
  ],
  languages: ["English", "American Sign Language (ASL)"],
  modalities: [
    "Family Systems",
    "Cognitive Behavioral (CBT)",
    "Person-Centered",
    "Solution-Focused",
    "Online Therapy",
  ],
  offersInPerson: false,
  offersTelehealth: true,
  acceptsSlidingScale: false,
  pricePerSession: { min: 135, max: 135 },
  rating: null,
  totalReviews: null,
  methodology: null,
  clinicalStats: {
    yearsInPractice: 20,
    clientsServed: null,
    outcomeMetrics: [],
    specialtyAreas: [
      "Family Systems",
      "Marriage & Family Therapy",
      "Deaf-affirming care",
    ],
  },
  pricingTiers: [],
  testimonialsLong: [],
  featuredIn: [],
  conditionsCarousel: [
    "Anxiety",
    "Depression",
    "Family issues",
    "Relationship issues",
    "Grief & loss",
    "Women's issues",
  ],
  introVideoUrl: null,
  bookingWidget: {
    provider: "Headway",
    url: "https://care.headway.co/providers/cynthia-de-los-santos",
  },
  domainSuggestions: [],
  draftedJournalEntries: [],
  draftedPages: [],
  fieldSources: {
    practiceName: "hardcoded_cynthia_2026_05_21",
    tagline: "hardcoded_cynthia_2026_05_21",
    mission: "hardcoded_cynthia_2026_05_21",
    heroImage: "headway_public_profile",
    team: "headway_public_profile",
    services: "headway_public_profile",
    specialties: "headway_public_profile",
    modalities: "headway_public_profile",
    acceptedInsurances: "headway_public_profile",
    contact: "headway_public_profile",
  },
};

/**
 * Hand-curated portal overrides keyed by lead identity.
 *
 * Candice asked (2026-05-21) for Cynthia De Los Santos's portal to render
 * the perfect, hand-curated content directly from the frontend — no
 * dependency on the admin "perfect-cynthia-573" endpoint having run, no
 * dependency on enrichment. When the preview loads and the lead's name
 * matches, we substitute the curated PreviewContent wholesale.
 *
 * Match key is the trimmed, case-insensitive lead name from
 * PreviewLeadInfo. Lead id isn't on PreviewLeadInfo, and the slug lives
 * on the portal record, not the info payload — name is the field the
 * frontend has reliably and it's unique enough for this hand-curation.
 */
const OVERRIDES_BY_NAME: Record<string, PreviewContent> = {
  "cynthia de los santos": CYNTHIA,
};

export function applyPortalOverride(
  info: PreviewLeadInfo | null,
  content: PreviewContent | null,
): PreviewContent | null {
  if (!info) return content;
  const key = info.name.trim().toLowerCase();
  const override = OVERRIDES_BY_NAME[key];
  return override ?? content;
}
