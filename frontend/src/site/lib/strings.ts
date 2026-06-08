import {
  SMS_CONSENT_DISCLOSURE_EN,
  SMS_CONSENT_DISCLOSURE_ES,
} from "@workspace/api-zod";

export type Locale = "en" | "es";

export const translations = {
  en: {
    // Nav
    nav_templates: "Templates",
    nav_pricing: "Pricing",
    nav_how: "How it works",
    nav_blog: "Blog",
    nav_about: "About",
    nav_talk: "Talk to us",
    // Bilingual switch a11y. The visible glyphs "EN | ES" carry meaning
    // visually but a screen reader needs full words on each button. The
    // wrapping role="group" gets the localized "Language" announcement
    // so a Spanish-speaking SR user hears "Idioma" + "Inglés / Español"
    // instead of "Language" + "EN / ES". (Cleanup pass — sales-rep +
    // investor roleplay session, code review pass.)
    nav_lang_select: "Language",
    nav_lang_en: "English",
    nav_lang_es: "Español",

    // Footer
    footer_tagline:
      "Boutique websites for Texas mental-health practitioners. We build it, look after it, and quietly keep it running — nothing for you to learn or maintain. Three plans: Boutique $199, Pro $299, Concierge $649 — all-in.",
    footer_col_product: "Product",
    footer_col_company: "Company",
    footer_col_legal: "Legal",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
    footer_disclaimer:
      "Testimonials shown are composite illustrations from user research interviews.",
    footer_rights: "All rights reserved.",
    // Trust strip rendered above the copyright row. A healthcare-vertical
    // investor doing 20-min diligence will scroll to the footer looking
    // for HIPAA + jurisdiction signals; a clinician doing a "are these
    // people serious" sniff test will look for the same. Plain text, no
    // fake SOC2/ISO badge graphics — that would read as theater. The
    // labels link to the legal pages where the actual policy lives.
    // (Investor roleplay 2026-05-02 — story I3.)
    footer_trust_hipaa: "Privacy-first, your EHR holds patient data",
    footer_trust_residency: "U.S. data residency · Austin, TX",
    footer_trust_owned: "Independently owned, no PE / no debt",
    footer_tax_line:
      "100% tax-deductible business expense (IRS §162). We send a W-9 and itemized invoices at year-end for your CPA.",
    // Contact-page investor banner. The form below this is therapist-shaped
    // (practice name, preferred callback time, SMS consent) — an investor
    // or partner who lands on /contact during diligence would either fill
    // it out wrong or bounce. We give them their own one-line escape hatch
    // straight to a typed inbox so we can route it without polluting the
    // rep queue. (Investor roleplay 2026-05-02 — story I4.)
    contact_investor_banner_label: "Investor or partner?",
    // {email} is interpolated by Contact.tsx from `VITE_PARTNERSHIPS_EMAIL`
    // (falls back to hello@ashfordcreative.org when the var is unset). Do
    // NOT hardcode an address here — keep the placeholder.
    contact_investor_banner_cta: "Email {email}",

    // Hero
    hero_eyebrow: "FOR THE THERAPIST WHO DIDN'T BECOME ONE TO BUILD WEBSITES.",
    hero_title_l1: "We build it.",
    hero_title_l2: "You see patients.",
    hero_subhead:
      "A small Austin studio writes, designs, and quietly keeps a calm page running — so the patient who'd be the right fit for you actually lands on you, not a directory grid.",
    hero_cta: "Talk to us",
    hero_cta_secondary: "See the templates",

    // ── Atrium template (pilot for the design-system rebuild) ──
    atrium_hero_eyebrow: "PSYCHOTHERAPY · AUSTIN, TX",
    atrium_hero_alt:
      "A quiet boutique psychotherapy waiting room in linen and slate blue with a single lounge chair at morning light",
    atrium_hero_headline_l1: "For the considered work",
    atrium_hero_headline_em: "of becoming yourself.",
    atrium_hero_subhead:
      "Long-form psychotherapy in English and Spanish, paced for adults rebuilding the framework of a life that no longer fits.",
    atrium_hero_cta: "Begin a consultation",
    atrium_nav_cta: "Begin",
    atrium_services_heading: "How we work together",
    atrium_services_subhead: "Three frames for the same depth practice.",
    atrium_about_heading: "On meeting {firstName}",
    atrium_about_quote:
      "Therapy at this depth is the slow architecture of a life — patient, structural, and yours.",
    atrium_fees_heading: "Investment",
    atrium_fees_note:
      "Sliding scale reserved for two seats per quarter; please ask in your consultation.",
    atrium_insurance_heading: "Insurance",
    atrium_faq_heading: "Frequently asked",
    atrium_faq_q1: "How long is a typical course of therapy?",
    atrium_faq_a1:
      "Depth work usually unfolds over six to eighteen months at a weekly cadence; we re-evaluate together at six-week intervals.",
    atrium_faq_q2: "Do you see clients in Spanish?",
    atrium_faq_a2:
      "Yes — sessions can be conducted entirely in Spanish, English, or a mix of both.",
    atrium_faq_q3: "What happens in the consultation call?",
    atrium_faq_a3:
      "A complimentary 15-minute phone or video call to see whether this practice is the right fit. Practical questions only — no clinical content.",
    atrium_faq_q4: "Do you offer telehealth?",
    atrium_faq_a4:
      "Yes — online sessions are available across Texas; in-person sessions are held in central Austin.",
    atrium_booking_heading: "Begin",
    atrium_booking_subhead: "A complimentary 15-minute consultation.",
    atrium_booking_secondary: "Practical questions only — no clinical content.",
    atrium_footer_design_by: "Design by ",

    // ── Garden template (Phase 2 port) ──
    garden_top_cta: "Book a call",
    garden_hero_eyebrow: "FAMILY & TRAUMA-INFORMED THERAPY · PLANO",
    garden_hero_headline: "A space to breathe, and grow.",
    garden_hero_subhead:
      "Trauma-informed family therapy for children, parents, and couples becoming parents — in person in Plano and online across Texas.",
    garden_hero_cta: "Book a free 15-min call",
    garden_hero_alt:
      "A sunlit therapy room with a peace lily, monstera, and fiddle-leaf fig",
    garden_services_heading: "What we work on",
    garden_services_subhead: "Three slow rooms inside the same practice.",
    garden_about_heading: "About {firstName}",
    garden_about_quote:
      "Connection is built in small repeats — that's where the work lives.",
    garden_fees_heading: "Fees & insurance",
    garden_fees_note:
      "Sliding-scale spots open quarterly; please ask in your consult.",
    garden_insurance_heading: "Insurance",
    garden_faq_heading: "Common questions",
    garden_faq_q1: "Do you see kids alone or always with parents?",
    garden_faq_a1:
      "It depends on the child and the question. Most of my child sessions include a parent for some part of the work — even if I see the child alone in the middle of it.",
    garden_faq_q2: "What if my partner doesn't want to come to therapy?",
    garden_faq_a2:
      "We can start with you. Family therapy doesn't always require the whole family in the room — it requires the family in the conversation. We'll make a plan that's realistic for your household.",
    garden_faq_q3: "Do you offer Spanish-language sessions?",
    garden_faq_a3:
      "Yes — sessions can be entirely in Spanish, in English, or moving between both.",
    garden_faq_q4: "How does telehealth work for kids?",
    garden_faq_a4:
      "Younger children usually do better in person; older kids and teens often prefer telehealth. We'll find the right mix together in your consult.",
    garden_booking_heading: "Start the conversation",
    garden_booking_subhead:
      "A free 15-minute call to see if I'm a good fit for your family.",
    garden_booking_secondary: "Practical questions only — no clinical content.",
    garden_footer_design_by: "Design by ",

    // ── Sunrise template (Phase 2 port) ──
    sunrise_top_cta: "Book a call",
    sunrise_hero_eyebrow: "PERINATAL & POSTPARTUM · DALLAS · TELEHEALTH IN TEXAS",
    sunrise_hero_headline: "You're not failing. You're becoming someone new.",
    sunrise_hero_subhead:
      "Specialty therapy for postpartum depression and anxiety, birth trauma, and pregnancy loss — online across Texas.",
    sunrise_hero_cta: "Book a 15-min call",
    sunrise_hero_alt:
      "A sunrise-lit room with a soft chair by a window — warm pastel palette",
    sunrise_glass_one_liner:
      "Perinatal mental health-certified · in your corner from the first call.",
    sunrise_services_heading: "Where we do the work",
    sunrise_services_subhead: "Three rooms inside one specialty practice.",
    sunrise_about_heading: "About {firstName}",
    sunrise_about_quote:
      "You don't need a diagnosis or a worst day to call.",
    sunrise_fees_heading: "Fees & insurance",
    sunrise_fees_note:
      "HSA/FSA cards accepted; ask in your consult about superbills for out-of-network reimbursement.",
    sunrise_insurance_heading: "Insurance",
    sunrise_faq_heading: "Common questions",
    sunrise_faq_q1: "Is it too soon — or too late — to call?",
    sunrise_faq_a1:
      "Neither. People reach out at six weeks postpartum, three years out, after a loss, before a transfer. There's no expiration on this work.",
    sunrise_faq_q2: "Can my partner come too?",
    sunrise_faq_a2:
      "Yes. Postpartum and pregnancy loss are family events; many of my sessions include a partner some of the time. We figure out the right rhythm together.",
    sunrise_faq_q3: "How does telehealth work after a baby?",
    sunrise_faq_a3:
      "Most of my postpartum clients see me from a couch with a baby asleep nearby. We work around naps, feeds, and bad nights — that's the whole point of the format.",
    sunrise_faq_q4: "Do you take insurance?",
    sunrise_faq_a4:
      "BCBS, Aetna, United, and Cigna in-network; HSA/FSA cards welcome; superbills available for out-of-network reimbursement.",
    sunrise_booking_heading: "Take the first call",
    sunrise_booking_subhead:
      "A free 15-minute call to feel out whether this is a fit. No pressure.",
    sunrise_booking_secondary: "Practical questions only — no clinical content.",
    sunrise_footer_design_by: "Design by ",

    // ── Polaroid template (Phase 2 port) ──
    polaroid_top_cta: "Book Consult",
    polaroid_hero_eyebrow: "THERAPY & COUNSELING · EAST AUSTIN",
    polaroid_hero_headline: "Healing begins where you are.",
    polaroid_hero_signature: "— {firstName}",
    polaroid_hero_subhead:
      "EMDR, IFS, and somatic work for women in their 30s and 40s, survivors of childhood trauma, and people in long-term recovery — in person in East Austin and online across Texas.",
    polaroid_hero_cta: "Book a free 15-min call",
    polaroid_photo_1_alt:
      "A quiet therapy office with two soft chairs and a low coffee table",
    polaroid_photo_2_alt: "A houseplant on a sunny window sill",
    polaroid_photo_3_alt: "The therapist holding a warm mug of tea",
    polaroid_services_heading: "How we work",
    polaroid_services_subhead: "Three modalities, one slow practice.",
    polaroid_about_heading: "About {firstName}",
    polaroid_about_quote:
      "We meet the body and the parts. They both have things to say that words alone can't reach.",
    polaroid_fees_heading: "Fees & insurance",
    polaroid_fees_note:
      "Sliding-scale spots open through Open Path; ask in your consult.",
    polaroid_insurance_heading: "Insurance",
    polaroid_faq_heading: "Common questions",
    polaroid_faq_q1: "Is EMDR going to make me relive everything?",
    polaroid_faq_a1:
      "No. We build resourcing first — grounding, parts work, body-based skills — so the reprocessing stays at a pace you can actually move through.",
    polaroid_faq_q2: "Can I start with talk therapy and add EMDR later?",
    polaroid_faq_a2:
      "Yes. Many of my clients spend the first two or three months getting comfortable in the room before we touch any of the deeper modalities. We'll go in the order that fits.",
    polaroid_faq_q3: "Do you take my insurance?",
    polaroid_faq_a3:
      "BCBS and Aetna in-network; Open Path for sliding-scale; superbills available for out-of-network reimbursement on most other plans.",
    polaroid_faq_q4: "What's the cancellation policy?",
    polaroid_faq_a4:
      "24-hour notice, no charge. Less than 24 hours and I bill the session — the slot is held for you, the work is held for you, the cost reflects that.",
    polaroid_booking_heading: "Start a conversation",
    polaroid_booking_subhead:
      "A free 15-minute call to see if I'm a fit. No pressure either way.",
    polaroid_booking_secondary: "Practical questions only — no clinical content.",
    polaroid_footer_design_by: "Design by ",

    // ── Playful Modern template (Phase 2 port) ──
    playful_top_cta: "Get matched",
    playful_hero_eyebrow: "ONLINE THERAPY · TEXAS",
    playful_hero_headline: "Therapy that doesn't feel like therapy.",
    playful_hero_subhead:
      "CBT + ACT for adults 25–40 navigating anxiety, ADHD, perfectionism, and the part of being grown that nobody briefed you on.",
    playful_hero_cta: "Get matched in 90 seconds",
    playful_hero_alt:
      "A bright editorial portrait — therapist on a video call, sage-painted wall, plant in frame",
    playful_carousel_label: "What we work on",
    playful_chip_anxiety: "anxiety",
    playful_chip_adhd: "ADHD",
    playful_chip_perfectionism: "perfectionism",
    playful_chip_burnout_early: "early-career burnout",
    playful_chip_imposter: "imposter syndrome",
    playful_chip_relationships: "relationships",
    playful_chip_identity: "identity",
    playful_chip_burnout_recovery: "burnout recovery",
    playful_services_heading: "Three rooms, one match.",
    playful_services_subhead: "Pick the door that sounds like you.",
    playful_about_heading: "Meet {firstName}",
    playful_about_quote:
      "You don't need a calmer brain. You need a different relationship with the one you have.",
    playful_fees_heading: "What it costs",
    playful_fees_note:
      "Free 90-second match quiz before the first session — saves everybody time.",
    playful_insurance_heading: "Insurance",
    playful_faq_heading: "Real questions",
    playful_faq_q1: "How fast can we start?",
    playful_faq_a1:
      "Match quiz today, intake within the week. I keep evening slots open specifically for the people who can't take a Tuesday afternoon off.",
    playful_faq_q2: "What if I've never done therapy before?",
    playful_faq_a2:
      "Excellent. We'll spend the first session covering what you want, what you're afraid of, and what would tell you this is working — and what would tell you it isn't.",
    playful_faq_q3: "Online-only — really?",
    playful_faq_a3:
      "Really. The data on telehealth outcomes for anxiety + ADHD is strong, and the format is the difference between weekly and 'I'll start in January.'",
    playful_faq_q4: "Is this covered by my insurance?",
    playful_faq_a4:
      "BCBS and Aetna in-network; private pay + HSA/FSA accepted; superbills available for out-of-network reimbursement.",
    playful_booking_heading: "Take the quiz",
    playful_booking_subhead:
      "90 seconds, eight questions, no email until the end. We figure out fit before you book.",
    playful_booking_secondary: "Or just book a 15-min call.",
    playful_footer_design_by: "Design by ",

    // ── Constellation template (Phase 2 port) ──
    cn_top_cta: "Schedule",
    cn_hero_eyebrow: "EXECUTIVE THERAPY · HOUSTON",
    cn_hero_headline_pre: "For",
    cn_hero_headline_emphasis: "high-performers",
    cn_hero_headline_post: "who've stopped sleeping.",
    cn_hero_subhead:
      "CBT, ACT, IFS, and an executive-coaching framework for founders, C-suite, and creatives at the top of their field.",
    cn_hero_cta: "Book a confidential 15-min consultation",
    cn_hero_alt: "A low-key lit Houston office at dusk",
    cn_services_heading: "Where the work happens",
    cn_services_subhead: "Three named seasons. One framework.",
    cn_about_heading: "About {firstName}",
    cn_about_quote:
      "The internal monologue that got you here is also the one keeping you awake. We re-train it — we don't silence it.",
    cn_fees_heading: "Investment",
    cn_fees_note:
      "Out-of-network only; superbills provided for reimbursement. HSA/FSA accepted.",
    cn_insurance_heading: "Insurance",
    cn_faq_heading: "Frequently asked",
    cn_faq_q1: "What's the cadence of a typical course?",
    cn_faq_a1:
      "Weekly to start; we re-evaluate at six weeks. Most courses run six to twelve months. Executive intensives are scheduled separately.",
    cn_faq_q2: "Is this confidential — even from my employer?",
    cn_faq_a2:
      "Yes. I am not retained by any employer. The relationship is between us; nothing is shared without your written authorization.",
    cn_faq_q3: "Do you take insurance?",
    cn_faq_a3:
      "Out-of-network only. I provide a monthly superbill for any plan that offers OON reimbursement; HSA/FSA accepted.",
    cn_faq_q4: "Can sessions be later in the day?",
    cn_faq_a4:
      "Yes — I keep evening hours specifically for executive clients. Telehealth and in-person both available across Texas.",
    cn_booking_heading: "Schedule the consultation",
    cn_booking_subhead:
      "A 15-minute confidential call. Practical questions, no clinical content.",
    cn_booking_secondary: "Or write to elena@elenapark.com.",
    cn_footer_design_by: "Design by ",

    // ── Front Porch template (Phase 3 new template) ──
    fp_top_cta: "Book a free call",
    fp_hero_eyebrow: "COUPLES & FAMILY THERAPY · SAN ANTONIO",
    fp_hero_headline: "I help couples figure out what's actually going on.",
    fp_hero_subhead:
      "Gottman-trained. In-person in Stone Oak, telehealth across Texas. In-network with BCBS, Aetna, and United.",
    fp_hero_cta: "Book a free 15-min call",
    fp_hero_alt: "A therapist on a porch at golden hour, warm direct gaze",
    fp_services_heading: "What I work on",
    fp_services_subhead: "Three rooms. One slow conversation.",
    fp_about_heading: "About {firstName}",
    fp_about_quote:
      "We figure out what's actually going on underneath the recurring fights — and how to stop having the same one twice.",
    fp_fees_heading: "Fees & insurance",
    fp_fees_note:
      "In-network with BCBS, Aetna, and United. HSA/FSA accepted; superbills available for any other plan.",
    fp_insurance_heading: "Insurance",
    fp_faq_heading: "Common questions",
    fp_faq_q1: "Do we both have to come to the first session?",
    fp_faq_a1:
      "Ideally yes — the first session works best with both partners in the room. If only one of you is ready, we can start there and add the other when it's time.",
    fp_faq_q2: "How long does couples therapy usually take?",
    fp_faq_a2:
      "Most of my couples see real change inside the first three months and finish a course of work between six and twelve months. We re-evaluate together at six weeks.",
    fp_faq_q3: "Do you do family therapy with kids in the room?",
    fp_faq_a3:
      "Yes — kids age six and up. Younger than that, I usually meet with the parents to coach the family system rather than work directly with the child.",
    fp_faq_q4: "What's the cancellation policy?",
    fp_faq_a4:
      "24-hour notice, no charge. Less than 24 hours, the session is billed — the slot was held for you.",
    fp_booking_heading: "Pull up a chair",
    fp_booking_subhead:
      "A free 15-minute call. We see if I'm a fit before you book a session.",
    fp_booking_secondary: "Practical questions only — no clinical content.",
    fp_footer_design_by: "Design by ",

    // ── Hello Friend template (Phase 3 new template, port 8) ──
    hf_top_cta: "Tell me what's going on →",
    hf_hero_eyebrow: "QUEER & ND-AFFIRMING THERAPY · TEXAS · ONLINE",
    hf_hero_headline:
      "Hi, I'm {firstName}. I help people in their 20s and 30s figure out what's going on.",
    hf_hero_signature: "— but in a good way",
    hf_hero_subhead:
      "Mostly queer adults, a lot of ADHD that nobody caught earlier, and a lot of people whose 'high-functioning' arrangement stopped functioning. Sliding scale ($80–$140), all online.",
    hf_hero_cta: "Tell me what's going on",
    hf_hero_alt: "{firstName} holding a mug, laughing off-camera",
    hf_chip_anxiety: "anxiety",
    hf_chip_adhd: "ADHD",
    hf_chip_queer: "queer identity",
    hf_chip_burnout: "early-career burnout",
    hf_chip_identity: "identity",
    hf_chip_relationships: "relationships",
    hf_services_heading: "What we'd probably talk about",
    hf_services_subhead: "Three rooms. One conversation.",
    hf_about_heading: "More about {firstName}",
    hf_about_quote:
      "Y'all deserve a 'no' that comes fast more than a 'maybe' that drags.",
    hf_fees_heading: "What it costs",
    hf_fees_note:
      "Sliding scale only. I don't take insurance — superbills available on request if your plan reimburses out-of-network.",
    hf_insurance_heading: "Insurance",
    hf_faq_heading: "Real questions",
    hf_faq_q1: "Why an intake form instead of a calendar?",
    hf_faq_a1:
      "Because picking a time before we've talked is backwards. Tell me what's going on, I'll write you back within a business day, and if I'm a fit we'll find a time together.",
    hf_faq_q2: "Are you in-network with my insurance?",
    hf_faq_a2:
      "No. I'm sliding scale only ($80–$140), out-of-network with everybody. If your plan reimburses OON I'll provide superbills.",
    hf_faq_q3: "Do you actually work with all the things on the chip list?",
    hf_faq_a3:
      "Yes. Not all at once, not all in the first session — but yes. Most of my clients have at least two of those happening at the same time.",
    hf_faq_q4: "Is the practice queer-affirming or queer-focused?",
    hf_faq_a4:
      "Both. I'm queer myself, my practice is built around queer + ND-affirming work, and most of my clients are LGBTQ+. You don't have to explain the basics.",
    hf_booking_heading: "Send me a message",
    hf_booking_subhead:
      "Three fields. Two minutes. I read every one of these myself.",
    hf_booking_secondary: "Or just email hello@samcastillo.com.",
    hf_footer_design_by: "Design by ",

    // ── Intake form (Hello Friend) ──
    intake_title: "Tell {firstName} what's going on.",
    intake_subtitle:
      "Three fields. Two minutes. {firstName} reads every one of these themselves and writes back within a business day.",
    intake_label_name: "Your name",
    intake_placeholder_name: "First name is fine",
    intake_label_message: "What's been on your mind?",
    intake_placeholder_message: "Whatever feels honest. 200-char max.",
    intake_label_contact: "Best way to reach you back",
    intake_placeholder_contact: "Email or phone — your call",
    intake_submit: "Send it",
    intake_success_title: "Got it — thanks for writing.",
    intake_success_body:
      "{firstName} will read this and write you back within a business day. If it's urgent and you can't wait that long, the 988 line at the bottom of the page is staffed 24/7.",
    intake_required: "Required",
    intake_char_remaining: "{n} characters left",

    // Value strip — two one-line sales arguments under the hero
    value_domain_oneliner:
      "We set it up, look after it, and keep it gently up to date — there's nothing for you to learn or maintain.",
    value_cancel_oneliner:
      "Cancel anytime in the first 90 days. After that, just 30 days' notice — no penalty.",

    // Voice + soft-landing — replaces the old domain hero block
    voice_eyebrow: "Why patients pick you",
    voice_title:
      "The right patient is searching tonight. They should land on you — not a directory grid.",
    voice_dir_label: "On a directory",
    voice_dir_body:
      "You're page-three among fifty names ranked by ad spend. The patient who'd be the right fit keeps scrolling.",
    voice_ash_label: "On your Ashford page",
    voice_ash_body:
      "One calm page in their language — your face, your modalities, your booking link. The fit decision happens before they even call.",
    landing_eyebrow: "A soft landing",
    landing_title: "When someone in pain finds you, what do they land on?",
    landing_dir_label: "A directory grid",
    landing_dir_body:
      "Fifty faces ranked by ad spend. They scroll, compare, lose nerve, close the tab.",
    landing_ash_label: "Your site",
    landing_ash_body:
      "One calm page, your face, your words. The work begins before the first call.",

    // Problem
    problem_title_l1: "Someone in pain is searching",
    problem_title_l2: "for a therapist tonight.",
    problem_p1:
      "// They land on a directory grid of fifty faces — yours one of them, alphabetised next to a stranger.",
    problem_p2:
      "// They compare, second-guess, lose nerve, and close the tab.",
    problem_p3:
      "// One calm page in your own voice would have been enough.",

    // Differentiators
    diff1_title: "A page that sounds like you, not a checkbox grid",
    diff1_desc:
      "Your training, your modalities, the work you actually do — written in your voice, not a 280-character bio field next to fifty other names.",
    diff1_metric: "From $199/mo",
    diff1_stat: "Three plans — Boutique $199, Pro $299, Concierge $649. All-in. Your site, the Spanish version, and everything that keeps it running — already included.",

    diff2_title: "A soft place to land for someone in pain",
    diff2_desc:
      "One calm page, your face, your words. The work begins before the first call — instead of fifty faces ranked by ad spend.",
    diff2_metric:
      "Identity, modality, and faith-affirming pages — built in.",
    diff2_stat: "",

    diff3_title: "{template_count_word_cap} curated templates — and you keep choosing",
    diff3_desc:
      "Atrium for modern group practices, Garden for warm trauma-informed work, Sunrise for perinatal and recovery, Constellation for premium practices, Polaroid for personal photographic feels, Playful Modern for energetic D2C-style, Front Porch for couples and family, Hello Friend for conversational queer-friendly, and Quiet Practice for psychoanalytic depth work. Pick yours, no rebuild fee.",
    diff3_metric: "9",
    diff3_stat: "directions, each with its own signature palette and voice.",

    // Process / How it works summary
    process_title: "From first conversation to live website in 48 hours.",
    process_step_1_title: "We call you",
    process_step_1_desc:
      "A real human in Austin picks up. No script, no pressure — tell us about your practice the way you'd tell a colleague over coffee. We listen, we take notes.",
    process_step_2_title: "{template_count_word_cap} real previews land in your inbox",
    process_step_2_desc:
      "Not blank templates. {template_count_word_cap} fully built sites with your name, your work, your photos already in place. Show your partner, sit with them, sleep on it. There's no rush.",
    process_step_3_title: "Pick the one that feels right",
    process_step_3_desc:
      "We register a web address for you, and the monthly price is all-in — no surprise charges, no upsells, ever. Three plans to fit your practice: Boutique $199, Boutique Pro $299, Concierge $649.",
    process_step_4_title: "We write the words — or you do",
    process_step_4_desc:
      "Five quick questions if you'd like to shape the copy yourself. Don't have time? With your okay, we draft a thoughtful first version from what's already public about your practice.",
    process_step_5_title: "Your site is live in 48 hours",
    process_step_5_desc:
      "From that first phone call to a working website in two days — three if we're registering your web address. After that, you don't think about it again. We keep it fast, safe, and looked after. Forever.",

    // Pricing teaser
    pricing_eyebrow: "PRICING",
    pricing_title: "Three plans. One flat price each.",
    pricing_subtitle:
      "No hidden fees, no annual contract. Cancel anytime in the first 90 days; after that, just 30 days' notice.",

    pricing_a_label: "What's included",
    pricing_a_setup: "All-in monthly price",
    pricing_a_desc: "Setup, a yearly renewal of your web address, Spanish translation, and quiet upkeep — bundled into one monthly price.",
    pricing_b_label: "Pick your tier",
    pricing_b_setup: "Boutique · Boutique Pro · Concierge",
    pricing_b_desc: "Boutique $199, Boutique Pro $299, Concierge $649 — pick the one that fits your practice.",
    pricing_recommended: "Recommended",
    pricing_monthly: "/ month",
    pricing_see_full: "See full pricing & extras",

    // ---- TIER MODEL (2026-05 refactor — see pricing-migration-decisions.md)
    // Hero
    pricing_v2_hero_title: "Three tiers. One flat price each. Cancel anytime.",
    pricing_v2_hero_sub:
      "Same boutique craft underneath every tier. The only difference is how many front-desk multipliers we bake in for you.",
    // Foundation row (below the cards)
    pricing_v2_foundation_title: "What's included in every tier",
    pricing_v2_foundation_sub:
      "Seven things every Ashford site ships with, on every tier — so you never pay extra for the basics a therapist's website should already do.",
    // Comparison link
    pricing_v2_compare_link:
      "How we compare to Brighter Vision, TherapySites, SimplePractice",
    // Self-serve checkout block
    pricing_v2_checkout_title: "Pick a tier. Reserve in a minute.",
    pricing_v2_checkout_sub:
      "Card on file, charge starts after your site goes live. No setup fee. Cancel anytime in the first 90 days.",
    pricing_v2_checkout_busy: "Starting…",
    pricing_v2_reserve: "Reserve",

    // Tier labels + taglines + CTAs
    tier_boutique_label: "Boutique",
    tier_boutique_tagline:
      "The essentials, beautifully done. Bilingual site, calm 988 button, office tour, Google presence, sliding-scale badge.",
    tier_boutique_cta: "Choose Boutique",
    tier_boutique_pro_label: "Boutique Pro",
    tier_boutique_pro_tagline:
      "Everything in Boutique, plus the four front-desk multipliers: online booking, first-visit video, telehealth bridge, and a patient onboarding hub.",
    // PHASE A.5 — Pro booking copy.
    tier_boutique_pro_booking_note:
      "We embed your existing Calendly so patients book directly on your site.",
    tier_boutique_pro_cta: "Choose Boutique Pro",
    tier_boutique_concierge_label: "Boutique Concierge",
    tier_boutique_concierge_tagline:
      "Everything in Pro, plus we bridge your existing Doxy telehealth room and a ghostwritten Insights Journal — 14+ pieces of clinical authority per year.",
    // PHASE A.6 — Concierge telehealth + Insights Journal copy. Public-
    // facing wording — the journal is described as a human ghostwriter's
    // work; no AI/automation/machine words allowed here.
    tier_boutique_concierge_telehealth_note:
      "We bridge your existing Doxy telehealth room.",
    tier_boutique_concierge_journal_note:
      "Insights Journal: 14 ghostwritten articles per year, written in your voice and published on your site.",
    // PHASE A.7 — optional 20-minute setup-help call for Doxy.
    tier_boutique_concierge_doxy_help_note:
      "We can hop on a 20-minute call to help you set up Doxy if needed. Included — not required.",
    tier_boutique_concierge_cta: "Choose Boutique Concierge",
    tier_setup_free: "No setup fee",
    tier_everything_in_boutique_plus: "Everything in Boutique, plus:",
    tier_everything_in_boutique_pro_plus: "Everything in Boutique Pro, plus:",

    // Testimonials
    testimonials_eyebrow: "WHAT THERAPISTS SAY",
    testimonials_title: "Real research interviews. Composite portraits.",

    // Blog teaser
    blog_eyebrow: "READING",
    blog_title: "Notes for therapists building a real practice online.",
    blog_view_all: "View all articles",

    // CTA
    cta_title: "Ready to hand off your website and just see patients?",
    cta_subtitle:
      "Talk to a real Texas-based rep. No bots, no email funnels, no commitment — and nothing for you to learn or maintain.",

    // Common
    learn_more: "Learn more",
    talk_to_us: "Talk to us",
    read_more: "Read more",
    submit: "Submit",
    sending: "Sending...",
    success: "Got it. We'll be in touch within one business day.",
    error_generic: "Something went wrong. Please try again or call us.",

    // Templates page
    tpl_title: "{template_count_word_cap} directions. We build the one you pick.",
    tpl_subtitle:
      "Every template is built for the way the right patient actually looks for a therapist — quietly, at 11pm, from their phone. Pick one, see it live, and we take care of the rest.",
    tpl_seo_title: "Templates — {template_count_word} curated directions",
    tpl_seo_desc:
      "{template_count_word_cap} templates inspired by real-world therapist sites, each with its own signature palette. Quiet, considered, made for the work you do.",
    tpl_card_eyebrow: "Template",
    tpl_palettes_title: "Signature palette",
    tpl_visit_demo: "Open live demo",

    // Pricing page
    pricing_page_title: "Pricing that respects your billing math.",
    pricing_page_sub:
      "Three plans, one flat monthly price each. Your site, the Spanish version, and everything that keeps it running smoothly are already included. A few optional extras, priced like you'd expect from a small studio. No surprise invoices. Cancel anytime in the first 90 days; after that, just give us 30 days' notice.",
    pricing_compare: "Compare plans",
    pricing_addons_title: "Premium extras",
    pricing_addons_sub:
      "À la carte if you need them. Add or remove anytime — no setup fee.",
    pricing_packs_title: "Bundle packs",

    // Pricing — angle column headers (3 audience-framed groupings of add-ons)
    pricing_angle_client_eyebrow: "For the prospective client",
    pricing_angle_client_title: "What they see on your site",
    pricing_angle_client_sub:
      "Visible features that turn an interested visitor into a booked first session.",
    pricing_angle_doc_eyebrow: "For you, the practitioner",
    pricing_angle_doc_title: "Tools that build clinical authority",
    pricing_angle_doc_sub:
      "Writing, search, your name as the authority on a topic — the kind of work that adds up over time.",
    pricing_angle_gatekeeper_eyebrow: "For the front desk",
    pricing_angle_gatekeeper_title: "Less inbox, fewer no-shows",
    pricing_angle_gatekeeper_sub:
      "Quiet automations the office manager renews the contract for, every single year.",

    pricing_includes_title: "What every site includes",
    pricing_modify_title: "Want changes after launch?",
    pricing_modify_body:
      "Email your designer and we'll quote it before we start — never any work in flight without your sign-off. We'll never charge you to fix our own mistakes.",

    // How it works page
    how_title: "How an Ashford website actually gets built.",
    how_sub:
      "We're transparent about everything — from the first conversation through the day patients start finding you. The studio works because the websites do, not because the funnel is clever.",

    // Blog
    blog_page_title: "The Ashford blog",
    blog_page_sub:
      "Practical writing for Texas therapists — directory fatigue, search visibility, and what the right patient actually needs to find at 11pm on their phone.",
    blog_comments_title: "Comments",
    blog_no_comments: "Be the first to comment.",
    blog_comment_name: "Your name",
    blog_comment_practice: "Your practice (optional)",
    blog_comment_body: "Your comment",
    blog_comment_submit: "Post comment",
    blog_likes: "likes",
    blog_back: "Back to all articles",

    // About
    about_title: "We help Texas therapists sound like themselves online.",
    about_sub:
      "A small Austin studio. We spent years listening to Texas therapists describe two things — the chore of building and maintaining a website, and the patient who keeps scrolling past them on a directory grid. This studio is what we built in response.",
    about_values_title: "What we believe",
    about_v1_title: "We handle the website. You handle the patients.",
    about_v1_body:
      "Writing, design, the Spanish version, booking, and everything that keeps the site quietly humming along — all of it ours. There's nothing for you to learn or maintain.",
    about_v2_title: "Boutique > bloated.",
    // Pod model — kept aligned with About.tsx "Austin Pod #1" framing
    // (Investor roleplay 2026-05-02 — story I1, architect cleanup pass).
    // The cap is per pod, not company-wide; the "same human day 1 / day
    // 365" promise is what the cap protects.
    about_v2_body:
      "Each pod caps at 200 active sites so the rep who calls you on day one is the same human answering email on day 365. New regional pods open as markets warrant.",
    about_v3_title: "Spanish is non-negotiable in Texas.",
    about_v3_body:
      "Every site ships in English and Spanish — real translation, not Google Translate. The patient searching in their first language actually lands on you.",

    // Legal
    legal_privacy_title: "Privacy Policy",
    legal_terms_title: "Terms of Service",
    legal_refund_title: "Refund Policy",
    legal_sms_title: "SMS Consent",
    footer_refund: "Refund policy",
    footer_sms: "SMS consent",

    // Self-serve checkout (Pricing page)
    pricing_start_now: "Start now",
    pricing_start_now_sub: "Pay your welcome charge and we'll be in touch within one business day to get you started.",
    pricing_addons_choose: "Extras (optional)",
    pricing_total_monthly: "Total monthly",
    pricing_setup_due: "Setup due today",
    pricing_no_setup: "No setup fee",
    // #221 — surfaced under the monthly total on the public Pricing
    // page so the prospect sees the deductibility cue at the same
    // moment they're sizing up the monthly outlay.
    pricing_tax_note:
      "100% tax-deductible business expense (IRS §162). We send a W-9 and itemized invoices at year-end for your CPA.",
    // #221 — short version rendered as a perk bullet in every tier card
    // (Pricing page) and beside the Reserve button on the self-serve block.
    tier_tax_deductible_bullet: "100% tax-deductible business expense",
    tier_tax_deductible_sub: "Itemized invoices + W-9 sent at year-end for your CPA.",
    pricing_starting_checkout: "Starting checkout…",
    pricing_checkout_failed: "Couldn't start checkout. Please try again or email hello@ashfordcreative.org.",

    // === SMS opt-in disclosure ===
    // SINGLE SOURCE OF TRUTH for the TCR-grade consent paragraph. The
    // Contact page and Chatbot render this verbatim above the consent
    // checkbox AND echo it back to the API as `smsConsentText`. The
    // /legal/sms-consent page also quotes this string verbatim. Change
    // it here and every surface updates in lockstep.
    sms_consent_disclosure: SMS_CONSENT_DISCLOSURE_EN,
    sms_consent_label:
      "Yes, I agree to receive SMS messages from Ashford Creative at the number above.",
    sms_consent_required_error:
      "Please tick the SMS consent box, or remove your phone number to send without SMS.",

    // === Contact page (`/contact`) ===
    nav_contact: "Contact",
    contact_seo_title:
      "Contact Ashford Creative — talk to a Texas-based rep, in English or Spanish",
    contact_seo_desc:
      "Reach the Ashford Creative studio. We respond within one business day, in English or Spanish, by call, text, or email — your choice.",
    contact_eyebrow: "CONTACT",
    contact_title: "Talk to a real Texas-based rep.",
    contact_subtitle:
      "We respond within one business day, in English or Spanish. Call, text, or email — whichever suits your week.",
    contact_form_heading: "Send us a note",
    contact_form_name: "Your name",
    contact_form_practice: "Practice name (optional)",
    contact_form_email: "Email",
    contact_form_phone: "Phone (optional — Texas number works best)",
    contact_form_phone_hint:
      "Add your number only if you want a callback or text. Adding a number requires SMS consent below.",
    contact_form_pref: "How should we reach you first?",
    contact_form_time: "Best time to reach you (Texas time, optional)",
    contact_form_message: "Anything we should know? (optional)",
    contact_form_submit: "Send message",
    contact_form_sending: "Sending…",
    contact_form_success_title: "Got it — talk soon.",
    contact_form_success_body:
      "A real Texas-based rep will be in touch within one business day. No phone trees, no email funnels.",
    contact_form_error_email_or_phone:
      "Please provide either an email or a phone number so we can reach you.",
    contact_other_ways_eyebrow: "DIRECT CHANNELS",
    contact_other_ways_title: "Prefer the old-fashioned way?",
    contact_other_ways_email_label: "Email",
    contact_other_ways_voice_label: "Voice & SMS",
    contact_other_ways_hours_label: "Hours",
    contact_other_ways_hours_value: "Mon–Fri, 9am–6pm CT",
    contact_other_ways_address_label: "Studio",
    contact_other_ways_address_value: "Austin, Texas",

    // Chatbot
    cb_open: "Talk to us",
    cb_close: "Close",
    cb_greeting:
      "Hi — I'm here to answer quick questions about Ashford Creative. What brings you here today?",
    cb_q_see: "I want to see what my site could look like",
    cb_q_cost: "How much does this cost?",
    cb_q_fast: "How fast can you launch?",
    cb_q_human: "I want to talk to a human",
    cb_back: "Back to start",
    cb_phi_disclaimer:
      "Please don't share patient health info here. For medical questions, use your therapist's portal.",
    cb_form_title: "Tell us a little about you and we'll reach out.",
    cb_form_name: "Your name",
    cb_form_practice: "Practice name",
    cb_form_email: "Email",
    cb_form_phone: "Phone (Texas number works best)",
    cb_form_pref: "How should we reach you first?",
    cb_form_pref_callback: "Call me back",
    cb_form_pref_sms: "Text me",
    cb_form_pref_email: "Email me",
    cb_form_message: "Anything we should know?",
    cb_form_time: "Best time to reach you (Texas time)",
    cb_form_submit: "Send",
    cb_thanks:
      "Thank you — a Texas-based rep will reach out within one business day. No phone trees, no funnels.",
    cb_error: "Couldn't send that. Try again, or call us at the number on the contact page.",

    // Chatbot scripted branches
    cb_see_bot:
      "{template_count_word_cap} template directions — Garden (warm, trauma-informed), Sunrise (perinatal, recovery), Constellation (premium, high-performing adults), Polaroid (personal, photographic), Playful Modern (energetic, Gen-Z fluent), Front Porch (couples + family, Texas-rooted), and Hello Friend (conversational, queer/ND-affirming). Each ships with its own signature palette and voice. Want to see them now or have a rep walk you through them?",
    cb_see_show: "Show me the templates",
    cb_see_call: "Have a rep call me",
    cb_see_link_bot:
      "Templates page is at /templates — open it in a new tab. When you spot a favorite, come back and tell us your name and we'll generate a personalized preview with your real practice info.",
    cb_see_link_cta: "Get my personalized preview",
    cb_cost_bot:
      "Three plans, all-in: Boutique $199, Boutique Pro $299, Concierge $649. Each covers your site, the Spanish version, and everything we do to keep it running. No setup fee. No contracts — cancel anytime in the first 90 days, then just 30 days' notice.",
    cb_cost_addons: "What about the extras?",
    cb_cost_call: "Have a rep call me",
    cb_addons_bot:
      "A small, hand-picked menu of extras — online booking, an insurance & sliding-scale note, a first-visit welcome video, a quiet writing space, intake forms, and a few more. Each one is between $10 and $20 a month. Add or set aside any of them at any time.",
    cb_addons_call: "Have a rep walk me through it",
    cb_fast_bot:
      "48 hours if we register a new domain for you. Bringing your own usually adds a day while it switches over. Either way, faster than the next opening in your own calendar.",
    cb_fast_call: "Have a rep call me",
    cb_open_pricing: "Open the pricing page",
    cb_open_templates: "Open the templates page",
    cb_open_how: "Open how-it-works",

    // Home — SEO
    home_seo_title:
      "Boutique websites for Texas therapists — built and maintained for you",
    home_seo_desc:
      "A small Austin studio writes, designs, and quietly looks after a calm page so the right patient actually finds you and picks you. Three plans from $199/mo, all-in. Every detail — handled. Cancel in the first 90 days.",

    // Home — composite testimonials
    home_t1_quote:
      "I'd been on a directory for nine years. Within two months of launching with Ashford, more first-call clients were saying they could already tell, before scheduling, that I was the right fit.",
    home_t1_name: "Composite — LCSW, EMDR practice",
    home_t1_city: "Houston",
    home_t2_quote:
      "We're a group practice with eight clinicians. The First-Visit Video and the calm bilingual landing made it obvious to first-call patients we were the right fit — before they even booked.",
    home_t2_name: "Composite — Group practice owner",
    home_t2_city: "Austin",
    home_t3_quote:
      "Spanish out of the box was huge. Spanish-speaking clients were finding me through search, and I could see exactly which pages were doing the work.",
    home_t3_name: "Composite — Austin psychologist",
    home_t3_city: "San Antonio",

    // Home — Atelier sections (graduated 2026-04-27 from canvas mockup)
    home_handled_title: "Everything handled.",
    home_handled_subtitle:
      "You didn't become a therapist to fight with the technical bits of a website. We do all of that for you — quietly, in the background.",
    home_handled_48h_title: "Hours from call to live site",
    home_handled_48h_body:
      "A real Texas-based rep takes your details. We build the site. If we set up a fresh address for you, we launch in 48 hours. If you bring your own, it usually adds a day while it switches over.",
    home_handled_bilingual_title: "Real Spanish translation",
    home_handled_bilingual_body:
      "Every site ships in English and Spanish — real translation, not Google Translate. The patient searching in Spanish actually lands on you.",
    home_handled_hosting_title: "Looked after, around the clock",
    home_handled_hosting_body:
      "We look after your site quietly — every detail handled in the background. You'll never have to log in.",
    home_voice_quote:
      "Boutique is greater than bloated. We cap each pod at 200 active sites, so the rep who answers your call on day one is the same human on day 365.",
    home_templates_title_l1: "Seven looks.",
    home_templates_title_l2: "One flat price.",
    home_templates_subtitle:
      "Seven curated templates, each with its own signature palette. Pick a direction, see it live with your real practice content, then we build it. Calm, considered, easy to read on any phone.",
    home_tpl_constellation_name: "Constellation",
    home_tpl_constellation_desc: "Cinematic dark mode for premium practices.",
    home_tpl_garden_name: "Garden",
    home_tpl_garden_desc: "For warm, family-friendly care.",
    home_tpl_polaroid_name: "Polaroid",
    home_tpl_polaroid_desc: "For personal, photographic voices.",
    home_templates_view_all: "See all seven templates",
    home_studio_l1:
      "We spent years listening to therapists describe the chore of building a website, and the patient who keeps scrolling past them on a directory grid.",
    home_studio_l2: "This studio is what we built in response.",

    // Home — certification chips
    cert_texas: "Texas-based",
    cert_boutique: "Boutique (200 / pod)",
    cert_bilingual: "EN / ES",
    cert_crisis: "Crisis Resources (988)",
    cert_founded: "Founded 2014",
    loading: "Loading…",
    blog_no_articles: "No articles yet.",
    nf_eyebrow: "404",
    nf_title: "Page not found",
    nf_body: "That URL didn't match anything. Try the homepage or the templates page.",
    nf_cta: "Back to home",
    tpl_not_found: "Template not found.",

    // === Prospect portal (`/preview/:slug`) ===
    portal_loading: "Loading your preview…",
    portal_invalid_title: "This preview link isn't valid",
    portal_invalid_help:
      "If your sales rep sent you here, they can resend a fresh link.",
    portal_collapse: "Collapse toolbar",
    portal_expand: "Expand toolbar",
    portal_prepared_for: "Prepared for",
    portal_your_build: "Your site",
    portal_per_month: "/mo",
    // #221 — micro-line under the toolbar pricing pill so the prospect
    // sees the deductibility cue at the moment of price-arbitrage.
    // Deliberately tiny / muted so it reads as a footnote, not a
    // sales banner.
    portal_tax_note: "100% tax-deductible · W-9 + invoices provided",
    portal_reserve_cta: "Reserve",
    portal_design_template: "Design template",
    portal_optional_addons: "Optional extras",
    portal_extras_included_header: "Included",
    portal_extras_addons_header: "Add-ons",
    portal_addons_hint: "Tap to add — preview appears below",
    portal_setup_one_time: "+ {amount} one-time setup",
    portal_addons_count_one: "· +1 extra",
    portal_addons_count_other: "· +{n} extras",
    portal_collapsed_teaser:
      "Personalize your site · domain on us · colors · extras",
    portal_pick_toast_saved: "Saved · {label}",
    portal_pick_toast_added: "Added · {label}",
    portal_added_chip_eyebrow: "Added to your site",
    portal_added_chip_one: "1 extra added",
    portal_added_chip_other: "{n} extras added",
    portal_addon_remove_aria: "Remove {label}",
    portal_inline_domain_label: "Your free domain",
    portal_use_template_aria: "Use {label} template",
    portal_premium_badge: "· Premium",
    portal_jump_preview: "Jump to preview",
    portal_live_eyebrow: "Live extras preview",
    portal_live_title: "Your site, with the extras you picked",
    portal_live_subtitle:
      "Each section below is what the right patient lands on — toggle extras in the toolbar to try them on the live page.",

    // === "Your site, re-imagined" pages section (read-only mirror of
    //     each crawled page rewritten in the active template's voice) ===
    portal_pages_eyebrow: "Your site, re-imagined",
    portal_pages_title: "We'll re-create your existing site, page for page",
    portal_pages_subtitle_prefix: "Each page below is rewritten in the ",
    portal_pages_subtitle_suffix: " direction.",
    portal_pages_nav_aria: "Page navigation",
    portal_pages_rewritten_voice: "Rewritten in {label} voice",
    portal_pages_draft_placeholder:
      "(We'll draft this section once you confirm the direction.)",
    portal_pages_imagery: "Imagery from your page",
    portal_pages_no_images: "No images pulled from this page.",

    // === Sticky page-nav bar at the top of the live template (lists
    //     the pages we crawled from the prospect's existing site so the
    //     prospect can click through every rebuilt page in the chosen
    //     template, exactly the way visitors would on the live build) ===
    portal_pagesbar_aria: "Site pages",
    portal_pagesbar_eyebrow: "Pages",
    portal_pagesbar_kind_home: "Home",
    portal_pagesbar_kind_about: "About",
    portal_pagesbar_kind_services: "Services",
    portal_pagesbar_kind_team: "Team",
    portal_pagesbar_kind_contact: "Contact",
    portal_pagesbar_kind_fees: "Fees",
    portal_pagesbar_kind_blog: "Blog",
    portal_pagesbar_kind_other: "Page",
    portal_rebuilt_body_eyebrow: "Body copy, rebuilt",
    portal_rebuilt_view_original: "View original page",

    // === Talk-to-a-human help panel (sticky bottom-right) ===
    portal_help_button: "Talk to a human",
    portal_help_button_short: "Help",
    portal_help_aria_open: "Open help panel — talk to a human",
    portal_help_aria_close: "Close help panel",
    portal_help_panel_eyebrow: "Your Ashford rep",
    portal_help_panel_intro:
      "Questions about your site? {firstName} can answer in minutes — no forms, no funnels.",
    portal_help_call: "Call {phone}",
    portal_help_text: "Text {phone}",
    portal_help_email: "Email {email}",
    portal_help_hours: "Texts and calls Mon–Fri, 9am–6pm CT.",
    portal_help_avatar_alt: "Photo of {firstName}, your Ashford rep",

    // === FAQ ("Common questions") accordion ===
    portal_faq_eyebrow: "Common questions",
    portal_faq_title: "A few things therapists usually ask first.",
    portal_faq_q_cancel: "Can I cancel anytime?",
    portal_faq_a_cancel:
      "Yes — your first 90 days are no-questions-asked, then it's month-to-month with 30 days' notice. No annual contracts, no early-termination fees.",
    portal_faq_q_domain: "Who owns my domain?",
    portal_faq_a_domain:
      "You do. The domain is registered in your name, and you keep full ownership and login if you ever leave Ashford.",
    portal_faq_q_after: "What happens after I reserve?",
    portal_faq_a_after:
      "Your card is charged $199 today; we email a short welcome form within one business day and your site goes live 48 hours after we have your content.",
    portal_faq_q_spanish: "Is the Spanish version really managed for me?",
    portal_faq_a_spanish:
      "Yes — every page is professionally translated and kept in sync as you make edits. You don't have to maintain two sites in your head.",
    portal_faq_q_contract: "Do I sign a contract?",
    portal_faq_a_contract:
      "Just the standard month-to-month service agreement at checkout. No multi-year commitment, no auto-escalating fees.",
    // #221 — tax-deductibility FAQ. Wording vetted: states the IRS
    // mechanism (Section 162) and the paperwork we provide (W-9 +
    // itemized invoices), but never promises a specific tax savings
    // rate (illegal without knowing the practitioner's bracket) and
    // closes with the standard "talk to your tax pro" disclaimer.
    portal_faq_q_tax: "Is this a tax-deductible business expense?",
    portal_faq_a_tax:
      "Yes — under IRS Section 162, hosting, design, and ongoing maintenance of your practice website qualify as ordinary and necessary business expenses, 100% deductible. We provide a W-9 and itemized monthly invoices marked \"Web management & marketing — professional services\" so your bookkeeper or CPA has everything they need at year-end. Talk to your tax professional for your specific situation.",
    portal_faq_aria_expand: "Expand answer",
    portal_faq_aria_collapse: "Collapse answer",

    // Reserve modal
    reserve_eyebrow: "Reserve your site",
    reserve_close: "Close",
    reserve_done_title: "You're reserved.",
    reserve_done_body:
      "We'll be in touch within one business day to get your site ready. Your extras are on the waitlist — your rep will follow up with concierge sign-up for each as we open them.",
    reserve_back_button: "Back to my preview",
    reserve_base_website: "Base website",
    reserve_addons_waitlist_one: "1 extra (waitlist)",
    reserve_addons_waitlist_other: "{n} extras (waitlist)",
    reserve_billed_when_launched: "billed when launched",
    reserve_charged_today: "Charged today",
    reserve_setup_suffix: " + {amount} setup",
    reserve_billing_explainer:
      "Only the $199/mo base{setupClause} is billed today. Your selected extras are on the waitlist — locked at today's price and not billed until you opt in as each launches.",
    reserve_billing_explainer_setup: " (plus your one-time setup)",
    reserve_name_label: "Your name",
    reserve_email_label: "Email",
    reserve_email_placeholder: "you@practice.com",
    reserve_email_required:
      "Please enter your email so we can send your receipt.",
    reserve_practice_label: "Practice name",
    reserve_practice_placeholder: "Bridge Therapy Group",
    reserve_practice_required: "Please enter your practice name.",
    reserve_phone_label_optional: "Phone (optional)",
    reserve_domain_label_optional: "Preferred domain (optional)",
    reserve_domain_hint:
      "We'll register and connect this for you — included free with your subscription.",
    self_serve_reserve_default_title: "Reserve your site",
    tpl_show_eyebrow: "Try this template",
    tpl_show_copy_link: "Copy link",
    tpl_show_copied: "Link copied",
    tpl_show_addons: "Extras",
    tpl_show_palette: "Palette",
    tpl_show_design: "Design",
    tpl_show_back: "All templates",
    reserve_continue: "Continue to secure payment",
    reserve_secured:
      "Secured by Stripe · cancel anytime, no setup fee",
    reserve_payment_unavailable: "Online payment isn't available right now",
    reserve_payment_unavailable_short:
      "Online payment isn't available right now. Your selections are saved — your rep will reach out shortly to finish reserving by phone.",
    reserve_fallback_body:
      "Your design choices and extras are saved on your preview. Your Ashford rep will reach out shortly to finish reserving by phone — usually within one business day.",
    reserve_payment_not_configured:
      "Payment is not configured in this preview. Your sales rep will follow up to complete the reservation.",
    reserve_pay_button: "Reserve now · $199",
    reserve_payment_failed: "Payment failed.",

    // === Templates — nav, eyebrows, headings, CTAs ===
    tpl_nav_about: "About",
    tpl_nav_my_work: "My work",
    tpl_nav_fees: "Fees",
    tpl_nav_contact: "Contact",
    tpl_nav_book: "Book",
    tpl_nav_writing: "Writing",
    tpl_nav_sessions: "Sessions",
    tpl_nav_reviews: "Reviews",
    tpl_nav_inquire: "Inquire →",
    tpl_inquire_word: "Inquire",
    tpl_open_in_google_maps: "Open in Google Maps",
    tpl_psychotherapy_est: "Psychotherapy · Est. {year}",
    tpl_what_i_offer_eyebrow: "What I offer",
    tpl_short_list: "A short list, on purpose.",
    tpl_about_eyebrow: "About",
    tpl_about_me: "About me.",
    tpl_about_clinicians: "About the clinicians.",
    tpl_read_full_bio: "Read full bio",
    tpl_read_the_full_bio: "Read the full bio",
    tpl_read_profile: "Read profile",
    tpl_words_from_clients: "Words from clients",
    tpl_what_clients_say: "What clients say",
    tpl_where_eyebrow: "Where",
    tpl_office_telehealth: "Office & telehealth",
    tpl_office_telehealth_dot: "Office & telehealth.",
    tpl_fees_eyebrow: "Fees & insurance",
    tpl_payment_works: "How payment works.",
    tpl_reach_out: "Reach out.",
    tpl_response_time: "I respond to every message within one business day.",
    tpl_consult_with_phone: "Schedule a free consult · {phone}",
    tpl_order_book: "Order the book",
    tpl_book_consult: "Book a consult",
    tpl_meet_team: "Meet the team",
    tpl_inside_eyebrow: "The Inside",
    tpl_what_we_do: "What we do, in plain language.",
    tpl_contributors: "Contributors",
    tpl_people_in_room: "The people in the room.",
    tpl_from_clients: "From clients",
    tpl_visit_eyebrow: "Visit",
    tpl_find_us: "Find us.",
    tpl_get_in_touch: "Get in touch.",
    tpl_cover_story: "The Cover Story",
    tpl_vol_issue: "Vol. {n} · Issue 01",
    tpl_also_in_practice: "Also in the practice",
    tpl_sessions_practical: "Sessions, fees, the practical stuff.",
    tpl_new_patients_phone: "New patients · {phone}",
    tpl_same_week_avail: "Same-week appointments available",
    tpl_schedule_visit: "Schedule a new-patient visit",
    tpl_clinic_what_we_do: "What we do",
    tpl_evidence_based:
      "Evidence-based care across the diagnostic spectrum.",
    tpl_our_team: "Our team",
    tpl_clinicians_not_roster: "Clinicians, not a roster.",
    tpl_patient_reviews: "Patient reviews",
    tpl_patient_reviews_avg: "{rating}★ from real patients",
    tpl_locations: "Locations",
    tpl_find_in_texas: "Find us in Texas.",
    tpl_new_patient_start: "New patient? Start here.",
    tpl_same_week_intake_clinic:
      "Same-week appointments available most weeks. Insurance verified at intake.",
    tpl_office_count_one: "office across Texas",
    tpl_office_count_other: "offices across Texas",
    tpl_stat_from_reviews: "from {n} patient reviews",
    tpl_stat_median_first: "median time to first appointment",
    tpl_stat_board_certified: "board-certified clinicians",
    tpl_stat_under_7_days: "< 7 days",
    tpl_on_work: "On the work",
    tpl_useful_hour:
      "We believe psychotherapy should be the most useful hour of your week — not the most clinical. Long-form work, with a single clinician who knows your story.",
    tpl_what_we_offer: "What we offer",
    tpl_clinicians_section: "Clinicians",
    tpl_where_simple: "Where",
    tpl_inquire_title: "Inquire",
    tpl_caseload_text:
      "{practiceName} accepts a small caseload. New consultations are by referral or direct inquiry.",
    tpl_practice_est: "{name} · Est. {year}",

    // Wellness Center template
    tpl_wc_in_network: "In-network with most major insurance",
    tpl_wc_schedule_visit: "Schedule new patient visit",
    tpl_wc_email_intake: "Email intake",
    tpl_wc_dismiss: "Dismiss announcement",
    tpl_wc_clinicians_staff: "clinicians on staff",
    tpl_wc_locations_label: "convenient locations",
    tpl_wc_satisfaction: "patient satisfaction",
    tpl_wc_same_week: "Same week",
    tpl_wc_intake: "new-patient intake",
    tpl_wc_services: "Services",
    tpl_wc_services_title: "Care for every age and every concern.",
    tpl_wc_insurance_eyebrow: "Insurance accepted",
    tpl_wc_insurance_title:
      "We're in-network with most major plans.",
    tpl_wc_new_patients: "New patients welcome",
    tpl_wc_now_booking: "Now booking — most appointments within one week.",
    tpl_wc_request_appt: "Request an appointment",
    tpl_wc_meet: "Meet the clinicians.",
    tpl_wc_specialties: "Specialties ({n})",
    tpl_wc_view_profile: "View profile",
    tpl_wc_two_offices: "Two welcoming offices.",
    tpl_wc_hours: "Hours",
    tpl_wc_new_patient_welcome: "New patient? Welcome.",
    tpl_wc_same_week_intake_sub:
      "Same-week intake available most weeks. Insurance verified at first call.",
    tpl_wc_a_moment: "A moment",
    tpl_wc_breathe: "breathe",
    tpl_wc_breathe_sub:
      "Care moves at a human pace here. The next step is yours, when you're ready.",

    // Team Roster — section header used by all six live previews to
    // introduce the clinician grid/carousel.
    tpl_team_roster_eyebrow: "Your team",
    tpl_team_roster_section: "Team Roster.",

    // Crisis footer
    crisis_eyebrow: "If you're in crisis right now",
    crisis_body:
      "You don't have to wait for an appointment. The 988 Suicide & Crisis Lifeline is free, confidential, and available 24/7. {practiceName} stands behind these resources fully.",
    crisis_call_988: "Call or text 988",
    crisis_text_741: "Text HOME to 741741 (Crisis Text Line)",
    crisis_disclaimer:
      "{practiceName} is not a 24/7 crisis service. If you or someone you love is in immediate danger, call 911. We are HIPAA-aware and protect the privacy of every conversation we have.",

    // === Add-on inline previews ===
    addon_inline_eyebrow: "Live feature",
    addon_inline_status: "On your site",
    addon_inline_per_month: "+{amount}/mo",
    addon_inline_included: "Included",
    tpl_show_more: "Show more",
    tpl_show_less: "Show less",

    // Always-On Spanish (spanish_pro)
    addon_spanish_pro_label: "Always-On Spanish",
    addon_spanish_pro_short: "Same care. Two languages.",
    addon_spanish_pro_section: "Our Approach",
    addon_spanish_pro_orig: "Original (English)",
    addon_spanish_pro_translated: "Translated (Spanish)",
    addon_spanish_pro_orig_h: "A Space to Heal",
    addon_spanish_pro_orig_p1:
      "We believe that healing happens in relationship. Our practice offers a warm, non-judgmental environment where you can explore your thoughts and feelings at your own pace.",
    addon_spanish_pro_orig_p2:
      "Whether you are navigating anxiety, life transitions, or relationship challenges, we are here to support your journey toward wholeness.",
    addon_spanish_pro_es_h: "Un Espacio para Sanar",
    addon_spanish_pro_es_p1:
      "Creemos que la sanación ocurre en relación. Nuestra práctica ofrece un ambiente cálido y sin juicios donde puedes explorar tus pensamientos y sentimientos a tu propio ritmo.",
    addon_spanish_pro_es_p2:
      "Ya sea que estés navegando por ansiedad, transiciones de vida o desafíos de relación, estamos aquí para apoyar tu camino hacia la plenitud.",

    // LOT 3.13 — Concierge ghostwriter callout on Pricing page.
    pricing_concierge_journal_eyebrow: "Concierge · Insights Journal",
    pricing_concierge_journal_title: "Your clinical voice, on the record.",
    pricing_concierge_journal_body:
      "Concierge subscribers get a ghostwritten Insights Journal — we interview you for 20 minutes and ship a 600-word piece in your voice every month. Over a year that's 14+ posts of real clinical authority that Google indexes, peers cite, and prospective patients actually read.",

    // Insights Journal (blog_publishing)
    addon_blog_label: "Insights Journal",
    addon_blog_short: "Your voice, on the record.",
    addon_blog_p1_cat: "Notes",
    addon_blog_p1_title: "What we mean when we say \"attachment\"",
    addon_blog_p1_excerpt:
      "It's become a buzzword on social media, but attachment theory is more than just categorizing yourself as anxious or avoidant.",
    addon_blog_p1_read: "5 min read",
    addon_blog_p2_cat: "Couples",
    addon_blog_p2_title: "A short letter on burnout",
    addon_blog_p2_excerpt:
      "When exhaustion isn't just physical tiredness, but a deep depletion of your emotional reserves and sense of agency.",
    addon_blog_p2_read: "4 min read",
    addon_blog_p3_cat: "En español",
    addon_blog_p3_title: "Cuando el silencio dice mucho",
    addon_blog_p3_excerpt:
      "A veces, lo que no decimos en nuestras relaciones familiares lleva más peso que las palabras que elegimos compartir.",
    addon_blog_p3_read: "6 min read",

    // Match Filter (modalities_filter)
    addon_match_label: "Match Filter",
    addon_match_short: "Help visitors find their fit in seconds.",
    addon_match_filter_by: "Filter by approach",
    addon_match_count_one: "1 clinician matches EMDR",
    addon_match_count_other: "{n} clinicians match EMDR",
    addon_match_card1: "EMDR Certified, Complex trauma",
    addon_match_card2: "EMDR Basic Training, Teens",

    // Open Calendar (online_booking)
    addon_calendar_label: "Online Booking",
    addon_calendar_short:
      "Free 15-min consults, booked while you sleep.",
    addon_calendar_schedule: "Schedule a Consultation",
    addon_calendar_with: "With Sandra Owner, LCSW-S",
    addon_calendar_minutes: "15 min",
    addon_calendar_video: "Video call",
    addon_calendar_day_mon: "Mon",
    addon_calendar_day_tue: "Tue",
    addon_calendar_day_wed: "Wed",
    addon_calendar_day_thu: "Thu",
    addon_calendar_day_fri: "Fri",
    addon_calendar_tuesday: "Tuesday, 13th",
    addon_calendar_consult_summary: "Tuesday 2:00 PM",
    addon_calendar_consult_label: "Free 15-min consult",
    addon_calendar_book_slot: "Book this slot",

    // Wellness Check (phq9_screener)
    addon_phq9_label: "Wellness Check",
    addon_phq9_short:
      "A gentle 2-minute check-in, before the first session.",
    addon_phq9_question:
      "Over the last 2 weeks, how often have you felt little interest or pleasure in doing things?",
    addon_phq9_opt1: "Not at all",
    addon_phq9_opt2: "Several days",
    addon_phq9_opt3: "More than half the days",
    addon_phq9_opt4: "Nearly every day",
    addon_phq9_disclaimer:
      "Managed in your EHR. Results never leave your therapist's system.",

    // Front-Door Quiz (ai_quiz)
    addon_quiz_label: "Front-Door Quiz",
    addon_quiz_short: "An intake that feels like a conversation.",

    // New Patient Welcome Kit (welcome_kit)
    addon_welcome_kit_label: "Welcome Kit",
    addon_welcome_kit_short:
      "Auto-send a branded welcome email and intake form to every new caller.",
    addon_quiz_step_label: "Step {n}",
    addon_quiz_step_of: "Step {n} of {total}",
    addon_quiz_step1_q: "What brings you in?",
    addon_quiz_step1_a: "Anxiety + work stress",
    addon_quiz_step2_q: "How are you sleeping?",
    addon_quiz_step2_opt1: "Restless",
    addon_quiz_step2_opt2: "Falling asleep is hard",
    addon_quiz_step2_opt3: "Wake up too early",
    addon_quiz_step2_opt4: "Sleeping fine",
    addon_quiz_continue: "Continue",
    addon_quiz_step3_text: "We'll suggest 2 therapists",

    // Welcome Kit (welcome_kit) — inline section copy
    addon_welcome_email_subject: "Welcome to the practice — what to expect",
    addon_welcome_email_from: "from {practitioner} <welcome@example.com>",
    addon_welcome_email_greeting: "Hi Sarah —",
    addon_welcome_email_body_pre:
      "Welcome to the practice. Your first session is",
    addon_welcome_email_body_when: "Tuesday at 1:30 PM",
    addon_welcome_email_body_post:
      "Here's everything you need before then — no rush, nothing urgent.",
    addon_welcome_email_item_intake:
      "Sign your intake form (5 min, on your phone)",
    addon_welcome_email_item_insurance:
      "Upload a photo of your insurance card",
    addon_welcome_email_item_parking: "Parking instructions + door code",
    addon_welcome_email_item_calendar:
      "Add to calendar: 1:30–2:30 PM, Tuesday",
    addon_welcome_email_signoff:
      "See you Tuesday. — Mara at the front desk",
    addon_welcome_what_eyebrow: "What the front-desk button does",
    addon_welcome_what_body:
      "One tap by the front desk → on-brand welcome email + intake form + insurance-photo capture + parking instructions, all in the right sequence. Saves about 10 minutes per new patient.",

    // Cancellation Self-Serve (cancellation_self_serve)
    addon_cancel_label: "Cancellation Self-Serve",
    addon_cancel_short:
      "Patients reschedule themselves. The front desk just gets a morning digest.",
    addon_cancel_patient_eyebrow: "Patient · reschedule link",
    addon_cancel_prompt_pre: "Need to move your",
    addon_cancel_prompt_when: "Tuesday 1:30 PM",
    addon_cancel_prompt_post: "appointment?",
    addon_cancel_slot_1: "Wed 10am",
    addon_cancel_slot_2: "Wed 4pm",
    addon_cancel_slot_3: "Thu 9am",
    addon_cancel_slot_4: "Fri 1pm",
    addon_cancel_confirm: "Confirm new time",
    addon_cancel_window: "Allowed up to 24 hours before your appointment",
    addon_cancel_desk_eyebrow: "Front desk · 7:00 AM digest",
    addon_cancel_desk_line1_action: "moved Tue 1:30 PM →",
    addon_cancel_desk_line1_to: "Wed 10:00 AM",
    addon_cancel_desk_line2: "booked free consult, Thu 4:00 PM",
    addon_cancel_desk_line3: "3 reminders auto-sent for tomorrow's slate",
    addon_cancel_footer:
      "Cuts about 30% of front-desk inbox volume. Logs cancellation reasons so you can spot a no-show pattern before it costs you a slot.",

    // Insurance & Sliding Scale Badge (insurance_sliding_scale)
    addon_insurance_label: "Insurance & Sliding Scale Badge",
    addon_insurance_short:
      "A clear plans-accepted block, baked into every page.",
    addon_insurance_card_eyebrow: "Insurance & Fees",
    addon_insurance_plans_label: "Plans accepted",
    addon_insurance_oon: "Out-of-network — superbills provided",
    addon_insurance_scale_label: "Sliding scale",
    addon_insurance_scale_range: "— $180 / session",
    addon_insurance_scale_body:
      "Reduced fee for full-time students, caregivers, and those between insurance. No paperwork required.",
    addon_insurance_footer:
      "Renders inline on every page of your site. Cuts \"do you take my insurance?\" calls by about 40% on early launches.",

    // First-Visit Video (first_visit_video)
    addon_video_label: "First-Visit Video",
    addon_video_short:
      "A calm 60-second clip so first-timers know what to expect.",
    addon_video_player_title: "Dr. Maya Alvarado · Welcome",
    addon_video_play_aria: "Play first-visit video",
    addon_video_caption:
      "\"Welcome — when you walk in, the door is on your left, and Mara will offer you tea.\"",
    addon_video_shoot_eyebrow: "What we shoot",
    addon_video_shoot_b1: "60-second talking-head intro to you",
    addon_video_shoot_b2: "Walkthrough: door → waiting room → your chair",
    addon_video_shoot_b3: "\"What happens in the first session\" voice-over",
    addon_video_shoot_b4: "EN + ES captions baked in for accessibility",

    // Google Profile Sync (google_profile_sync). [CLEANUP D.10] Reviews
    // are curated by your rep — no software-driven sync claim.
    addon_google_label: "Google Profile Sync",
    addon_google_short:
      "Your Google listing stays current — and we watch the reviews.",
    addon_google_synced: "Reviews curated by your rep",
    addon_google_business_name: "Dr. Maya Alvarado, LCSW",
    addon_google_address_line:
      "Therapist · 1200 E 11th St, Austin, TX 78702",
    addon_google_open: "Open",
    addon_google_closes: "Closes 6 PM",
    addon_google_checks_eyebrow: "Weekly checks we run for you",
    addon_google_checks_b1:
      "Hours, services, photos pushed from your site",
    addon_google_checks_b2:
      "New review notifications + draft replies for you",
    addon_google_checks_b3:
      "Watch for duplicate listings + \"temporarily closed\" flags",
    addon_google_checks_b4: "Quarterly local-search ranking report",
    addon_google_sample_notice:
      "We couldn't pull Google data for this listing yet — preview shown with sample numbers below.",

    // Intake Forms Hub (intake_forms_hub)
    addon_intake_label: "Intake Forms Hub",
    addon_intake_short:
      "Forms signed on a phone, filed in your secure drawer.",
    addon_intake_phone_url: "drmaya.com / forms",
    addon_intake_step_label: "Step 3 of 4",
    addon_intake_question: "Have you been in therapy before?",
    addon_intake_opt_current: "Yes — currently",
    addon_intake_opt_past: "Yes — in the past",
    addon_intake_opt_no: "No",
    addon_intake_sign_continue: "Sign & continue",
    addon_intake_library_eyebrow: "Sarah's form library",
    addon_intake_form_intake: "Intake Questionnaire",
    addon_intake_form_consent: "Informed Consent",
    addon_intake_form_telehealth: "Telehealth Consent",
    addon_intake_form_sliding: "Sliding-Scale Application",
    addon_intake_form_release: "Release of Records",
    addon_intake_state_signed: "signed",
    addon_intake_state_pending: "pending",
    addon_intake_state_skipped: "skipped",
    addon_intake_footer:
      "Signed PDFs auto-filed in your secure drawer. EN + ES versions of every standard form included.",

    // Domain availability + suggestions ("Your domain is on us")
    domain_hero_eyebrow: "YOUR DOMAIN IS ON US",
    domain_hero_title: "Pick a domain. We'll register it. $0 to you.",
    domain_hero_sub:
      "Most therapists don't realize the yearly renewal of a web address is the easy part — Ashford covers it forever, on us. Type your practice name and see what's free right now.",
    domain_check_placeholder: "yourpractice.com",
    domain_check_button: "Check availability",
    hero_practice_placeholder: "Your practice name (e.g. Bright Path Counseling)",
    hero_practice_check: "Check free domains",
    // Hero subtitle fallbacks. The portal derives one of these from the
    // lead's `specialty` field when the rep hasn't authored a profile
    // blurb yet. Keep the lines short — they render as the H1 subtitle.
    portal_tagline_emdr: "EMDR & trauma-focused therapy in {city}.",
    portal_tagline_couples: "Couples & family therapy in {city}.",
    portal_tagline_perinatal: "Perinatal & postpartum therapy in {city}.",
    portal_tagline_youth:
      "Therapy for children, teens & families in {city}.",
    portal_tagline_universal:
      "Therapy that meets you where you are — grounded, evidence-based, and quietly tailored to you.",
    // Small secondary pill rendered near the hero (non-headline) when
    // the lead's enrichment indicates they offer therapy in Spanish.
    portal_bilingual_pill: "Available in English & Spanish",
    domain_premium_badge_with_amount: "Premium · +{amount}/yr (you cover it)",
    domain_suggest_label: "Or — see what's free for {seed}",
    domain_suggestions_loading: "Looking up live availability…",
    domain_suggestions_empty:
      "We couldn't find any free options just yet — try a slightly different spelling or add your city.",
    domain_free_badge: "Free · we cover it",
    domain_included_note: "Included — we cover it.",
    domain_premium_badge: "Premium · you cover it",
    domain_premium_surcharge: "+ {amount}/yr after the first year",
    domain_premium_note:
      "A premium name — its yearly renewal ({amount}/yr) is on you. We cover the first year.",
    domain_retry_friendly: "Just a sec — try again.",
    domain_retry_cta: "Try again",
    domain_premium_one_time: "/yr after year 1",
    domain_pick_premium_cta: "Reserve (premium fee)",
    domain_taken: "Taken",
    domain_retail_label: "Retail",
    domain_pick_cta: "Choose this domain",
    domain_reserve_cta: "Reserve this domain",
    domain_chosen_label: "Chosen",
    domain_open_picker: "Pick a domain",
    domain_pick_top_cta: "Pick your new domain →",
    domain_picker_title: "Pick a domain — we register and renew it for you",
    domain_picker_sub:
      "Anything in green is yours at no extra charge. Premium picks add a one-time fee, never a monthly one.",
    domain_picker_close: "Close",
    domain_picker_check_specific: "Check a specific domain",
    domain_error: "Something went wrong checking that. Try again in a moment.",
    domain_invalid: "That doesn't look like a valid domain. Try yourpractice.com",

    // Chatbot — domain branch
    cb_q_domain: "Is the domain really free?",
    cb_domain_bot:
      "Yes — when we set the address up for you, it's $0 to you. Forever. We cover the yearly renewal (about $14.98/yr) on our side. Want to see what's free for your practice name right now?",
    cb_domain_check: "See what's free",
    cb_domain_skip: "Maybe later",
    cb_domain_prompt:
      "Type the name of your practice (or a domain idea) — we'll check live availability right now.",
    cb_domain_input_placeholder: "Your practice name",
    cb_domain_check_button: "Check",
    cb_domain_loading: "Checking live availability…",
    cb_domain_results_intro: "Here's what we found — anything green is yours at $0:",
    cb_domain_results_again: "Try another name",
    cb_domain_results_call: "Have a rep finalize my pick",

    // Chatbot — freeform input + intent detection
    cb_input_placeholder: "Type a question (e.g. is drsmith.com free?)",
    cb_send: "Send",
    cb_intent_domain_check_intro:
      "Looking up {domain} for you — one second…",
    cb_intent_domain_suggest_intro:
      "Looking up free options for \"{seed}\" right now — anything green is yours at $0.",
    cb_intent_domain_no_match:
      "I can answer about pricing, the domain we include, timing, or hand you to a real person. What's on your mind?",
    cb_intent_domain_available:
      "Yes! {domain} is available — normally {retail}/yr, but $0 to you. We set it up for you and quietly cover the renewal each year.",
    cb_intent_domain_taken:
      "{domain} is already taken — but here are a few that are free for the same name (we'll register your pick at $0).",
    cb_intent_domain_premium:
      "{domain} is a premium name. We cover the first year — after that, its premium yearly renewal of {surcharge}/yr is on you.",
    cb_intent_domain_invalid:
      "{domain} doesn't look like a usable domain — try something like yourpractice.com.",
    cb_intent_domain_sales_only:
      "Picking the right name is part of the welcome process — your rep walks you through 2–3 free options keyed to your practice when you reserve. If you want, I can connect you with someone now.",
    // Prospect preview "Pulled from your public profile" recap band.
    // Verbatim labels rather than full sentences — they sit next to
    // pill rows and double-translation noise (`Specialties: anxiety`)
    // would feel patronizing.
    preview_recap_eyebrow: "We pulled this from your public profile",
    preview_recap_specialties: "Specialties",
    preview_recap_accepts: "Accepts",
    preview_recap_languages: "Languages",
    preview_recap_approach: "Approach",
    preview_recap_modes: "Modes",
    preview_recap_in_person: "In-person",
    preview_recap_telehealth: "Telehealth",
    preview_recap_sliding_scale: "Sliding-scale",
    preview_recap_sources: "Sources",
    preview_recap_show_more_one: "+ Show {n} more field",
    preview_recap_show_more_other: "+ Show {n} more fields",

    // === Live features callout (telehealth, online booking, ghostwriter
    //     blog, patient onboarding hub). Surfaced on Home, About, How
    //     it works, and the blog index where it fits naturally. ===
    live_features_eyebrow: "Now shipping",
    live_features_title: "Four features quietly working in the background.",
    live_features_sub: "Patients book, meet, and onboard without you ever opening a tab.",
    live_feat_telehealth_title: "Telehealth on your own /visit page",
    live_feat_telehealth_desc:
      "A bilingual landing page at /visit your patient can join straight from a text — no third-party login, no waiting room confusion.",
    live_feat_booking_title: "Online booking, on every page",
    live_feat_booking_desc:
      "The right patient picks a real opening on your calendar at 11pm on their phone and you wake up to a confirmed first session.",
    live_feat_ghostwriter_title: "A ghostwritten Insights Journal",
    live_feat_ghostwriter_desc:
      "Fourteen-plus thoughtful pieces a year in your voice — the kind of clinical authority that quietly compounds in search over time.",
    live_feat_onboarding_title: "A patient onboarding hub",
    live_feat_onboarding_desc:
      "Welcome kit, intake forms, and the practical steps before the first session — all in one calm page so the patient lands ready, not anxious.",
    // === Portal WOW enrichment band (badges, tarifs, social, sources) ===
    // Strings rendered by the new ProspectPortal primitives that surface
    // enrichment fields already computed by `services/previewContent.ts`
    // (specialties, modalities, languages, insurance, pricing tiers,
    // testimonials, social links, sources, drafted journal entries).
    portal_wow_specialties_label: "What we treat",
    portal_wow_modalities_label: "How we work",
    portal_wow_languages_label: "We work in",
    portal_wow_insurance_label: "Insurance accepted",
    portal_wow_pill_in_person: "In-person sessions",
    portal_wow_pill_telehealth: "Telehealth",
    portal_wow_pill_sliding_scale: "Sliding-scale fee",
    portal_wow_pricing_eyebrow: "What sessions cost",
    portal_wow_pricing_title: "Fees, written plainly.",
    portal_wow_pricing_session: "per session",
    portal_wow_pricing_range: "{min} – {max} per session",
    portal_wow_testimonials_eyebrow: "In their own words",
    portal_wow_testimonials_title: "What patients say.",
    portal_wow_anonymous_author: "Patient, name withheld",
    portal_wow_drafted_pages_badge: "Already drafted for you",
    portal_wow_journal_eyebrow: "Insights, in your voice",
    portal_wow_journal_title: "Three drafts, ready to publish.",
    portal_wow_journal_reading: "{n}-min read",
    portal_wow_sources_eyebrow: "Pulled in from",
    portal_wow_sources_title: "Every detail above came from a real source.",
    portal_wow_source_google_places: "Google",
    portal_wow_source_headway: "Headway",
    portal_wow_source_psychology_today: "Psychology Today",
    portal_wow_source_zencare: "Zencare",
    portal_wow_source_website: "Your website",
    portal_wow_source_npi: "NPI registry",
    portal_wow_source_website_meta: "Your website",
    portal_wow_social_eyebrow: "Find us elsewhere",
  },
  es: {
    // Nav
    nav_templates: "Plantillas",
    nav_pricing: "Precios",
    nav_how: "Cómo funciona",
    nav_blog: "Blog",
    nav_about: "Nosotros",
    nav_talk: "Hablemos",
    nav_lang_select: "Idioma",
    nav_lang_en: "Inglés",
    nav_lang_es: "Español",

    // Footer
    footer_tagline:
      "Sitios web boutique para terapeutas de salud mental en Texas. Lo construimos, lo cuidamos y lo mantenemos en marcha en silencio — nada que tú tengas que aprender ni mantener. Tres planes: Boutique $199, Pro $299, Concierge $649 — todo incluido.",
    footer_col_product: "Producto",
    footer_col_company: "Compañía",
    footer_col_legal: "Legal",
    footer_privacy: "Privacidad",
    footer_terms: "Términos",
    footer_disclaimer:
      "Los testimonios mostrados son ilustraciones compuestas a partir de entrevistas de investigación con usuarios.",
    footer_rights: "Todos los derechos reservados.",
    footer_trust_hipaa: "Privacidad primero, su EHR guarda los datos de pacientes",
    footer_trust_residency: "Datos alojados en EE. UU. · Austin, TX",
    footer_trust_owned: "Propiedad independiente, sin PE ni deuda",
    footer_tax_line:
      "Gasto comercial 100% deducible (IRS §162). Enviamos un W-9 y facturas detalladas a fin de año para su contador.",
    contact_investor_banner_label: "¿Inversor o socio?",
    // {email} se interpola en Contact.tsx desde `VITE_PARTNERSHIPS_EMAIL`.
    contact_investor_banner_cta: "Escríbenos a {email}",

    // Hero
    hero_eyebrow: "PARA EL TERAPEUTA QUE NO SE FORMÓ PARA HACER SITIOS WEB.",
    hero_title_l1: "Lo construimos nosotros.",
    hero_title_l2: "Tú ves pacientes.",
    hero_subhead:
      "Un pequeño estudio en Austin escribe, diseña y mantiene en silencio una página serena — para que el paciente que sería el adecuado para ti aterrice en ti, no en una cuadrícula de directorio.",
    hero_cta: "Hablemos",
    hero_cta_secondary: "Ver las plantillas",

    // ── Atrium template (pilot for the design-system rebuild) ──
    atrium_hero_eyebrow: "PSICOTERAPIA · AUSTIN, TX",
    atrium_hero_alt:
      "Una sala de espera de psicoterapia boutique en lino y azul pizarra con una butaca con la luz de la mañana",
    atrium_hero_headline_l1: "Para el trabajo paciente",
    atrium_hero_headline_em: "de volverte tú mismo.",
    atrium_hero_subhead:
      "Psicoterapia de fondo en inglés y español, al ritmo de adultos que reconstruyen una vida que ya no encaja.",
    atrium_hero_cta: "Iniciar una consulta",
    atrium_nav_cta: "Iniciar",
    atrium_services_heading: "Cómo trabajamos juntos",
    atrium_services_subhead: "Tres marcos para una misma práctica de fondo.",
    atrium_about_heading: "Conocer a {firstName}",
    atrium_about_quote:
      "La terapia a esta profundidad es la arquitectura paciente de una vida — estructural y tuya.",
    atrium_fees_heading: "Inversión",
    atrium_fees_note:
      "Escala reducida reservada para dos plazas por trimestre; pregunta en tu llamada de consulta.",
    atrium_insurance_heading: "Seguro",
    atrium_faq_heading: "Preguntas frecuentes",
    atrium_faq_q1: "¿Cuánto dura un curso típico de terapia?",
    atrium_faq_a1:
      "El trabajo de fondo suele desplegarse entre seis y dieciocho meses, con sesiones semanales y revisiones cada seis semanas.",
    atrium_faq_q2: "¿Atiendes en español?",
    atrium_faq_a2:
      "Sí — las sesiones pueden conducirse íntegramente en español, en inglés o combinando ambos.",
    atrium_faq_q3: "¿Qué pasa en la llamada de consulta?",
    atrium_faq_a3:
      "Una llamada gratuita de 15 minutos para ver si esta práctica es la adecuada. Solo preguntas prácticas — sin contenido clínico.",
    atrium_faq_q4: "¿Ofreces telesalud?",
    atrium_faq_a4:
      "Sí — sesiones en línea disponibles en todo Texas; sesiones presenciales en el centro de Austin.",
    atrium_booking_heading: "Comenzar",
    atrium_booking_subhead: "Una llamada de consulta gratuita de 15 minutos.",
    atrium_booking_secondary:
      "Solo preguntas prácticas — sin contenido clínico.",
    atrium_footer_design_by: "Diseño por ",

    // ── Garden template (Phase 2 port) ──
    garden_top_cta: "Reserva una llamada",
    garden_hero_eyebrow: "TERAPIA FAMILIAR INFORMADA EN TRAUMA · PLANO",
    garden_hero_headline: "Un espacio para respirar y crecer.",
    garden_hero_subhead:
      "Terapia familiar informada en trauma para niños, padres y parejas que están por ser padres — presencial en Plano y en línea en todo Texas.",
    garden_hero_cta: "Reserva una llamada gratis de 15 min",
    garden_hero_alt:
      "Una sala de terapia iluminada por el sol con un lirio de la paz, una monstera y un ficus lyrata",
    garden_services_heading: "En qué trabajamos",
    garden_services_subhead:
      "Tres habitaciones tranquilas dentro de la misma consulta.",
    garden_about_heading: "Sobre {firstName}",
    garden_about_quote:
      "La conexión se construye en pequeños gestos repetidos — ahí vive el trabajo.",
    garden_fees_heading: "Tarifas y seguro",
    garden_fees_note:
      "Las plazas de escala reducida se abren cada trimestre; pregúntame en la consulta.",
    garden_insurance_heading: "Seguro",
    garden_faq_heading: "Preguntas frecuentes",
    garden_faq_q1: "¿Atiendes a los niños a solas o siempre con padres?",
    garden_faq_a1:
      "Depende del niño y de la pregunta. La mayoría de mis sesiones con niños incluyen a un padre o madre en parte del trabajo, aunque vea al niño a solas en el medio.",
    garden_faq_q2: "¿Y si mi pareja no quiere venir a terapia?",
    garden_faq_a2:
      "Podemos empezar contigo. La terapia familiar no siempre requiere a toda la familia en la sala — requiere a la familia en la conversación. Hacemos un plan realista para tu hogar.",
    garden_faq_q3: "¿Ofreces sesiones en español?",
    garden_faq_a3:
      "Sí — las sesiones pueden ser íntegramente en español, en inglés o moviéndose entre ambos.",
    garden_faq_q4: "¿Cómo funciona la telesalud con niños?",
    garden_faq_a4:
      "Los niños más pequeños suelen estar mejor en persona; los más grandes y los adolescentes muchas veces prefieren telesalud. Vemos juntos qué mezcla funciona en la consulta.",
    garden_booking_heading: "Empieza la conversación",
    garden_booking_subhead:
      "Una llamada gratuita de 15 minutos para ver si soy una buena opción para tu familia.",
    garden_booking_secondary:
      "Solo preguntas prácticas — sin contenido clínico.",
    garden_footer_design_by: "Diseño por ",

    // ── Sunrise template (Phase 2 port) ──
    sunrise_top_cta: "Reservar llamada",
    sunrise_hero_eyebrow: "PERINATAL Y POSTPARTO · DALLAS · TELESALUD EN TEXAS",
    sunrise_hero_headline:
      "No estás fallando. Te estás convirtiendo en alguien nuevo.",
    sunrise_hero_subhead:
      "Terapia especializada para depresión y ansiedad postparto, trauma del parto y pérdida gestacional — en línea en todo Texas.",
    sunrise_hero_cta: "Reserva una llamada de 15 min",
    sunrise_hero_alt:
      "Una habitación iluminada por el amanecer con un sillón suave junto a la ventana — paleta cálida en pasteles",
    sunrise_glass_one_liner:
      "Certificada en salud mental perinatal · contigo desde la primera llamada.",
    sunrise_services_heading: "Dónde hacemos el trabajo",
    sunrise_services_subhead:
      "Tres habitaciones dentro de una misma especialidad.",
    sunrise_about_heading: "Sobre {firstName}",
    sunrise_about_quote:
      "No necesitas un diagnóstico ni un día especialmente malo para llamar.",
    sunrise_fees_heading: "Tarifas y seguro",
    sunrise_fees_note:
      "Aceptamos HSA/FSA; pregunta en tu consulta por superbills para reembolso fuera de la red.",
    sunrise_insurance_heading: "Seguro",
    sunrise_faq_heading: "Preguntas frecuentes",
    sunrise_faq_q1: "¿Es demasiado pronto — o demasiado tarde — para llamar?",
    sunrise_faq_a1:
      "Ninguno. La gente me escribe a las seis semanas postparto, tres años después, después de una pérdida, antes de una transferencia. No hay fecha de caducidad para este trabajo.",
    sunrise_faq_q2: "¿Puede venir mi pareja también?",
    sunrise_faq_a2:
      "Sí. El postparto y la pérdida gestacional son eventos familiares; muchas de mis sesiones incluyen a la pareja parte del tiempo. Encontramos juntos el ritmo correcto.",
    sunrise_faq_q3: "¿Cómo funciona la telesalud con un bebé?",
    sunrise_faq_a3:
      "La mayoría de mis pacientes postparto me ven desde un sofá con el bebé dormido al lado. Trabajamos alrededor de siestas, tomas y noches difíciles — ese es el sentido del formato.",
    sunrise_faq_q4: "¿Aceptas seguros?",
    sunrise_faq_a4:
      "BCBS, Aetna, United y Cigna en la red; HSA/FSA bienvenidos; superbills disponibles para reembolso fuera de la red.",
    sunrise_booking_heading: "Da la primera llamada",
    sunrise_booking_subhead:
      "Una llamada gratuita de 15 minutos para sentir si encajamos. Sin compromiso.",
    sunrise_booking_secondary:
      "Solo preguntas prácticas — sin contenido clínico.",
    sunrise_footer_design_by: "Diseño por ",

    // ── Polaroid template (Phase 2 port) ──
    polaroid_top_cta: "Reservar consulta",
    polaroid_hero_eyebrow: "TERAPIA Y CONSEJERÍA · EAST AUSTIN",
    polaroid_hero_headline: "Sanar empieza donde estás.",
    polaroid_hero_signature: "— {firstName}",
    polaroid_hero_subhead:
      "EMDR, IFS y trabajo somático para mujeres en sus 30 y 40, sobrevivientes de trauma infantil y personas en recuperación a largo plazo — presencial en East Austin y en línea en todo Texas.",
    polaroid_hero_cta: "Reserva una llamada gratis de 15 min",
    polaroid_photo_1_alt:
      "Una oficina de terapia tranquila con dos sillones suaves y una mesa baja",
    polaroid_photo_2_alt: "Una planta de interior en el alféizar de una ventana soleada",
    polaroid_photo_3_alt: "La terapeuta sosteniendo una taza tibia de té",
    polaroid_services_heading: "Cómo trabajamos",
    polaroid_services_subhead:
      "Tres modalidades, una sola práctica pausada.",
    polaroid_about_heading: "Sobre {firstName}",
    polaroid_about_quote:
      "Encontramos al cuerpo y a las partes. Ambos tienen cosas que decir que las palabras solas no alcanzan.",
    polaroid_fees_heading: "Tarifas y seguro",
    polaroid_fees_note:
      "Plazas de escala reducida disponibles a través de Open Path; pregunta en tu consulta.",
    polaroid_insurance_heading: "Seguro",
    polaroid_faq_heading: "Preguntas frecuentes",
    polaroid_faq_q1: "¿Con EMDR voy a revivirlo todo?",
    polaroid_faq_a1:
      "No. Primero construimos recursos — anclaje, trabajo de partes, habilidades corporales — para que el reprocesamiento ocurra a un ritmo que realmente puedas atravesar.",
    polaroid_faq_q2: "¿Puedo empezar con terapia de conversación y añadir EMDR después?",
    polaroid_faq_a2:
      "Sí. Muchas de mis pacientes pasan los primeros dos o tres meses sintiéndose cómodas en la sala antes de tocar las modalidades más profundas. Vamos en el orden que encaje.",
    polaroid_faq_q3: "¿Aceptas mi seguro?",
    polaroid_faq_a3:
      "BCBS y Aetna en la red; Open Path para escala reducida; superbills disponibles para reembolso fuera de la red en la mayoría de los demás planes.",
    polaroid_faq_q4: "¿Cuál es la política de cancelación?",
    polaroid_faq_a4:
      "Aviso con 24 horas, sin costo. Menos de 24 horas y se cobra la sesión — el espacio está reservado para ti, el trabajo está reservado para ti, el costo refleja eso.",
    polaroid_booking_heading: "Empieza una conversación",
    polaroid_booking_subhead:
      "Una llamada gratuita de 15 minutos para ver si encajamos. Sin compromiso.",
    polaroid_booking_secondary:
      "Solo preguntas prácticas — sin contenido clínico.",
    polaroid_footer_design_by: "Diseño por ",

    // ── Playful Modern template (Phase 2 port) ──
    playful_top_cta: "Match",
    playful_hero_eyebrow: "TERAPIA EN LÍNEA · TEXAS",
    playful_hero_headline: "Terapia que no se siente como terapia.",
    playful_hero_subhead:
      "TCC + ACT para adultos de 25 a 40 que atraviesan ansiedad, TDAH, perfeccionismo y esa parte de ser adultx que nadie te explicó.",
    playful_hero_cta: "Encuentra match en 90 segundos",
    playful_hero_alt:
      "Un retrato editorial luminoso — terapeuta en videollamada, pared color salvia, planta en cuadro",
    playful_carousel_label: "En qué trabajamos",
    playful_chip_anxiety: "ansiedad",
    playful_chip_adhd: "TDAH",
    playful_chip_perfectionism: "perfeccionismo",
    playful_chip_burnout_early: "burnout temprano",
    playful_chip_imposter: "síndrome del impostor",
    playful_chip_relationships: "relaciones",
    playful_chip_identity: "identidad",
    playful_chip_burnout_recovery: "recuperación del burnout",
    playful_services_heading: "Tres habitaciones, un solo match.",
    playful_services_subhead: "Elige la puerta que suene a ti.",
    playful_about_heading: "Conoce a {firstName}",
    playful_about_quote:
      "No necesitas un cerebro más tranquilo. Necesitas una relación distinta con el que ya tienes.",
    playful_fees_heading: "Cuánto cuesta",
    playful_fees_note:
      "Quiz gratuito de 90 segundos antes de la primera sesión — nos ahorra tiempo a todxs.",
    playful_insurance_heading: "Seguro",
    playful_faq_heading: "Preguntas reales",
    playful_faq_q1: "¿Qué tan rápido podemos empezar?",
    playful_faq_a1:
      "Quiz hoy, primera cita en la semana. Mantengo horarios de tarde específicamente para quienes no pueden tomarse un martes libre.",
    playful_faq_q2: "¿Y si nunca he ido a terapia?",
    playful_faq_a2:
      "Perfecto. La primera sesión la dedicamos a lo que quieres, lo que te da miedo, y a definir qué te diría que esto está funcionando — y qué te diría que no.",
    playful_faq_q3: "¿Solo en línea — en serio?",
    playful_faq_a3:
      "En serio. La evidencia en telesalud para ansiedad y TDAH es sólida, y el formato es la diferencia entre 'semanal' y 'empiezo en enero'.",
    playful_faq_q4: "¿Lo cubre mi seguro?",
    playful_faq_a4:
      "BCBS y Aetna en la red; pago privado + HSA/FSA aceptados; superbills disponibles para reembolso fuera de la red.",
    playful_booking_heading: "Haz el quiz",
    playful_booking_subhead:
      "90 segundos, ocho preguntas, sin email hasta el final. Vemos el match antes de que reserves.",
    playful_booking_secondary: "O reserva una llamada de 15 min.",
    playful_footer_design_by: "Diseño por ",

    // ── Constellation template (Phase 2 port) ──
    cn_top_cta: "Agendar",
    cn_hero_eyebrow: "TERAPIA EJECUTIVA · HOUSTON",
    cn_hero_headline_pre: "Para",
    cn_hero_headline_emphasis: "personas de alto rendimiento",
    cn_hero_headline_post: "que ya no duermen.",
    cn_hero_subhead:
      "TCC, ACT, IFS y un marco de coaching ejecutivo para fundadores, C-suite y creativos en la cima de su campo.",
    cn_hero_cta: "Reserva una consulta confidencial de 15 min",
    cn_hero_alt: "Una oficina de Houston con luz tenue al atardecer",
    cn_services_heading: "Dónde sucede el trabajo",
    cn_services_subhead: "Tres temporadas con nombre. Un solo marco.",
    cn_about_heading: "Sobre {firstName}",
    cn_about_quote:
      "El monólogo interno que te trajo hasta aquí también es el que no te deja dormir. Lo re-entrenamos — no lo silenciamos.",
    cn_fees_heading: "Inversión",
    cn_fees_note:
      "Solo fuera de la red; superbills proporcionados para reembolso. HSA/FSA aceptados.",
    cn_insurance_heading: "Seguro",
    cn_faq_heading: "Preguntas frecuentes",
    cn_faq_q1: "¿Cuál es la cadencia de un curso típico?",
    cn_faq_a1:
      "Semanal al principio; reevaluamos a las seis semanas. La mayoría de los cursos duran de seis a doce meses. Los intensivos ejecutivos se programan por separado.",
    cn_faq_q2: "¿Es confidencial — incluso de mi empleador?",
    cn_faq_a2:
      "Sí. No estoy contratada por ningún empleador. La relación es entre nosotras; nada se comparte sin tu autorización por escrito.",
    cn_faq_q3: "¿Aceptas seguro?",
    cn_faq_a3:
      "Solo fuera de la red. Proporciono un superbill mensual para cualquier plan que ofrezca reembolso OON; HSA/FSA aceptados.",
    cn_faq_q4: "¿Las sesiones pueden ser más tarde en el día?",
    cn_faq_a4:
      "Sí — mantengo horarios de tarde específicamente para clientes ejecutivos. Telesalud y presencial disponibles en todo Texas.",
    cn_booking_heading: "Agenda la consulta",
    cn_booking_subhead:
      "Una llamada confidencial de 15 minutos. Preguntas prácticas, sin contenido clínico.",
    cn_booking_secondary: "O escribe a elena@elenapark.com.",
    cn_footer_design_by: "Diseño por ",

    // ── Front Porch template (Phase 3 new template) ──
    fp_top_cta: "Llamada gratis",
    fp_hero_eyebrow: "TERAPIA DE PAREJA Y FAMILIAR · SAN ANTONIO",
    fp_hero_headline:
      "Ayudo a parejas a descubrir qué está pasando de verdad.",
    fp_hero_subhead:
      "Formado en Gottman. Presencial en Stone Oak, telesalud en todo Texas. En la red con BCBS, Aetna y United.",
    fp_hero_cta: "Reserva una llamada gratis de 15 min",
    fp_hero_alt:
      "Un terapeuta en un porche al atardecer, mirada cálida y directa",
    fp_services_heading: "En qué trabajo",
    fp_services_subhead: "Tres habitaciones. Una sola conversación pausada.",
    fp_about_heading: "Sobre {firstName}",
    fp_about_quote:
      "Averiguamos qué está pasando realmente por debajo de las peleas que se repiten — y cómo dejar de tener la misma dos veces.",
    fp_fees_heading: "Tarifas y seguro",
    fp_fees_note:
      "En la red con BCBS, Aetna y United. HSA/FSA aceptados; superbills disponibles para cualquier otro plan.",
    fp_insurance_heading: "Seguro",
    fp_faq_heading: "Preguntas frecuentes",
    fp_faq_q1: "¿Tenemos que venir los dos a la primera sesión?",
    fp_faq_a1:
      "Idealmente sí — la primera sesión funciona mejor con ambas personas en la sala. Si solo uno de los dos está listo, podemos empezar ahí y sumar al otro cuando sea momento.",
    fp_faq_q2: "¿Cuánto suele durar la terapia de pareja?",
    fp_faq_a2:
      "La mayoría de mis parejas ven un cambio real en los primeros tres meses y terminan un curso de trabajo entre seis y doce meses. Reevaluamos juntos a las seis semanas.",
    fp_faq_q3: "¿Haces terapia familiar con niños en la sala?",
    fp_faq_a3:
      "Sí — niños desde los seis años. Más pequeños, suelo trabajar con los padres para acompañar al sistema familiar en lugar de trabajar directo con el niño.",
    fp_faq_q4: "¿Cuál es la política de cancelación?",
    fp_faq_a4:
      "Aviso con 24 horas, sin costo. Menos de 24 horas, se cobra la sesión — el espacio quedó reservado para ti.",
    fp_booking_heading: "Acércate al porche",
    fp_booking_subhead:
      "Una llamada gratis de 15 minutos. Vemos si encajamos antes de que reserves sesión.",
    fp_booking_secondary:
      "Solo preguntas prácticas — sin contenido clínico.",
    fp_footer_design_by: "Diseño por ",

    // ── Hello Friend template (Phase 3 new template, port 8) ──
    hf_top_cta: "Cuéntame qué pasa →",
    hf_hero_eyebrow: "TERAPIA QUEER Y NEURODIVERGENTE · TEXAS · EN LÍNEA",
    hf_hero_headline:
      "Hola, soy {firstName}. Acompaño a personas en sus 20 y 30 a averiguar qué les pasa.",
    hf_hero_signature: "— pero en buena onda",
    hf_hero_subhead:
      "Sobre todo adultos queer, mucho TDAH que nadie detectó antes, y muchas personas cuyo arreglo 'high-functioning' dejó de funcionar. Escala reducida ($80–$140), todo en línea.",
    hf_hero_cta: "Cuéntame qué pasa",
    hf_hero_alt: "{firstName} con una taza, riéndose fuera de cámara",
    hf_chip_anxiety: "ansiedad",
    hf_chip_adhd: "TDAH",
    hf_chip_queer: "identidad queer",
    hf_chip_burnout: "burnout temprano",
    hf_chip_identity: "identidad",
    hf_chip_relationships: "relaciones",
    hf_services_heading: "De qué probablemente hablaríamos",
    hf_services_subhead: "Tres habitaciones. Una conversación.",
    hf_about_heading: "Más sobre {firstName}",
    hf_about_quote:
      "Mereces un 'no' que llegue rápido más que un 'tal vez' que se alarga.",
    hf_fees_heading: "Cuánto cuesta",
    hf_fees_note:
      "Solo escala reducida. No tomo seguros — superbills disponibles si tu plan reembolsa fuera de la red.",
    hf_insurance_heading: "Seguro",
    hf_faq_heading: "Preguntas reales",
    hf_faq_q1: "¿Por qué un formulario en lugar de un calendario?",
    hf_faq_a1:
      "Porque elegir hora antes de hablar es al revés. Cuéntame qué pasa, te respondo en un día hábil, y si somos un buen match buscamos un horario juntxs.",
    hf_faq_q2: "¿Aceptas mi seguro?",
    hf_faq_a2:
      "No. Solo escala reducida ($80–$140), fuera de la red con todos. Si tu plan reembolsa OON te doy superbills.",
    hf_faq_q3: "¿De verdad trabajas con todo lo que sale en los chips?",
    hf_faq_a3:
      "Sí. No todo a la vez, no todo en la primera sesión — pero sí. La mayoría de mis pacientes tienen al menos dos cosas pasando en paralelo.",
    hf_faq_q4: "¿La práctica es queer-affirming o queer-focused?",
    hf_faq_a4:
      "Ambas. Soy queer, la práctica está construida alrededor de trabajo queer y neurodivergente, y la mayoría de mis pacientes son LGBTQ+. No tienes que explicar lo básico.",
    hf_booking_heading: "Mándame un mensaje",
    hf_booking_subhead:
      "Tres campos. Dos minutos. Cada uno lo leo yo.",
    hf_booking_secondary: "O escribe a hello@samcastillo.com.",
    hf_footer_design_by: "Diseño por ",

    // ── Intake form (Hello Friend) ──
    intake_title: "Cuéntale a {firstName} qué pasa.",
    intake_subtitle:
      "Tres campos. Dos minutos. {firstName} los lee cada uno y te responde en un día hábil.",
    intake_label_name: "Tu nombre",
    intake_placeholder_name: "Solo el primer nombre está bien",
    intake_label_message: "¿Qué tienes en la cabeza?",
    intake_placeholder_message: "Lo que se sienta honesto. Máx. 200 caracteres.",
    intake_label_contact: "Mejor forma de contactarte",
    intake_placeholder_contact: "Email o teléfono — tú decides",
    intake_submit: "Enviar",
    intake_success_title: "Recibido — gracias por escribir.",
    intake_success_body:
      "{firstName} va a leer esto y te responde en un día hábil. Si es urgente y no puedes esperar, la línea 988 al final de la página está disponible 24/7.",
    intake_required: "Obligatorio",
    intake_char_remaining: "Quedan {n} caracteres",

    // Value strip
    value_domain_oneliner:
      "Lo configuramos, lo cuidamos y lo mantenemos al día con suavidad — nada que tú tengas que aprender ni mantener.",
    value_cancel_oneliner:
      "Cancela en los primeros 90 días. Después, solo 30 días de aviso — sin penalización.",

    // Voice + soft-landing
    voice_eyebrow: "Por qué los pacientes te eligen",
    voice_title:
      "El paciente adecuado está buscando esta noche. Debería aterrizar en ti — no en una cuadrícula de directorio.",
    voice_dir_label: "En un directorio",
    voice_dir_body:
      "Estás en la página tres entre cincuenta nombres ordenados por gasto publicitario. El paciente que sería el adecuado sigue desplazándose.",
    voice_ash_label: "En tu página Ashford",
    voice_ash_body:
      "Una página tranquila en su idioma — tu rostro, tus modalidades, tu enlace de reservación. La decisión de encaje ocurre antes de que llamen.",
    landing_eyebrow: "Un aterrizaje suave",
    landing_title: "Cuando alguien con dolor te encuentra, ¿en qué aterriza?",
    landing_dir_label: "Una cuadrícula de directorio",
    landing_dir_body:
      "Cincuenta caras ordenadas por gasto publicitario. Compara, duda, pierde el ánimo, cierra la pestaña.",
    landing_ash_label: "Tu sitio",
    landing_ash_body:
      "Una página tranquila, tu rostro, tus palabras. El trabajo empieza antes de la primera llamada.",

    // Problem
    problem_title_l1: "Alguien con dolor está buscando",
    problem_title_l2: "un terapeuta esta noche.",
    problem_p1:
      "// Aterriza en una cuadrícula de cincuenta caras — tú una de ellas, alfabetizada junto a un desconocido.",
    problem_p2:
      "// Compara, duda, pierde el ánimo, cierra la pestaña.",
    problem_p3:
      "// Una página tranquila en tu propia voz hubiera bastado.",

    // Differentiators
    diff1_title: "Una página que suena como tú, no una cuadrícula de casillas",
    diff1_desc:
      "Tu formación, tus modalidades, el trabajo que realmente haces — escrito en tu voz, no en un campo de bio de 280 caracteres junto a otros cincuenta nombres.",
    diff1_metric: "Desde $199/mes",
    diff1_stat:
      "Todo incluido. Tu sitio, la versión en español y todo lo que lo mantiene en marcha — ya incluido.",

    diff2_title: "Un lugar suave para aterrizar, para alguien con dolor",
    diff2_desc:
      "Una página tranquila, tu rostro, tus palabras. El trabajo empieza antes de la primera llamada — en lugar de cincuenta caras ordenadas por gasto publicitario.",
    diff2_metric:
      "Páginas de identidad, modalidades y atención afirmativa — incluidas.",
    diff2_stat: "",

    diff3_title: "{template_count_word_cap} plantillas curadas — y sigues eligiendo",
    diff3_desc:
      "Atrium para prácticas grupales modernas, Garden para trabajo cálido informado en trauma, Sunrise para perinatal y recuperación, Constellation para prácticas premium, Polaroid para un estilo personal y fotográfico, Playful Modern enérgica al estilo D2C, Front Porch para parejas y familia, Hello Friend conversacional y queer-friendly, y Quiet Practice psicoanalítica y sobria. Elige una, sin tarifa de rediseño.",
    diff3_metric: "9",
    diff3_stat: "direcciones, cada una con su paleta firma y su voz.",

    // Process
    process_title: "De primera conversación a sitio web en línea en 48 horas.",
    process_step_1_title: "Te llamamos",
    process_step_1_desc:
      "Una persona real en Austin contesta. Sin guion, sin presión — cuéntanos de tu práctica como se lo contarías a un colega tomando café. Escuchamos y tomamos notas.",
    process_step_2_title: "{template_count_word_cap} vistas previas reales llegan a tu correo",
    process_step_2_desc:
      "No son plantillas en blanco. {template_count_word_cap} sitios completos con tu nombre, tu trabajo y tus fotos ya en su lugar. Enséñalos a tu pareja, míralos con calma, consúltalos con la almohada. No hay prisa.",
    process_step_3_title: "Elige la que se sienta tuya",
    process_step_3_desc:
      "Te registramos una dirección web, y el precio mensual lo cubre todo — sin cargos sorpresa, sin extras, nunca. Tres planes a la medida de tu práctica: Boutique $199, Boutique Pro $299, Concierge $649.",
    process_step_4_title: "Nosotros ponemos las palabras — o tú",
    process_step_4_desc:
      "Cinco preguntas rápidas si quieres escribir el texto tú misma. ¿No tienes tiempo? Con tu permiso, redactamos un primer borrador cuidadoso a partir de lo que ya es público sobre tu práctica.",
    process_step_5_title: "Tu sitio está en línea en 48 horas",
    process_step_5_desc:
      "De la primera llamada a un sitio funcionando en dos días — tres si te estamos registrando la dirección web. Después, no piensas en él otra vez. Lo mantenemos rápido, seguro y cuidado. Para siempre.",

    // Pricing teaser
    pricing_eyebrow: "PRECIOS",
    pricing_title: "Tres planes. Un precio fijo cada uno.",
    pricing_subtitle:
      "Sin tarifas escondidas, sin contrato anual. Cancela en los primeros 90 días; después, solo 30 días de aviso.",
    pricing_a_label: "Qué incluye",
    pricing_a_setup: "Precio mensual todo incluido",
    pricing_a_desc:
      "Setup, renovación anual de tu dirección web, traducción al español y cuidado silencioso — todo incluido en un solo precio mensual.",
    pricing_b_label: "Elige tu plan",
    pricing_b_setup: "Boutique · Boutique Pro · Concierge",
    pricing_b_desc:
      "Boutique $199, Boutique Pro $299, Concierge $649 — elige el que se ajuste a tu práctica.",
    pricing_recommended: "Recomendado",
    pricing_monthly: "/ mes",
    pricing_see_full: "Ver precios y extras",

    // ---- MODELO DE NIVELES (refactor 2026-05)
    pricing_v2_hero_title: "Tres niveles. Un precio plano cada uno. Cancela cuando quieras.",
    pricing_v2_hero_sub:
      "El mismo cuidado boutique debajo de cada nivel. La única diferencia es cuántos multiplicadores de recepción incluimos por ti.",
    pricing_v2_foundation_title: "Lo que incluye cada nivel",
    pricing_v2_foundation_sub:
      "Siete cosas que cada sitio Ashford trae, en todos los niveles — para que nunca pagues extra por lo básico que un sitio de terapeuta ya debería hacer.",
    pricing_v2_compare_link:
      "Cómo nos comparamos con Brighter Vision, TherapySites, SimplePractice",
    pricing_v2_checkout_title: "Elige un nivel. Reserva en un minuto.",
    pricing_v2_checkout_sub:
      "Tarjeta en archivo, el cobro empieza cuando tu sitio sale en vivo. Sin costo de configuración. Cancela cuando quieras en los primeros 90 días.",
    pricing_v2_checkout_busy: "Iniciando…",
    pricing_v2_reserve: "Reservar",

    tier_boutique_label: "Boutique",
    tier_boutique_tagline:
      "Lo esencial, bellamente hecho. Sitio bilingüe, botón 988 sereno, tour de la oficina, presencia en Google, distintivo de tarifa móvil.",
    tier_boutique_cta: "Elegir Boutique",
    tier_boutique_pro_label: "Boutique Pro",
    tier_boutique_pro_tagline:
      "Todo lo de Boutique, más los cuatro multiplicadores de recepción: reserva online, video de primera visita, puente de telesalud y centro de onboarding del paciente.",
    // PHASE A.5 — copy de reservas de Pro.
    tier_boutique_pro_booking_note:
      "Integramos tu Calendly para que tus pacientes reserven directamente desde tu sitio.",
    tier_boutique_pro_cta: "Elegir Boutique Pro",
    tier_boutique_concierge_label: "Boutique Concierge",
    tier_boutique_concierge_tagline:
      "Todo lo de Pro, más conectamos su sala de telesalud Doxy existente y una Bitácora de Reflexiones escrita por nosotros — más de 14 piezas de autoridad clínica al año.",
    // PHASE A.6 — copy de telesalud y Bitácora de Reflexiones. El público
    // debe creer que un redactor humano escribe los artículos — sin
    // palabras como IA, automatizado, máquina, etc.
    tier_boutique_concierge_telehealth_note:
      "Conectamos tu sala de telesalud Doxy existente.",
    tier_boutique_concierge_journal_note:
      "Bitácora de Reflexiones: 14 artículos al año escritos por un redactor en tu voz y publicados en tu sitio.",
    // PHASE A.7 — llamada opcional de 20 minutos para configurar Doxy.
    tier_boutique_concierge_doxy_help_note:
      "Podemos tener una llamada de 20 minutos para ayudarte a configurar Doxy si lo necesitas. Incluido — no obligatorio.",
    tier_boutique_concierge_cta: "Elegir Boutique Concierge",
    tier_setup_free: "Sin costo de configuración",
    tier_everything_in_boutique_plus: "Todo lo de Boutique, más:",
    tier_everything_in_boutique_pro_plus: "Todo lo de Boutique Pro, más:",

    // Testimonials
    testimonials_eyebrow: "LO QUE DICEN LOS TERAPEUTAS",
    testimonials_title: "Entrevistas reales. Retratos compuestos.",

    // Blog teaser
    blog_eyebrow: "LECTURAS",
    blog_title: "Notas para terapeutas construyendo una práctica real online.",
    blog_view_all: "Ver todos los artículos",

    // CTA
    cta_title: "¿Listo para soltar el sitio web y solo ver pacientes?",
    cta_subtitle:
      "Habla con un representante real basado en Texas. Sin bots, sin embudos de email, sin compromiso — y nada que tú tengas que aprender ni mantener.",

    learn_more: "Más info",
    talk_to_us: "Hablemos",
    read_more: "Leer más",
    submit: "Enviar",
    sending: "Enviando...",
    success: "Recibido. Te contactamos dentro de un día hábil.",
    error_generic: "Algo salió mal. Inténtalo de nuevo o llámanos.",

    // Templates page
    tpl_title: "{template_count_word_cap} direcciones. Construimos la que elijas.",
    tpl_subtitle:
      "Cada plantilla está pensada para cómo el paciente adecuado realmente busca terapeutas — en silencio, a las 11pm, desde el teléfono. Elige una, mírala en vivo, y nosotros nos encargamos del resto.",
    tpl_seo_title: "Plantillas — {template_count_word} direcciones curadas",
    tpl_seo_desc:
      "{template_count_word_cap} plantillas inspiradas en sitios reales de terapeutas, cada una con su paleta firma. Mobile-first, rápidas, hechas para terapeutas.",
    tpl_card_eyebrow: "Plantilla",
    tpl_palettes_title: "Paleta firma",
    tpl_visit_demo: "Abrir demo en vivo",

    // Pricing page
    pricing_page_title: "Precios que respetan tu matemática de facturación.",
    pricing_page_sub:
      "Tres planes, un precio mensual fijo cada uno. Tu sitio, la versión en español y todo lo que lo mantiene en marcha ya están incluidos. Algunos extras opcionales, con precios como los esperarías de un estudio pequeño. Sin facturas sorpresa. Cancela en los primeros 90 días; después, solo avísanos con 30 días de antelación.",
    pricing_compare: "Comparar planes",
    pricing_addons_title: "Extras premium",
    pricing_addons_sub:
      "À la carte si los necesitas. Agrega o quita cuando quieras — sin tarifa de configuración.",
    pricing_packs_title: "Paquetes",

    // Pricing — encabezados de columna (3 agrupaciones de add-ons por audiencia)
    pricing_angle_client_eyebrow: "Para el cliente potencial",
    pricing_angle_client_title: "Lo que ven en tu sitio",
    pricing_angle_client_sub:
      "Funciones visibles que convierten a un visitante interesado en una primera sesión reservada.",
    pricing_angle_doc_eyebrow: "Para ti, el clínico",
    pricing_angle_doc_title: "Herramientas que construyen autoridad clínica",
    pricing_angle_doc_sub:
      "Escritura, búsqueda, tu nombre como autoridad en un tema — el tipo de trabajo que se acumula con el tiempo.",
    pricing_angle_gatekeeper_eyebrow: "Para la recepción",
    pricing_angle_gatekeeper_title: "Menos bandeja, menos faltas",
    pricing_angle_gatekeeper_sub:
      "Automatizaciones silenciosas que la oficina renueva año tras año.",

    pricing_includes_title: "Lo que incluye cada sitio",

    // LOT 3.13 — Concierge ghostwriter callout.
    pricing_concierge_journal_eyebrow: "Concierge · Diario de Insights",
    pricing_concierge_journal_title: "Tu voz clínica, en el registro.",
    pricing_concierge_journal_body:
      "Los suscriptores Concierge reciben un Diario de Insights escrito por nosotros — te entrevistamos 20 minutos y enviamos una pieza de 600 palabras en tu voz cada mes. Al año son 14+ publicaciones de autoridad clínica real que Google indexa, colegas citan, y pacientes potenciales leen.",

    pricing_modify_title: "¿Quieres cambios después del lanzamiento?",
    pricing_modify_body:
      "Escríbele a tu diseñador y te cotizamos antes de empezar — nunca trabajo en curso sin tu aprobación. Nunca te cobramos por arreglar nuestros propios errores.",

    // How
    how_title: "Cómo se construye realmente un sitio Ashford.",
    how_sub:
      "Somos transparentes en todo — desde la primera conversación hasta el día en que los pacientes empiezan a encontrarte. El estudio funciona porque los sitios funcionan, no porque el embudo sea inteligente.",

    // Blog
    blog_page_title: "El blog de Ashford",
    blog_page_sub:
      "Escritura práctica para terapeutas de Texas — fatiga de directorios, visibilidad en buscadores, y lo que el paciente correcto realmente necesita encontrar a las 11pm desde su teléfono.",
    blog_comments_title: "Comentarios",
    blog_no_comments: "Sé el primero en comentar.",
    blog_comment_name: "Tu nombre",
    blog_comment_practice: "Tu práctica (opcional)",
    blog_comment_body: "Tu comentario",
    blog_comment_submit: "Publicar comentario",
    blog_likes: "me gusta",
    blog_back: "Volver a todos los artículos",

    // About
    about_title: "Ayudamos a terapeutas de Texas a sonar como ellos mismos en línea.",
    about_sub:
      "Un pequeño estudio en Austin. Pasamos años escuchando a terapeutas de Texas describir dos cosas — la tarea de construir y mantener un sitio web, y al paciente que sigue desplazándose y los pasa de largo en una cuadrícula de directorio. Este estudio es lo que construimos en respuesta.",
    about_values_title: "En qué creemos",
    about_v1_title: "Nosotros nos encargamos del sitio. Tú te encargas de los pacientes.",
    about_v1_body:
      "Redacción, diseño, la versión en español, la reservación y todo lo que mantiene el sitio en marcha sin sobresaltos — todo nuestro. Nada que tú tengas que aprender ni mantener.",
    about_v2_title: "Boutique > inflado.",
    about_v2_body:
      "Cada pod limita a 200 sitios activos para que el representante que te llama el día uno sea el mismo humano que contesta el correo el día 365. Abrimos pods regionales nuevos según lo amerite el mercado.",
    about_v3_title: "El español no es negociable en Texas.",
    about_v3_body:
      "Cada sitio se entrega en inglés y español — traducción real, no Google Translate. El paciente que busca en su primer idioma realmente aterriza en ti.",

    legal_privacy_title: "Política de privacidad",
    legal_terms_title: "Términos de servicio",
    legal_refund_title: "Política de reembolso",
    legal_sms_title: "Consentimiento de SMS",
    footer_refund: "Política de reembolso",
    footer_sms: "Consentimiento de SMS",

    // Self-serve checkout (Pricing)
    pricing_start_now: "Empezar ahora",
    pricing_start_now_sub: "Paga tu cargo de bienvenida y nos ponemos en contacto contigo en un día hábil para empezar.",
    pricing_addons_choose: "Extras (opcional)",
    pricing_total_monthly: "Total mensual",
    pricing_setup_due: "Pago único hoy",
    pricing_no_setup: "Sin tarifa de inicio",
    pricing_tax_note:
      "Gasto comercial 100% deducible (IRS §162). Enviamos un W-9 y facturas detalladas a fin de año para su contador.",
    tier_tax_deductible_bullet: "Gasto comercial 100% deducible de impuestos",
    tier_tax_deductible_sub: "Enviamos facturas detalladas + W-9 a fin de año para tu contador.",
    pricing_starting_checkout: "Iniciando pago…",
    pricing_checkout_failed: "No pudimos iniciar el pago. Inténtalo de nuevo o escribe a hello@ashfordcreative.org.",

    // === Divulgación de aceptación de SMS ===
    // ÚNICA FUENTE DE VERDAD para el párrafo de consentimiento.
    sms_consent_disclosure: SMS_CONSENT_DISCLOSURE_ES,
    sms_consent_label:
      "Sí, acepto recibir mensajes SMS de Ashford Creative al número de arriba.",
    sms_consent_required_error:
      "Marca la casilla de consentimiento de SMS, o quita tu número de teléfono para enviar sin SMS.",

    // === Página de contacto (`/contact`) ===
    nav_contact: "Contacto",
    contact_seo_title:
      "Contacta a Ashford Creative — habla con un representante en Texas, en inglés o español",
    contact_seo_desc:
      "Comunícate con el estudio de Ashford Creative. Respondemos en un día hábil, en inglés o español, por llamada, mensaje o correo — tú eliges.",
    contact_eyebrow: "CONTACTO",
    contact_title: "Habla con un representante real basado en Texas.",
    contact_subtitle:
      "Respondemos en un día hábil, en inglés o español. Llamada, mensaje o correo — el que mejor te acomode.",
    contact_form_heading: "Envíanos un mensaje",
    contact_form_name: "Tu nombre",
    contact_form_practice: "Nombre de la práctica (opcional)",
    contact_form_email: "Correo",
    contact_form_phone: "Teléfono (opcional — un número de Texas funciona mejor)",
    contact_form_phone_hint:
      "Agrega tu número solo si quieres una llamada o mensaje. Agregar un número requiere consentimiento de SMS abajo.",
    contact_form_pref: "¿Cómo prefieres que te contactemos primero?",
    contact_form_time: "Mejor hora para contactarte (hora de Texas, opcional)",
    contact_form_message: "¿Algo que debamos saber? (opcional)",
    contact_form_submit: "Enviar mensaje",
    contact_form_sending: "Enviando…",
    contact_form_success_title: "Recibido — hablamos pronto.",
    contact_form_success_body:
      "Un representante real basado en Texas te contactará en un día hábil. Sin árboles telefónicos, sin embudos de correo.",
    contact_form_error_email_or_phone:
      "Por favor proporciona un correo o un teléfono para que podamos contactarte.",
    contact_other_ways_eyebrow: "CANALES DIRECTOS",
    contact_other_ways_title: "¿Prefieres lo tradicional?",
    contact_other_ways_email_label: "Correo",
    contact_other_ways_voice_label: "Voz y SMS",
    contact_other_ways_hours_label: "Horario",
    contact_other_ways_hours_value: "Lun–Vie, 9am–6pm CT",
    contact_other_ways_address_label: "Estudio",
    contact_other_ways_address_value: "Austin, Texas",

    // Chatbot
    cb_open: "Hablemos",
    cb_close: "Cerrar",
    cb_greeting:
      "Hola — estoy aquí para responder preguntas rápidas sobre Ashford Creative. ¿Qué te trae por aquí?",
    cb_q_see: "Quiero ver cómo se vería mi sitio",
    cb_q_cost: "¿Cuánto cuesta?",
    cb_q_fast: "¿Qué tan rápido pueden lanzar?",
    cb_q_human: "Quiero hablar con una persona",
    cb_back: "Volver al inicio",
    cb_phi_disclaimer:
      "No comparta información médica de pacientes aquí. Para preguntas médicas, use el portal de su terapeuta.",
    cb_form_title: "Cuéntanos un poco sobre ti y te contactamos.",
    cb_form_name: "Tu nombre",
    cb_form_practice: "Nombre de la práctica",
    cb_form_email: "Correo",
    cb_form_phone: "Teléfono (un número de Texas funciona mejor)",
    cb_form_pref: "¿Cómo prefieres que te contactemos primero?",
    cb_form_pref_callback: "Llámame",
    cb_form_pref_sms: "Mándame texto",
    cb_form_pref_email: "Mándame correo",
    cb_form_message: "¿Algo que debamos saber?",
    cb_form_time: "Mejor hora para contactarte (hora de Texas)",
    cb_form_submit: "Enviar",
    cb_thanks:
      "Gracias — un representante basado en Texas te contactará dentro de un día hábil. Sin árboles telefónicos, sin embudos.",
    cb_error:
      "No pudimos enviar eso. Inténtalo de nuevo, o llámanos al número en la página de contacto.",

    // Chatbot scripted branches
    cb_see_bot:
      "{template_count_word_cap} direcciones de plantilla — Garden (cálida, sensible al trauma), Sunrise (perinatal, recuperación), Constellation (premium, adultos de alto rendimiento), Polaroid (personal, fotográfico), Playful Modern (enérgico, fluido con la Gen-Z), Front Porch (parejas + familia, raíces tejanas), y Hello Friend (conversacional, queer/ND-afirmativo). Cada una con su propia paleta y voz. ¿Quieres verlas ahora o que un representante te las muestre?",
    cb_see_show: "Ver las plantillas",
    cb_see_call: "Que un representante me llame",
    cb_see_link_bot:
      "La página de plantillas está en /templates — ábrela en otra pestaña. Cuando veas una favorita, vuelve y dinos tu nombre — generamos una vista previa personalizada con la información real de tu práctica.",
    cb_see_link_cta: "Quiero mi vista previa personalizada",
    cb_cost_bot:
      "Tres planes, todo incluido: Boutique $199, Boutique Pro $299, Concierge $649. Cada uno cubre tu sitio, la versión en español y todo lo que hacemos para mantenerlo en marcha. Sin cuota inicial. Sin contratos — cancela en los primeros 90 días, después solo 30 días de aviso.",
    cb_cost_addons: "¿Y los extras?",
    cb_cost_call: "Que un representante me llame",
    cb_addons_bot:
      "Un menú pequeño y cuidado de extras — reservas online, una nota de seguros y escala variable, un video de bienvenida para la primera visita, un espacio tranquilo para escribir, formularios de admisión, y algunos más. Cada uno cuesta entre $10 y $20 al mes. Agrega o aparta cualquiera cuando quieras.",
    cb_addons_call: "Que un representante me lo explique",
    cb_fast_bot:
      "48 horas si te registramos un dominio nuevo. Si traes el tuyo, suele sumar un día mientras se hace el cambio. De cualquier forma, más rápido que la próxima cita disponible en tu propia agenda.",
    cb_fast_call: "Que un representante me llame",
    cb_open_pricing: "Abrir la página de precios",
    cb_open_templates: "Abrir la página de plantillas",
    cb_open_how: "Abrir cómo funciona",

    // Home — SEO
    home_seo_title:
      "Sitios web boutique para terapeutas en Texas — construidos y mantenidos por nosotros",
    home_seo_desc:
      "Un pequeño estudio de Austin escribe, diseña y cuida en silencio una página serena para que el paciente adecuado realmente te encuentre y te elija. Tres planes desde $199/mes, todo incluido. Cada detalle — gestionado. Cancela en los primeros 90 días.",

    // Home — composite testimonials
    home_t1_quote:
      "Llevaba nueve años en un directorio. A los dos meses de lanzar con Ashford, más pacientes me decían en la primera llamada que ya podían notar, antes de agendar, que yo era la persona indicada.",
    home_t1_name: "Compuesto — LCSW, práctica EMDR",
    home_t1_city: "Houston",
    home_t2_quote:
      "Somos una práctica grupal con ocho clínicos. El video de primera visita y la página tranquila bilingüe dejaron claro a los pacientes — desde la primera llamada — que éramos la opción correcta antes de agendar.",
    home_t2_name: "Compuesto — Dueña de práctica grupal",
    home_t2_city: "Austin",
    home_t3_quote:
      "El español incluido fue enorme. Pacientes hispanohablantes me encontraban por buscador y yo podía ver exactamente qué páginas estaban haciendo el trabajo.",
    home_t3_name: "Compuesto — Psicóloga en Austin",
    home_t3_city: "San Antonio",

    // Home — Atelier sections (graduated 2026-04-27 from canvas mockup)
    home_handled_title: "Todo gestionado.",
    home_handled_subtitle:
      "No te hiciste terapeuta para pelearte con la parte técnica de un sitio web. Nosotros nos encargamos de todo eso por ti — en silencio, en segundo plano.",
    home_handled_48h_title: "Horas desde la llamada hasta el sitio en vivo",
    home_handled_48h_body:
      "Un representante real, basado en Texas, toma tus datos. Nosotros construimos el sitio. Si te registramos una dirección nueva, lanzamos en 48 horas. Si traes la tuya, suele sumar un día mientras se hace el cambio.",
    home_handled_bilingual_title: "Traducción real al español",
    home_handled_bilingual_body:
      "Cada sitio se entrega en inglés y español — traducción real, no Google Translate. El paciente que busca en español aterriza en ti.",
    home_handled_hosting_title: "Cuidado, día y noche",
    home_handled_hosting_body:
      "Cuidamos tu sitio en silencio — cada detalle gestionado en segundo plano. Nunca tendrás que iniciar sesión.",
    home_voice_quote:
      "Boutique es mejor que inflado. Cada pod limita a 200 sitios activos, así que el representante que te atiende el primer día es el mismo el día 365.",
    home_templates_title_l1: "Siete estilos.",
    home_templates_title_l2: "Un precio único.",
    home_templates_subtitle:
      "Siete plantillas curadas, cada una con su paleta firma. Elige una dirección, mírala en vivo con el contenido real de tu práctica, luego la construimos. Tranquilas, cuidadas, fáciles de leer en cualquier teléfono.",
    home_tpl_constellation_name: "Constellation",
    home_tpl_constellation_desc: "Modo oscuro cinematográfico para prácticas premium.",
    home_tpl_garden_name: "Garden",
    home_tpl_garden_desc: "Para una atención cálida y familiar.",
    home_tpl_polaroid_name: "Polaroid",
    home_tpl_polaroid_desc: "Para voces personales y fotográficas.",
    home_templates_view_all: "Ver las siete plantillas",
    home_studio_l1:
      "Pasamos años escuchando a terapeutas describir la pesadilla de construir un sitio web, y al paciente que sigue de largo en una cuadrícula de directorio.",
    home_studio_l2: "Este estudio es lo que construimos en respuesta.",

    // Home — certification chips
    cert_texas: "Basados en Texas",
    cert_boutique: "Boutique (200 / pod)",
    cert_bilingual: "EN / ES",
    cert_crisis: "Recursos de crisis (988)",
    cert_founded: "Fundada en 2014",
    loading: "Cargando…",
    blog_no_articles: "No hay artículos aún.",
    nf_eyebrow: "404",
    nf_title: "Página no encontrada",
    nf_body: "Esa URL no coincide con nada. Prueba la página principal o la de plantillas.",
    nf_cta: "Volver al inicio",
    tpl_not_found: "Plantilla no encontrada.",

    // === Prospect portal (`/preview/:slug`) ===
    portal_loading: "Cargando tu vista previa…",
    portal_invalid_title: "Este enlace de vista previa no es válido",
    portal_invalid_help:
      "Si tu representante te envió aquí, puede reenviarte un enlace nuevo.",
    portal_collapse: "Contraer barra",
    portal_expand: "Expandir barra",
    portal_prepared_for: "Preparado para",
    portal_your_build: "Tu sitio",
    portal_per_month: "/mes",
    portal_tax_note: "100% deducible de impuestos · W-9 + facturas",
    portal_reserve_cta: "Reservar",
    portal_design_template: "Plantilla de diseño",
    portal_optional_addons: "Complementos opcionales",
    portal_extras_included_header: "Incluido",
    portal_extras_addons_header: "Complementos",
    portal_addons_hint: "Toca para añadir — la vista aparece abajo",
    portal_setup_one_time: "+ {amount} configuración única",
    portal_addons_count_one: "· +1 complemento",
    portal_addons_count_other: "· +{n} complementos",
    portal_collapsed_teaser:
      "Personaliza tu sitio · dominio incluido · colores · complementos",
    portal_pick_toast_saved: "Guardado · {label}",
    portal_pick_toast_added: "Añadido · {label}",
    portal_added_chip_eyebrow: "Añadido a tu sitio",
    portal_added_chip_one: "1 complemento añadido",
    portal_added_chip_other: "{n} complementos añadidos",
    portal_addon_remove_aria: "Quitar {label}",
    portal_inline_domain_label: "Tu dominio gratis",
    portal_use_template_aria: "Usar la plantilla {label}",
    portal_premium_badge: "· Premium",
    portal_jump_preview: "Ir a la vista previa",
    portal_live_eyebrow: "Vista previa de complementos en vivo",
    portal_live_title: "Tu sitio, con los extras que elegiste",
    portal_live_subtitle:
      "Cada sección abajo es una vista previa real de lo que verán tus visitantes — activa o desactiva los complementos en la barra superior.",

    // === "Tu sitio, reinterpretado" — sección de páginas (espejo
    //     de solo lectura de cada página rastreada, reescrita con
    //     la voz de la plantilla activa) ===
    portal_pages_eyebrow: "Tu sitio, reinterpretado",
    portal_pages_title: "Recrearemos tu sitio actual, página por página",
    portal_pages_subtitle_prefix:
      "Cada página a continuación está reescrita en la dirección ",
    portal_pages_subtitle_suffix: ".",
    portal_pages_nav_aria: "Navegación de páginas",
    portal_pages_rewritten_voice: "Reescrito con el estilo {label}",
    portal_pages_draft_placeholder:
      "(Redactaremos esta sección al confirmar la dirección.)",
    portal_pages_imagery: "Imágenes de tu página",
    portal_pages_no_images: "No se obtuvieron imágenes de esta página.",

    // === Barra de navegación de páginas fija en la plantilla activa
    //     (lista las páginas que rastreamos del sitio actual del
    //     prospecto, para que pueda recorrer cada página reconstruida
    //     en la plantilla elegida, igual que sus visitantes en el sitio
    //     final) ===
    portal_pagesbar_aria: "Páginas del sitio",
    portal_pagesbar_eyebrow: "Páginas",
    portal_pagesbar_kind_home: "Inicio",
    portal_pagesbar_kind_about: "Nosotros",
    portal_pagesbar_kind_services: "Servicios",
    portal_pagesbar_kind_team: "Equipo",
    portal_pagesbar_kind_contact: "Contacto",
    portal_pagesbar_kind_fees: "Tarifas",
    portal_pagesbar_kind_blog: "Blog",
    portal_pagesbar_kind_other: "Página",
    portal_rebuilt_body_eyebrow: "Cuerpo del texto, reconstruido",
    portal_rebuilt_view_original: "Ver página original",

    // === Habla con una persona (panel de ayuda fijo) ===
    portal_help_button: "Habla con una persona",
    portal_help_button_short: "Ayuda",
    portal_help_aria_open: "Abrir panel de ayuda — habla con una persona",
    portal_help_aria_close: "Cerrar panel de ayuda",
    portal_help_panel_eyebrow: "Tu representante de Ashford",
    portal_help_panel_intro:
      "¿Dudas sobre tu sitio? {firstName} responde en minutos — sin formularios, sin embudos.",
    portal_help_call: "Llama al {phone}",
    portal_help_text: "Envía texto al {phone}",
    portal_help_email: "Escribe a {email}",
    portal_help_hours: "Mensajes y llamadas Lun–Vie, 9am–6pm hora de Texas.",
    portal_help_avatar_alt:
      "Foto de {firstName}, tu representante de Ashford",

    // === Preguntas frecuentes (acordeón) ===
    portal_faq_eyebrow: "Preguntas frecuentes",
    portal_faq_title:
      "Algunas dudas que los terapeutas suelen tener al principio.",
    portal_faq_q_cancel: "¿Puedo cancelar cuando quiera?",
    portal_faq_a_cancel:
      "Sí — los primeros 90 días puedes cancelar sin preguntas, después es mes a mes con 30 días de aviso. Sin contratos anuales y sin penalizaciones por cancelar antes.",
    portal_faq_q_domain: "¿Quién es dueño de mi dominio?",
    portal_faq_a_domain:
      "Tú. El dominio queda registrado a tu nombre y conservas la propiedad y el acceso completos si algún día dejas Ashford.",
    portal_faq_q_after: "¿Qué pasa después de reservar?",
    portal_faq_a_after:
      "Hoy se cobra $199 a tu tarjeta; te enviamos un breve formulario de bienvenida dentro de un día hábil y tu sitio sale en vivo 48 horas después de tener tu contenido.",
    portal_faq_q_spanish: "¿La versión en español de verdad la manejan ustedes?",
    portal_faq_a_spanish:
      "Sí — cada página se traduce profesionalmente y se mantiene sincronizada cuando haces ediciones. No tienes que cargar dos sitios en la cabeza.",
    portal_faq_q_contract: "¿Tengo que firmar un contrato?",
    portal_faq_a_contract:
      "Solo el acuerdo estándar de servicio mes a mes en el pago. Sin compromiso de varios años y sin tarifas que suben automáticamente.",
    portal_faq_q_tax: "¿Es un gasto de negocio deducible de impuestos?",
    portal_faq_a_tax:
      "Sí — bajo la Sección 162 del IRS, el alojamiento, diseño y mantenimiento del sitio web de tu práctica califican como gastos ordinarios y necesarios del negocio, 100% deducibles. Te entregamos un W-9 y facturas mensuales detalladas marcadas como \"Web management & marketing — professional services\" para que tu contador o CPA tenga todo lo necesario al cierre del año. Consulta a tu profesional de impuestos para tu situación específica.",
    portal_faq_aria_expand: "Expandir respuesta",
    portal_faq_aria_collapse: "Cerrar respuesta",

    // Reserve modal
    reserve_eyebrow: "Reserva tu sitio",
    reserve_close: "Cerrar",
    reserve_done_title: "Tu reserva está confirmada.",
    reserve_done_body:
      "Te contactaremos dentro de un día hábil para comenzar tu sitio. Tus complementos quedan en lista de espera — tu representante te acompañará para activarlos a medida que los abramos.",
    reserve_back_button: "Volver a mi vista previa",
    reserve_base_website: "Sitio base",
    reserve_addons_waitlist_one: "1 complemento (lista de espera)",
    reserve_addons_waitlist_other: "{n} complementos (lista de espera)",
    reserve_billed_when_launched: "se cobra al activarse",
    reserve_charged_today: "Cobrado hoy",
    reserve_setup_suffix: " + {amount} configuración",
    reserve_billing_explainer:
      "Hoy solo se cobra la base de $199/mes{setupClause}. Tus complementos quedan en lista de espera — al precio de hoy y no se cobran hasta que los actives a medida que se lancen.",
    reserve_billing_explainer_setup: " (más tu configuración única)",
    reserve_name_label: "Tu nombre",
    reserve_email_label: "Correo",
    reserve_email_placeholder: "tu@consulta.com",
    reserve_email_required:
      "Por favor ingresa tu correo para enviarte el recibo.",
    reserve_practice_label: "Nombre de la consulta",
    reserve_practice_placeholder: "Bridge Therapy Group",
    reserve_practice_required: "Por favor ingresa el nombre de tu consulta.",
    reserve_phone_label_optional: "Teléfono (opcional)",
    reserve_domain_label_optional: "Dominio preferido (opcional)",
    reserve_domain_hint:
      "Lo registramos y conectamos por ti — incluido gratis con tu suscripción.",
    self_serve_reserve_default_title: "Reserva tu sitio",
    tpl_show_eyebrow: "Prueba esta plantilla",
    tpl_show_copy_link: "Copiar enlace",
    tpl_show_copied: "Enlace copiado",
    tpl_show_addons: "Complementos",
    tpl_show_palette: "Paleta",
    tpl_show_design: "Diseño",
    tpl_show_back: "Todas las plantillas",
    reserve_continue: "Continuar al pago seguro",
    reserve_secured:
      "Asegurado con Stripe · cancela cuando quieras, sin tarifa de configuración",
    reserve_payment_unavailable:
      "El pago en línea no está disponible por ahora",
    reserve_payment_unavailable_short:
      "El pago en línea no está disponible por ahora. Tus selecciones quedaron guardadas — tu representante te contactará pronto para completar la reserva por teléfono.",
    reserve_fallback_body:
      "Tus elecciones de diseño y complementos quedan guardadas en tu vista previa. Tu representante de Ashford te contactará pronto para completar la reserva por teléfono — usualmente dentro de un día hábil.",
    reserve_payment_not_configured:
      "El pago no está configurado en esta vista previa. Tu representante hará seguimiento para completar la reserva.",
    reserve_pay_button: "Reservar ahora · $199",
    reserve_payment_failed: "El pago falló.",

    // === Templates ===
    tpl_nav_about: "Sobre nosotros",
    tpl_nav_my_work: "Mi trabajo",
    tpl_nav_fees: "Tarifas",
    tpl_nav_contact: "Contacto",
    tpl_nav_book: "Reservar",
    tpl_nav_writing: "Escritos",
    tpl_nav_sessions: "Sesiones",
    tpl_nav_reviews: "Reseñas",
    tpl_nav_inquire: "Consultar →",
    tpl_inquire_word: "Consultar",
    tpl_open_in_google_maps: "Abrir en Google Maps",
    tpl_psychotherapy_est: "Psicoterapia · Desde {year}",
    tpl_what_i_offer_eyebrow: "Lo que ofrezco",
    tpl_short_list: "Una lista breve, a propósito.",
    tpl_about_eyebrow: "Sobre mí",
    tpl_about_me: "Sobre mí.",
    tpl_about_clinicians: "Sobre las clínicas.",
    tpl_read_full_bio: "Leer biografía completa",
    tpl_read_the_full_bio: "Leer la biografía completa",
    tpl_read_profile: "Leer perfil",
    tpl_words_from_clients: "Palabras de pacientes",
    tpl_what_clients_say: "Lo que dicen los pacientes",
    tpl_where_eyebrow: "Dónde",
    tpl_office_telehealth: "Consultorio y telesalud",
    tpl_office_telehealth_dot: "Consultorio y telesalud.",
    tpl_fees_eyebrow: "Tarifas y seguros",
    tpl_payment_works: "Cómo funciona el pago.",
    tpl_reach_out: "Escríbenos.",
    tpl_response_time:
      "Respondo cada mensaje en un día hábil.",
    tpl_consult_with_phone: "Agenda una consulta gratis · {phone}",
    tpl_order_book: "Pedir el libro",
    tpl_book_consult: "Agenda una consulta",
    tpl_meet_team: "Conoce al equipo",
    tpl_inside_eyebrow: "Por dentro",
    tpl_what_we_do: "Lo que hacemos, en palabras claras.",
    tpl_contributors: "Colaboradores",
    tpl_people_in_room: "Las personas en la sala.",
    tpl_from_clients: "De pacientes",
    tpl_visit_eyebrow: "Visita",
    tpl_find_us: "Encuéntranos.",
    tpl_get_in_touch: "Conversemos.",
    tpl_cover_story: "Historia de portada",
    tpl_vol_issue: "Vol. {n} · Edición 01",
    tpl_also_in_practice: "También en la práctica",
    tpl_sessions_practical: "Sesiones, tarifas, lo práctico.",
    tpl_new_patients_phone: "Pacientes nuevos · {phone}",
    tpl_same_week_avail: "Citas disponibles esta semana",
    tpl_schedule_visit: "Agenda tu primera cita",
    tpl_clinic_what_we_do: "Lo que hacemos",
    tpl_evidence_based:
      "Atención basada en evidencia para todo el espectro diagnóstico.",
    tpl_our_team: "Nuestro equipo",
    tpl_clinicians_not_roster: "Clínicos, no una lista.",
    tpl_patient_reviews: "Reseñas de pacientes",
    tpl_patient_reviews_avg: "{rating}★ de pacientes reales",
    tpl_locations: "Ubicaciones",
    tpl_find_in_texas: "Encuéntranos en Texas.",
    tpl_new_patient_start: "¿Paciente nuevo? Empieza aquí.",
    tpl_same_week_intake_clinic:
      "Citas disponibles esta semana en la mayoría de los casos. Verificamos tu seguro al ingreso.",
    tpl_office_count_one: "consultorio en Texas",
    tpl_office_count_other: "consultorios en Texas",
    tpl_stat_from_reviews: "de {n} reseñas de pacientes",
    tpl_stat_median_first: "tiempo mediano hasta la primera cita",
    tpl_stat_board_certified: "clínicos certificados",
    tpl_stat_under_7_days: "< 7 días",
    tpl_on_work: "Sobre el trabajo",
    tpl_useful_hour:
      "Creemos que la psicoterapia debe ser la hora más útil de tu semana — no la más clínica. Trabajo a largo plazo, con un solo clínico que conoce tu historia.",
    tpl_what_we_offer: "Lo que ofrecemos",
    tpl_clinicians_section: "Clínicos",
    tpl_where_simple: "Dónde",
    tpl_inquire_title: "Consultar",
    tpl_caseload_text:
      "{practiceName} acepta una lista pequeña de pacientes. Las nuevas consultas son por referido o contacto directo.",
    tpl_practice_est: "{name} · Desde {year}",

    // Wellness Center
    tpl_wc_in_network:
      "En red con la mayoría de los seguros principales",
    tpl_wc_schedule_visit: "Agenda tu primera cita",
    tpl_wc_email_intake: "Correo de admisión",
    tpl_wc_dismiss: "Cerrar aviso",
    tpl_wc_clinicians_staff: "clínicos en el equipo",
    tpl_wc_locations_label: "ubicaciones cómodas",
    tpl_wc_satisfaction: "satisfacción de pacientes",
    tpl_wc_same_week: "Esta semana",
    tpl_wc_intake: "admisión de paciente nuevo",
    tpl_wc_services: "Servicios",
    tpl_wc_services_title:
      "Atención para cada edad y cada inquietud.",
    tpl_wc_insurance_eyebrow: "Seguros aceptados",
    tpl_wc_insurance_title:
      "Estamos en red con la mayoría de los planes principales.",
    tpl_wc_new_patients: "Recibimos pacientes nuevos",
    tpl_wc_now_booking:
      "Agenda abierta — la mayoría de las citas dentro de una semana.",
    tpl_wc_request_appt: "Solicita una cita",
    tpl_wc_meet: "Conoce a los clínicos.",
    tpl_wc_specialties: "Especialidades ({n})",
    tpl_wc_view_profile: "Ver perfil",
    tpl_wc_two_offices: "Dos consultorios acogedores.",
    tpl_wc_hours: "Horario",
    tpl_wc_new_patient_welcome: "¿Paciente nuevo? Bienvenido.",
    tpl_wc_same_week_intake_sub:
      "Admisión disponible esta misma semana en la mayoría de los casos. Verificamos tu seguro en la primera llamada.",
    tpl_wc_a_moment: "Un momento",
    tpl_wc_breathe: "respira",
    tpl_wc_breathe_sub:
      "Aquí la atención avanza a un ritmo humano. El siguiente paso lo das tú, cuando estés listo.",

    // Team Roster — encabezado de sección usado por las seis vistas
    // previas para presentar la cuadrícula/carrusel de clínicos.
    tpl_team_roster_eyebrow: "Tu equipo",
    tpl_team_roster_section: "Equipo.",

    // Crisis footer
    crisis_eyebrow: "Si estás en crisis ahora mismo",
    crisis_body:
      "No tienes que esperar a una cita. La Línea 988 de Suicidio y Crisis es gratuita, confidencial y está disponible 24/7. {practiceName} respalda estos recursos por completo.",
    crisis_call_988: "Llama o envía mensaje al 988",
    crisis_text_741:
      "Envía AYUDA al 741741 (Línea de crisis por mensaje)",
    crisis_disclaimer:
      "{practiceName} no es un servicio de crisis 24/7. Si tú o alguien que amas está en peligro inmediato, llama al 911. Cuidamos tu privacidad conforme a HIPAA en cada conversación.",

    // === Add-on inline previews ===
    addon_inline_eyebrow: "Complemento en vivo",
    addon_inline_status: "En tu sitio",
    addon_inline_per_month: "+{amount}/mes",
    addon_inline_included: "Incluido",
    tpl_show_more: "Ver más",
    tpl_show_less: "Ver menos",

    // Always-On Spanish
    addon_spanish_pro_label: "Español Siempre Activo",
    addon_spanish_pro_short: "El mismo cuidado. Dos idiomas.",
    addon_spanish_pro_section: "Nuestro enfoque",
    addon_spanish_pro_orig: "Original (Inglés)",
    addon_spanish_pro_translated: "Traducido (Español)",
    addon_spanish_pro_orig_h: "A Space to Heal",
    addon_spanish_pro_orig_p1:
      "We believe that healing happens in relationship. Our practice offers a warm, non-judgmental environment where you can explore your thoughts and feelings at your own pace.",
    addon_spanish_pro_orig_p2:
      "Whether you are navigating anxiety, life transitions, or relationship challenges, we are here to support your journey toward wholeness.",
    addon_spanish_pro_es_h: "Un Espacio para Sanar",
    addon_spanish_pro_es_p1:
      "Creemos que la sanación ocurre en relación. Nuestra práctica ofrece un ambiente cálido y sin juicios donde puedes explorar tus pensamientos y sentimientos a tu propio ritmo.",
    addon_spanish_pro_es_p2:
      "Ya sea que estés navegando por ansiedad, transiciones de vida o desafíos de relación, estamos aquí para apoyar tu camino hacia la plenitud.",

    // Insights Journal
    addon_blog_label: "Diario de Reflexiones",
    addon_blog_short: "Tu voz, registrada.",
    addon_blog_p1_cat: "Apuntes",
    addon_blog_p1_title:
      "Qué queremos decir cuando hablamos de \"apego\"",
    addon_blog_p1_excerpt:
      "Se ha vuelto una palabra de moda en redes, pero la teoría del apego es mucho más que clasificarte como ansioso o evitativo.",
    addon_blog_p1_read: "5 min de lectura",
    addon_blog_p2_cat: "Parejas",
    addon_blog_p2_title: "Una carta breve sobre el agotamiento",
    addon_blog_p2_excerpt:
      "Cuando el cansancio no es solo físico, sino un agotamiento profundo de tus reservas emocionales y tu sentido de agencia.",
    addon_blog_p2_read: "4 min de lectura",
    addon_blog_p3_cat: "En español",
    addon_blog_p3_title: "Cuando el silencio dice mucho",
    addon_blog_p3_excerpt:
      "A veces, lo que no decimos en nuestras relaciones familiares lleva más peso que las palabras que elegimos compartir.",
    addon_blog_p3_read: "6 min de lectura",

    // Match Filter
    addon_match_label: "Filtro de Coincidencia",
    addon_match_short:
      "Ayuda a tus visitantes a encontrar su match en segundos.",
    addon_match_filter_by: "Filtra por enfoque",
    addon_match_count_one: "1 clínico coincide con EMDR",
    addon_match_count_other: "{n} clínicos coinciden con EMDR",
    addon_match_card1: "Certificada EMDR, trauma complejo",
    addon_match_card2: "Capacitación EMDR Básica, adolescentes",

    // Open Calendar
    addon_calendar_label: "Reserva en Línea",
    addon_calendar_short:
      "Consultas gratis de 15 min, reservadas mientras duermes.",
    addon_calendar_schedule: "Agenda una consulta",
    addon_calendar_with: "Con Sandra Owner, LCSW-S",
    addon_calendar_minutes: "15 min",
    addon_calendar_video: "Videollamada",
    addon_calendar_day_mon: "Lun",
    addon_calendar_day_tue: "Mar",
    addon_calendar_day_wed: "Mié",
    addon_calendar_day_thu: "Jue",
    addon_calendar_day_fri: "Vie",
    addon_calendar_tuesday: "Martes 13",
    addon_calendar_consult_summary: "Martes 2:00 PM",
    addon_calendar_consult_label: "Consulta gratis de 15 min",
    addon_calendar_book_slot: "Reservar este horario",

    // Wellness Check
    addon_phq9_label: "Chequeo de Bienestar",
    addon_phq9_short:
      "Un chequeo gentil de 2 minutos antes de la primera sesión.",
    addon_phq9_question:
      "En las últimas 2 semanas, ¿con qué frecuencia has sentido poco interés o placer en hacer las cosas?",
    addon_phq9_opt1: "Para nada",
    addon_phq9_opt2: "Varios días",
    addon_phq9_opt3: "Más de la mitad de los días",
    addon_phq9_opt4: "Casi todos los días",
    addon_phq9_disclaimer:
      "Gestionado en su EHR. Los resultados nunca salen del sistema de su terapeuta.",

    // Front-Door Quiz
    addon_quiz_label: "Cuestionario de Bienvenida",
    addon_quiz_short:
      "Una admisión que se siente como una conversación.",

    // New Patient Welcome Kit (welcome_kit)
    addon_welcome_kit_label: "Kit de Bienvenida",
    addon_welcome_kit_short:
      "Envía automáticamente un correo de bienvenida y un formulario de admisión a cada nuevo paciente.",
    addon_quiz_step_label: "Paso {n}",
    addon_quiz_step_of: "Paso {n} de {total}",
    addon_quiz_step1_q: "¿Qué te trae aquí?",
    addon_quiz_step1_a: "Ansiedad + estrés laboral",
    addon_quiz_step2_q: "¿Cómo estás durmiendo?",
    addon_quiz_step2_opt1: "Inquieto",
    addon_quiz_step2_opt2: "Me cuesta dormir",
    addon_quiz_step2_opt3: "Me despierto muy temprano",
    addon_quiz_step2_opt4: "Duermo bien",
    addon_quiz_continue: "Continuar",
    addon_quiz_step3_text: "Sugeriremos 2 terapeutas",

    // Welcome Kit (welcome_kit) — copia de la sección en línea
    addon_welcome_email_subject:
      "Bienvenida a la práctica — qué esperar",
    addon_welcome_email_from:
      "de {practitioner} <welcome@example.com>",
    addon_welcome_email_greeting: "Hola Sarah —",
    addon_welcome_email_body_pre:
      "Bienvenida a la práctica. Tu primera sesión es el",
    addon_welcome_email_body_when: "martes a la 1:30 PM",
    addon_welcome_email_body_post:
      "Aquí tienes todo lo que necesitas antes — sin prisa, nada urgente.",
    addon_welcome_email_item_intake:
      "Firma tu formulario de admisión (5 min, en tu teléfono)",
    addon_welcome_email_item_insurance:
      "Sube una foto de tu tarjeta del seguro",
    addon_welcome_email_item_parking:
      "Instrucciones de estacionamiento + código de la puerta",
    addon_welcome_email_item_calendar:
      "Agrega al calendario: 1:30–2:30 PM, martes",
    addon_welcome_email_signoff:
      "Nos vemos el martes. — Mara, recepción",
    addon_welcome_what_eyebrow: "Qué hace el botón de recepción",
    addon_welcome_what_body:
      "Un toque de recepción → correo de bienvenida con tu marca + formulario de admisión + foto del seguro + instrucciones de estacionamiento, todo en el orden correcto. Ahorra unos 10 minutos por paciente nuevo.",

    // Cancellation Self-Serve (cancellation_self_serve)
    addon_cancel_label: "Cancelación Auto-servicio",
    addon_cancel_short:
      "Los pacientes reagendan solos. Recepción solo recibe un resumen matutino.",
    addon_cancel_patient_eyebrow: "Paciente · enlace para reagendar",
    addon_cancel_prompt_pre: "¿Necesitas mover tu cita del",
    addon_cancel_prompt_when: "martes a la 1:30 PM",
    addon_cancel_prompt_post: "?",
    addon_cancel_slot_1: "Mié 10am",
    addon_cancel_slot_2: "Mié 4pm",
    addon_cancel_slot_3: "Jue 9am",
    addon_cancel_slot_4: "Vie 1pm",
    addon_cancel_confirm: "Confirmar nuevo horario",
    addon_cancel_window: "Permitido hasta 24 horas antes de tu cita",
    addon_cancel_desk_eyebrow: "Recepción · resumen de las 7:00 AM",
    addon_cancel_desk_line1_action: "movió Mar 1:30 PM →",
    addon_cancel_desk_line1_to: "Mié 10:00 AM",
    addon_cancel_desk_line2: "reservó consulta gratis, Jue 4:00 PM",
    addon_cancel_desk_line3:
      "3 recordatorios enviados automáticamente para mañana",
    addon_cancel_footer:
      "Reduce cerca del 30% del volumen del buzón de recepción. Registra los motivos de cancelación para que detectes patrones de ausencia antes de que te cuesten un horario.",

    // Insurance & Sliding Scale Badge (insurance_sliding_scale)
    addon_insurance_label: "Insignia de Seguros y Tarifa Móvil",
    addon_insurance_short:
      "Un bloque claro de planes aceptados, integrado en cada página.",
    addon_insurance_card_eyebrow: "Seguros y tarifas",
    addon_insurance_plans_label: "Planes aceptados",
    addon_insurance_oon: "Fuera de red — se entregan superbills",
    addon_insurance_scale_label: "Tarifa móvil",
    addon_insurance_scale_range: "— $180 / sesión",
    addon_insurance_scale_body:
      "Tarifa reducida para estudiantes de tiempo completo, cuidadores y personas entre seguros. Sin papeleo.",
    addon_insurance_footer:
      "Se muestra en línea en cada página de tu sitio. Reduce las llamadas de \"¿aceptas mi seguro?\" en cerca del 40% en los primeros lanzamientos.",

    // First-Visit Video (first_visit_video)
    addon_video_label: "Video de Primera Visita",
    addon_video_short:
      "Un video tranquilo de 60 segundos para que los nuevos sepan qué esperar.",
    addon_video_player_title: "Dra. Maya Alvarado · Bienvenida",
    addon_video_play_aria: "Reproducir video de primera visita",
    addon_video_caption:
      "\"Bienvenida — al entrar, la puerta está a tu izquierda y Mara te ofrecerá té.\"",
    addon_video_shoot_eyebrow: "Qué grabamos",
    addon_video_shoot_b1: "Intro de 60 segundos contigo a cuadro",
    addon_video_shoot_b2:
      "Recorrido: puerta → sala de espera → tu silla",
    addon_video_shoot_b3:
      "Voz en off: \"qué pasa en la primera sesión\"",
    addon_video_shoot_b4:
      "Subtítulos en EN + ES integrados para accesibilidad",

    // Google Profile Sync (google_profile_sync). [CLEANUP D.10] Reseñas
    // seleccionadas por tu rep — sin alusión a sincronización automática.
    addon_google_label: "Sincronización con Google",
    addon_google_short:
      "Tu ficha de Google se mantiene al día — y vigilamos las reseñas.",
    addon_google_synced: "Reseñas seleccionadas por tu rep",
    addon_google_business_name: "Dra. Maya Alvarado, LCSW",
    addon_google_address_line:
      "Terapeuta · 1200 E 11th St, Austin, TX 78702",
    addon_google_open: "Abierto",
    addon_google_closes: "Cierra a las 6 PM",
    addon_google_checks_eyebrow: "Revisiones semanales que hacemos por ti",
    addon_google_checks_b1:
      "Horarios, servicios y fotos sincronizados desde tu sitio",
    addon_google_checks_b2:
      "Avisos de nuevas reseñas + borradores de respuesta",
    addon_google_checks_b3:
      "Vigilamos fichas duplicadas y avisos de \"cerrado temporalmente\"",
    addon_google_checks_b4:
      "Reporte trimestral de búsqueda local",
    addon_google_sample_notice:
      "Aún no pudimos obtener tus datos de Google — abajo mostramos una vista de muestra.",

    // Intake Forms Hub (intake_forms_hub)
    addon_intake_label: "Centro de Formularios de Admisión",
    addon_intake_short:
      "Formularios firmados desde el teléfono, archivados en tu carpeta segura.",
    addon_intake_phone_url: "drmaya.com / formularios",
    addon_intake_step_label: "Paso 3 de 4",
    addon_intake_question: "¿Has estado en terapia antes?",
    addon_intake_opt_current: "Sí — actualmente",
    addon_intake_opt_past: "Sí — en el pasado",
    addon_intake_opt_no: "No",
    addon_intake_sign_continue: "Firmar y continuar",
    addon_intake_library_eyebrow: "Biblioteca de formularios de Sarah",
    addon_intake_form_intake: "Cuestionario de admisión",
    addon_intake_form_consent: "Consentimiento informado",
    addon_intake_form_telehealth: "Consentimiento de telemedicina",
    addon_intake_form_sliding: "Solicitud de tarifa móvil",
    addon_intake_form_release: "Autorización de expedientes",
    addon_intake_state_signed: "firmado",
    addon_intake_state_pending: "pendiente",
    addon_intake_state_skipped: "omitido",
    addon_intake_footer:
      "Los PDF firmados se archivan automáticamente en tu carpeta segura. Versiones EN + ES de cada formulario estándar incluidas.",

    // Disponibilidad de dominio + sugerencias
    domain_hero_eyebrow: "TU DOMINIO VA POR NUESTRA CUENTA",
    domain_hero_title: "Elige un dominio. Lo registramos. $0 para ti.",
    domain_hero_sub:
      "La mayoría de los terapeutas no saben que la renovación anual de una dirección web es lo fácil — Ashford la cubre para siempre, por nuestra cuenta. Escribe el nombre de tu práctica y mira qué está libre ahora mismo.",
    domain_check_placeholder: "tupractica.com",
    domain_check_button: "Verificar disponibilidad",
    hero_practice_placeholder:
      "Nombre de tu práctica (ej. Bright Path Counseling)",
    hero_practice_check: "Ver dominios gratis",
    portal_tagline_emdr: "Terapia EMDR y trauma en {city}.",
    portal_tagline_couples: "Terapia de pareja y familia en {city}.",
    portal_tagline_perinatal: "Terapia perinatal y postparto en {city}.",
    portal_tagline_youth:
      "Terapia para niños, adolescentes y familias en {city}.",
    portal_tagline_universal:
      "Terapia que te encuentra donde estás — basada en evidencia y hecha a tu medida.",
    portal_bilingual_pill: "Disponible en inglés y español",
    domain_premium_badge_with_amount: "Premium · +{amount}/año (tú lo cubres)",
    domain_suggest_label: "O — mira qué está libre para {seed}",
    domain_suggestions_loading: "Verificando disponibilidad en vivo…",
    domain_suggestions_empty:
      "No encontramos opciones libres aún — prueba con otra ortografía o agrega tu ciudad.",
    domain_free_badge: "Gratis · lo cubrimos",
    domain_included_note: "Incluido — lo cubrimos.",
    domain_premium_badge: "Premium · tú lo cubres",
    domain_premium_surcharge: "+ {amount}/año a partir del segundo año",
    domain_premium_note:
      "Un nombre premium — su renovación anual ({amount}/año) corre por tu cuenta. Nosotros cubrimos el primer año.",
    domain_retry_friendly: "Un segundo — inténtalo de nuevo.",
    domain_retry_cta: "Reintentar",
    domain_premium_one_time: "/año desde año 2",
    domain_pick_premium_cta: "Reservar (cargo premium)",
    domain_taken: "Ocupado",
    domain_retail_label: "Precio normal",
    domain_pick_cta: "Elegir este dominio",
    domain_reserve_cta: "Reservar este dominio",
    domain_chosen_label: "Elegido",
    domain_open_picker: "Elegir un dominio",
    domain_pick_top_cta: "Elige tu nuevo dominio →",
    domain_picker_title:
      "Elige un dominio — lo registramos y renovamos por ti",
    domain_picker_sub:
      "Todo lo que aparece en verde es tuyo sin cargo adicional. Los premium suman una tarifa única, nunca mensual.",
    domain_picker_close: "Cerrar",
    domain_picker_check_specific: "Verificar un dominio específico",
    domain_error:
      "Algo salió mal al verificar. Inténtalo de nuevo en un momento.",
    domain_invalid:
      "Eso no parece un dominio válido. Prueba con tupractica.com",

    // Chatbot — rama de dominio
    cb_q_domain: "¿De verdad el dominio es gratis?",
    cb_domain_bot:
      "Sí — cuando te configuramos la dirección, son $0 para ti. Para siempre. Nosotros cubrimos la renovación anual (alrededor de $14.98/año) de nuestro lado. ¿Quieres ver qué está libre para tu práctica ahora mismo?",
    cb_domain_check: "Ver qué está libre",
    cb_domain_skip: "Quizás luego",
    cb_domain_prompt:
      "Escribe el nombre de tu práctica (o una idea de dominio) — verificamos disponibilidad en vivo ahora mismo.",
    cb_domain_input_placeholder: "Nombre de tu práctica",
    cb_domain_check_button: "Verificar",
    cb_domain_loading: "Verificando disponibilidad en vivo…",
    cb_domain_results_intro:
      "Esto fue lo que encontramos — todo lo verde es tuyo a $0:",
    cb_domain_results_again: "Probar otro nombre",
    cb_domain_results_call: "Que un representante finalice mi elección",

    // Chatbot — entrada libre + detección de intención
    cb_input_placeholder:
      "Escribe una pregunta (ej. ¿está libre drsmith.com?)",
    cb_send: "Enviar",
    cb_intent_domain_check_intro:
      "Buscando {domain} para ti — un momento…",
    cb_intent_domain_suggest_intro:
      "Buscando opciones libres para \"{seed}\" ahora mismo — todo lo verde es tuyo a $0.",
    cb_intent_domain_no_match:
      "Puedo responder sobre precios, el dominio incluido, los tiempos, o pasarte con una persona real. ¿Qué te gustaría saber?",
    cb_intent_domain_available:
      "¡Sí! {domain} está libre — normalmente {retail}/año, pero $0 para ti. Lo configuramos por ti y cubrimos la renovación cada año, en silencio.",
    cb_intent_domain_taken:
      "{domain} ya está ocupado — aquí tienes algunas opciones libres del mismo nombre (registramos tu elección a $0).",
    cb_intent_domain_premium:
      "{domain} es un nombre premium. Cubrimos el primer año — después, su renovación premium anual de {surcharge}/año corre por tu cuenta.",
    cb_intent_domain_invalid:
      "{domain} no parece un dominio válido — prueba algo como tupractica.com.",
    cb_intent_domain_sales_only:
      "Elegir el nombre correcto es parte de la incorporación — tu rep te muestra 2–3 opciones libres pensadas para tu práctica cuando reservas. Si quieres, te conecto con alguien ahora.",
    // Prospect preview "Pulled from your public profile" recap band.
    preview_recap_eyebrow: "Esto lo sacamos de tu perfil público",
    preview_recap_specialties: "Especialidades",
    preview_recap_accepts: "Acepta",
    preview_recap_languages: "Idiomas",
    preview_recap_approach: "Enfoque",
    preview_recap_modes: "Modos",
    preview_recap_in_person: "Presencial",
    preview_recap_telehealth: "Telesalud",
    preview_recap_sliding_scale: "Tarifa flexible",
    preview_recap_sources: "Fuentes",
    preview_recap_show_more_one: "+ Mostrar {n} campo más",
    preview_recap_show_more_other: "+ Mostrar {n} campos más",

    // === Live features callout (mirrors EN block above) ===
    live_features_eyebrow: "Disponibles ahora",
    live_features_title: "Cuatro funciones trabajando en silencio en segundo plano.",
    live_features_sub: "Tus pacientes reservan, te ven y se preparan sin que tú abras una pestaña.",
    live_feat_telehealth_title: "Telesalud en tu propia página /visit",
    live_feat_telehealth_desc:
      "Una página bilingüe en /visit a la que tu paciente entra desde un mensaje de texto — sin inicio de sesión externo, sin sala de espera confusa.",
    live_feat_booking_title: "Reserva en línea, en cada página",
    live_feat_booking_desc:
      "El paciente adecuado elige un hueco real en tu calendario a las 11pm desde su teléfono y tú amaneces con una primera sesión confirmada.",
    live_feat_ghostwriter_title: "Una Insights Journal escrita por nosotros",
    live_feat_ghostwriter_desc:
      "Más de catorce piezas reflexivas al año con tu voz — el tipo de autoridad clínica que se suma silenciosamente en búsquedas con el tiempo.",
    live_feat_onboarding_title: "Un centro de bienvenida para pacientes",
    live_feat_onboarding_desc:
      "Kit de bienvenida, formularios de intake y los pasos prácticos previos a la primera sesión — en una sola página serena para que el paciente llegue listo, no ansioso.",
    // === Portal WOW enrichment band (mirrors EN block above) ===
    portal_wow_specialties_label: "Lo que tratamos",
    portal_wow_modalities_label: "Cómo trabajamos",
    portal_wow_languages_label: "Atendemos en",
    portal_wow_insurance_label: "Seguros aceptados",
    portal_wow_pill_in_person: "Sesiones presenciales",
    portal_wow_pill_telehealth: "Telesalud",
    portal_wow_pill_sliding_scale: "Tarifa modulada",
    portal_wow_pricing_eyebrow: "Lo que cuestan las sesiones",
    portal_wow_pricing_title: "Tarifas, dichas claramente.",
    portal_wow_pricing_session: "por sesión",
    portal_wow_pricing_range: "{min} – {max} por sesión",
    portal_wow_testimonials_eyebrow: "En sus propias palabras",
    portal_wow_testimonials_title: "Lo que dicen los pacientes.",
    portal_wow_anonymous_author: "Paciente, nombre reservado",
    portal_wow_drafted_pages_badge: "Ya redactado para usted",
    portal_wow_journal_eyebrow: "Reflexiones, con tu voz",
    portal_wow_journal_title: "Tres borradores, listos para publicar.",
    portal_wow_journal_reading: "Lectura de {n} min",
    portal_wow_sources_eyebrow: "Tomado de",
    portal_wow_sources_title: "Cada detalle de arriba viene de una fuente real.",
    portal_wow_source_google_places: "Google",
    portal_wow_source_headway: "Headway",
    portal_wow_source_psychology_today: "Psychology Today",
    portal_wow_source_zencare: "Zencare",
    portal_wow_source_website: "Su sitio web",
    portal_wow_source_npi: "Registro NPI",
    portal_wow_source_website_meta: "Su sitio web",
    portal_wow_social_eyebrow: "Encuéntranos en otros lugares",
  },
} as const;

export type StringKey = keyof (typeof translations)["en"];
