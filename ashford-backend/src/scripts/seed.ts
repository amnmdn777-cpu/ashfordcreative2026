import {
  db,
  pool,
  salesReps,
  leads,
  blogPosts,
  blogComments,
  blogLikes,
  testimonials,
} from "@workspace/db";
import { hashPassword } from "../lib/password";
import { sql } from "drizzle-orm";

const TEXAS_CITIES = [
  "Austin",
  "Houston",
  "San Antonio",
  "Dallas",
  "Fort Worth",
  "El Paso",
  "Plano",
  "Frisco",
  "McKinney",
  "Round Rock",
  "Sugar Land",
  "Lubbock",
  "Waco",
  "Tyler",
  "Amarillo",
];

const SPECIALTIES = [
  "Therapist (LPC)",
  "Therapist (LMFT)",
  "Clinical Social Worker (LCSW)",
  "Clinical Psychologist (PhD)",
  "Psychiatrist (MD)",
  "Psychiatric NP",
];

const FIRST_NAMES = [
  "Jane",
  "John",
  "Maria",
  "Carlos",
  "Sarah",
  "Michael",
  "Ana",
  "Daniel",
  "Rebecca",
  "James",
  "Linda",
  "David",
  "Sofia",
  "Andrew",
  "Emily",
  "Robert",
  "Patricia",
  "Luis",
  "Christina",
  "Brian",
];
const LAST_NAMES = [
  "Smith",
  "Garcia",
  "Johnson",
  "Martinez",
  "Brown",
  "Lopez",
  "Davis",
  "Hernandez",
  "Wilson",
  "Anderson",
  "Taylor",
  "Moore",
  "Jackson",
  "Thomas",
  "Ramirez",
  "Lewis",
  "Walker",
  "Young",
  "Allen",
  "King",
];

const PROFILE_BLURBS = [
  "Compassionate, evidence-based care for adults navigating anxiety, depression, and life transitions.",
  "Specializing in trauma-informed therapy with EMDR and somatic approaches.",
  "Affirming therapy for LGBTQ+ individuals, couples, and families.",
  "Bilingual (English/Spanish) practice serving the Latino community of Texas.",
  "CBT and ACT for high-achieving professionals struggling with burnout.",
  "Couples counseling rooted in the Gottman Method.",
];

const REPS = [
  { username: "rep1", displayName: "Karen Reyes", role: "rep", promoCode: "REP1" },
  { username: "rep2", displayName: "Marcus Hill", role: "rep", promoCode: "REP2" },
  { username: "rep3", displayName: "Priya Shah", role: "rep", promoCode: "REP3" },
  { username: "rep4", displayName: "Diego Alvarez", role: "rep", promoCode: "REP4" },
  { username: "rep5", displayName: "Sara Nguyen", role: "rep", promoCode: "REP5" },
  { username: "admin", displayName: "Ashford Admin", role: "admin", promoCode: "ADMIN" },
] as const;

// Shared tier-positioning footer appended to every post at insert time so each
// article ends by pointing back to the Boutique / Pro / Concierge ladder. The
// site is bilingual; the footer carries EN + ES inline (single body column —
// matches the inline-EN+ES pattern used elsewhere on ashford-site).
const TIER_POSITIONING_FOOTER_MD =
  "\n\n---\n\n" +
  "## Where this lives in our three tiers\n\n" +
  "Every Ashford site ships with the calm, conversion-focused fundamentals above — that's **Boutique** ($199/mo, no setup fee). " +
  "When a practice is ready for the four front-desk multipliers — online booking, first-visit video, telehealth bridge, and a patient onboarding hub — that's **Boutique Pro** ($299/mo). " +
  "Practices that want a ghostwritten Insights Journal and white-glove telehealth choose **Boutique Concierge** ($649/mo).\n\n" +
  "## Dónde encaja esto en nuestros tres niveles\n\n" +
  "Cada sitio Ashford incluye los fundamentos enfocados en la conversión que describimos arriba — eso es **Boutique** ($199/mes, sin cargo de configuración). " +
  "Cuando una práctica está lista para los cuatro multiplicadores de recepción — reservas en línea, video de primera visita, puente de telesalud y un hub de bienvenida para pacientes — eso es **Boutique Pro** ($299/mes). " +
  "Las prácticas que quieren un diario clínico escrito por nosotros y telesalud llave en mano eligen **Boutique Concierge** ($649/mes).\n";

// Eight blog post titles mandated by the spec. Bodies are ~600 words of
// plausible mental-health-focused marketing content. Composite case studies
// (#4 and #5) carry an explicit composite_case_study label.
const BLOG_POSTS = [
  {
    slug: "psychology-today-worst-place-to-be-found",
    title: "Why Psychology Today Is the Worst Place to Be Found",
    excerpt:
      "If you're 1 of 50 therapists in your zip code, you're a line item. Here's what actually fills your caseload.",
    bodyMd:
      "## You are not a profile. You are a practice.\n\nPsychology Today is the largest therapist directory in the country, and that is exactly the problem. " +
      "When a prospective client searches for help, they don't find *you* — they find a list of fifty roughly-interchangeable cards, sorted by an algorithm you don't control, " +
      "competing on the same five-line bio template. There is no clinical voice. There is no specificity. There is no reason for someone in pain to choose you over the next card.\n\n" +
      "## The SEO math doesn't work in your favor\n\nThis isn't really about whether the monthly fee is worth it — only you can decide that. The structural problem is that every page view on your directory profile " +
      "reinforces the *directory's* domain authority, not yours. The next person who Googles your name lands on a URL you don't own, surrounded by competitors. Even if you also have your own website, the directory tends to outrank it on your own name " +
      "because it has more inbound links, more pages, and more years of accumulated authority. You're effectively boosting the SEO of the platform that ranks you next to fifty other clinicians.\n\n" +
      "## What actually compounds for a Texas mental-health practice\n\n1. **A domain you control.** Search results that point to *you*, with backlinks and content history that build year over year.\n" +
      "2. **A first paragraph that names the problem you solve.** Not 'I provide therapy for adults' — *'I work with women in their 30s who feel stuck after a career pivot.'*\n" +
      "3. **A booking flow that respects the visitor's time.** Three fields, no clinical-sounding intake form on the homepage.\n" +
      "4. **Modalities written as keywords, not jargon.** EMDR, IFS, ACT — these are the search terms your future clients are typing, often along with city names.\n\n" +
      "## You can keep the directory profile if you want — that's not the point\n\nPlenty of clinicians keep their directory listing as one channel among several. The point is that it shouldn't be your *only* online presence, " +
      "and the SEO it generates shouldn't only accrue to someone else. Owning your URL means that referrals, search traffic, and your own marketing all compound in one place — yours.\n\n" +
      "## What about referrals?\n\nReferrals are still your best source of clients. But the referral chain ends at a website. " +
      "If your colleague sends you a client and that client Googles your name, what they see in the next ninety seconds determines whether they call.\n",
    authorName: "Karen Reyes",
  },
  {
    slug: "what-your-website-says-about-your-boundaries",
    title: "What Your Therapy Practice Website Says About Your Boundaries",
    excerpt:
      "Cluttered nav, ten CTAs, three pop-ups — your homepage is the first session, and it's already over capacity.",
    bodyMd:
      "## Your homepage is a clinical artifact\n\nA cluttered homepage with stock photos, scrolling testimonials, three pop-ups, and a chatbot that asks for your insurance card before saying hello — " +
      "that homepage is telling a prospective client exactly how the first call will feel. Overwhelmed. Performative. Not for them.\n\n" +
      "## Boundaries as a design principle\n\nA well-designed therapy practice site has the same restraint that you bring to a session: clear, calm, and willing to leave space. " +
      "One headline. One paragraph. One next action. Footer with crisis resources. That's the entire homepage.\n\n" +
      "## The five things to remove from your homepage today\n\n- Stock photos of generic 'happy diverse couples'\n- Pop-ups that ask for an email before the visitor knows what you do\n" +
      "- Scrolling carousels of testimonials\n- A chatbot that mimics intake\n- Anything that says 'I am a compassionate therapist who provides a safe space'\n\n" +
      "## What to put there instead\n\nA single sentence, in your voice, naming the person you actually help.\n",
    authorName: "Marcus Hill",
  },
  {
    slug: "9-second-rule-mental-health-patients-decide",
    title: "The 9-Second Rule: How Mental Health Patients Decide Whether to Reach Out",
    excerpt:
      "From landing to 'maybe' is nine seconds. Here's exactly what has to be on the screen in that window.",
    bodyMd:
      "## Nine seconds is not a marketing trope — it is a clinical fact\n\nFor someone considering therapy for the first time, the act of opening a therapist's website is *itself* a difficult act. " +
      "The nervous system is already activated. They will close the tab the moment something feels off — too clinical, too sales-y, too vague, too busy.\n\n" +
      "## What must be on screen in the first nine seconds\n\n1. The therapist's first name and credentials.\n2. The specific kind of person they help (not 'adults' — be specific).\n" +
      "3. The city or region.\n4. A single, calm call-to-action — usually 'Book a free 15-minute consult.'\n\n" +
      "That's it. Everything else is below the fold.\n\n" +
      "## The reverse test\n\nPull up your homepage on a phone. Squint until everything blurs except the largest text. " +
      "If what you can read still doesn't tell a person in distress *who you are and who you help*, you have nine seconds of work to do.\n",
    authorName: "Karen Reyes",
  },
  {
    slug: "composite-houston-emdr-stopped-paying-directories",
    title:
      "Composite Case Study: A Houston EMDR Practice That Stopped Paying for Directory Listings",
    excerpt:
      "A composite of three Ashford clients — what changed when they killed their PT subscription and rebuilt around their own search story.",
    bodyMd:
      "*This is a composite case study drawn from the experiences of three Ashford Creative clients in the Houston area. " +
      "Names, identifying details, and exact numbers have been altered. It is presented as a teaching example, not a single client's story.*\n\n" +
      "## The starting point\n\nA solo EMDR-focused practice in the Houston Heights, four years in, paying $300/month combined across Psychology Today, GoodTherapy, and one local directory. " +
      "Caseload: 60% full. Most new clients came from a single referring psychiatrist.\n\n" +
      "## What we changed\n\n- Replaced directory bios with a one-page site at her own domain.\n- Built three pages: home, about, and a dedicated EMDR for trauma page.\n" +
      "- Added a single conversion path: 'Book a free 15-minute consult,' booked via Calendly.\n- Wrote the EMDR page using the language her existing clients used — *not* clinical taxonomy.\n\n" +
      "## What happened in 90 days\n\n- Direct (non-referral) inquiries roughly tripled.\n- Caseload moved from 60% to 95% full.\n- The directory subscriptions were canceled at month three.\n\n" +
      "## What didn't change\n\nReferrals from the psychiatrist stayed steady. The site didn't replace her network — it backed it up.\n",
    authorName: "Marcus Hill",
  },
  {
    slug: "composite-san-antonio-couples-doubled-inquiries",
    title:
      "Composite Case Study: How a San Antonio Couples Therapist Doubled Inquiries with Better Search",
    excerpt:
      "A composite of two San Antonio couples-therapy practices — what changed when their site started speaking the language of search.",
    bodyMd:
      "*This is a composite case study drawn from two Ashford Creative couples-therapy clients in San Antonio. " +
      "Names and identifying details have been changed. Numbers are illustrative averages, not literal.*\n\n" +
      "## The starting point\n\nTwo couples-focused practices, both Gottman-trained, both with WordPress sites that hadn't been touched in three years. " +
      "Both ranked nowhere for 'couples therapy San Antonio.'\n\n" +
      "## What we changed\n\n- Added a dedicated, well-written page for each modality (Gottman, EFT) with the city name woven in naturally.\n" +
      "- Rewrote the homepage in the second person — speaking *to* the couple, not about the practice.\n" +
      "- Added a Spanish-first variant of the homepage (San Antonio's bilingual market is enormous and underserved).\n" +
      "- Added a footer with 988 and Texas Family Crisis Hotline.\n\n" +
      "## What happened in 90 days\n\n- Direct inquiries roughly doubled.\n- Spanish-language inquiries went from zero to ~25% of new contacts.\n" +
      "- The practices started ranking on page one for 'Gottman therapist San Antonio.'\n",
    authorName: "Diego Alvarez",
  },
  {
    slug: "hipaa-aware-web-design-solo-practitioner",
    title: "HIPAA-Aware Web Design: What It Actually Means for a Solo Practitioner",
    excerpt:
      "HIPAA isn't a checkbox on a website builder. Here's what a solo practice really needs — and what they really don't.",
    bodyMd:
      "## You don't need a HIPAA-certified website. You need a HIPAA-aware practice.\n\n" +
      "There is no such thing as a 'HIPAA-compliant website.' HIPAA applies to *protected health information*, not to general marketing pages. " +
      "If your homepage doesn't collect or transmit PHI, HIPAA is largely irrelevant to it.\n\n" +
      "## Where HIPAA actually shows up on a website\n\n- **Contact forms** that ask for diagnostic detail (don't).\n- **Intake forms** (use a HIPAA-compliant intake tool — SimplePractice, TherapyNotes, etc.).\n" +
      "- **Booking widgets** that pull calendar info from a system that may store identifying detail.\n- **Email links** to your practice email (use BAA-covered email like Hushmail, Paubox, or Google Workspace with a signed BAA).\n\n" +
      "## What the contact form on a solo therapist site should ask\n\n1. First name.\n2. Best way to reach you.\n3. A single open-ended line: 'Briefly, what brings you here?'\n\n" +
      "Not date of birth. Not insurance card. Not symptoms. Not history.\n",
    authorName: "Priya Shah",
  },
  {
    slug: "local-seo-therapists-texas-four-things",
    title: "Local SEO for Therapists in Texas: The 4 Things That Actually Matter",
    excerpt:
      "You don't need a 30-page SEO audit. You need four things, done right and kept current.",
    bodyMd:
      "## The four things\n\n1. **A Google Business Profile, claimed and complete.** Photos, hours, services, the works. This is 50% of local SEO.\n" +
      "2. **City + modality landing pages.** A page for each (city, modality) pair you actually serve — *Anxiety therapy in Plano*, *EMDR in Dallas*, *Couples counseling in Sugar Land*.\n" +
      "3. **Reviews.** Three is the floor. Twenty is good. Always reply.\n" +
      "4. **Backlinks from your community.** A guest post on a local OB/GYN's blog about postpartum mental health is worth more than a hundred directory listings.\n\n" +
      "## What doesn't matter\n\n- Meta keyword tags (deprecated since 2009)\n- Hidden white-on-white keyword stuffing (will get you delisted)\n- Buying links from any 'SEO agency' that cold-emails you\n- Word counts on blog posts. Quality > length.\n",
    authorName: "Marcus Hill",
  },
  {
    slug: "designing-for-people-in-crisis-five-principles",
    title: "Designing for People in Crisis: Five Principles Every Mental Health Site Should Follow",
    excerpt:
      "If someone in crisis lands on your site, the design either helps or harms. Five principles for the former.",
    bodyMd:
      "## Why this matters\n\nA non-trivial fraction of visitors to a therapist's website are in active distress. They may be looking for help for themselves or for someone close to them. " +
      "Design choices that are inconvenient for a calm visitor become cruel for a person in crisis.\n\n" +
      "## The five principles\n\n1. **988 in the footer of every page.** The Suicide & Crisis Lifeline is one click away from every URL on your site.\n" +
      "2. **No autoplay anything.** No music, no video. The nervous system you're designing for cannot tolerate surprise.\n" +
      "3. **Calm color and tone.** No neon CTAs, no urgency banners, no 'Limited spots — book now!' language.\n" +
      "4. **Plain language.** Sixth-grade reading level for the homepage. Jargon belongs on the modalities page, not the front door.\n" +
      "5. **A way out.** A clear path back to the homepage, a clear way to close the chatbot, a clear unsubscribe.\n\n" +
      "## A footer that does the job\n\nA single line in calm text: *'If you or someone you love is in crisis, call or text 988 (Suicide & Crisis Lifeline) or the Texas Crisis Line at 800-989-6884.'*\n",
    authorName: "Karen Reyes",
  },
  {
    slug: "therapy-website-builder-comparison",
    title:
      "Therapy Website Builder Comparison: Ashford vs Brighter Vision vs TherapySites vs SimplePractice",
    excerpt:
      "An honest, feature-by-feature comparison of the four options most Texas mental-health practices weigh — what each does well, what each lacks, and how to choose.",
    bodyMd:
      "*An honest comparison written by a small Texas studio that builds in this space. We disclose our biases upfront: Ashford Creative is one of the four. We've tried to keep the framing fair and to call out our limitations as clearly as our strengths.*\n\n" +
      "## The four options most practices actually consider\n\n" +
      "When a Texas therapist or small group practice goes looking for a website, the shortlist usually narrows to four:\n\n" +
      "1. **Brighter Vision** — a long-running mental-health-only website service.\n" +
      "2. **TherapySites** — another mental-health-specific website provider, in the market for over a decade.\n" +
      "3. **SimplePractice** — primarily a practice-management / EHR platform that bundles a website builder for existing customers.\n" +
      "4. **Ashford Creative** — that's us. A boutique Texas studio with three tiers, bilingual EN/ES by default, and an Insights Journal ghostwriting option on the Concierge tier.\n\n" +
      "## What every reasonable option in this space covers\n\n" +
      "Before getting into differences, it helps to name the table-stakes. All four offer:\n\n" +
      "- A live, mobile-responsive website hosted for you\n- A way to capture inquiries (a contact form at minimum)\n- A small library of mental-health-focused templates\n- Some level of SSL / security baked in\n- A way to reach support when something breaks\n\n" +
      "If any vendor you're considering doesn't cover those five, treat that as disqualifying.\n\n" +
      "## Where the real differences live\n\n" +
      "Pricing, bilingual support, who writes the words, telehealth integration, and how the relationship feels in month nine — those are where these four diverge.\n\n" +
      "### 1. Monthly cost and what the price includes\n\n" +
      "- **Ashford — Boutique:** $199/mo, no setup fee, every essential included.\n- **Ashford — Boutique Pro:** $299/mo, adds online booking, first-visit video, telehealth bridge, onboarding hub.\n- **Ashford — Boutique Concierge:** $649/mo, adds a ghostwritten Insights Journal (14+ pieces per year) and white-glove telehealth setup.\n- **Brighter Vision:** subscription with multiple tiers; published list pricing varies — *[TODO: verify current published pricing before quoting].*\n- **TherapySites:** subscription with multiple tiers; setup fee on some plans — *[TODO: verify].*\n- **SimplePractice:** website is bundled into the practice-management subscription rather than priced separately — *[TODO: verify current bundling].*\n\nWhat we'd recommend asking each vendor: *what does the month-13 invoice look like, and what happens if I want to pause for a season?*\n\n### 2. Bilingual EN/ES support\n\nThis is the single biggest differentiator for the Texas market. Almost 30% of Texas households speak Spanish at home — and Spanish-language clinical content is one of the most underserved corners of the entire US mental-health web.\n\n- **Ashford:** every page is bilingual by default. Hero, services, about, contact, legal — all dual EN+ES, with a clean language switcher. We write the Spanish ourselves; we don't run pages through machine translation.\n- **Brighter Vision / TherapySites:** typically English-first, with Spanish available as an add-on or custom build — *[TODO: verify current offering].*\n- **SimplePractice:** the website builder is English-first; client portal has some localization — *[TODO: verify].*\n\nIf a meaningful share of your referrals come in Spanish, this difference is probably load-bearing.\n\n### 3. Online booking and telehealth\n\n- **Ashford Pro & Concierge:** online booking is built into the site; telehealth bridges to your existing room (Doxy, Simple Practice, Therapy Notes, etc.); Concierge sets up Doxy.me Pro under your brand.\n- **SimplePractice:** the strongest of the four for booking + telehealth because it's the EHR — booking, telehealth, billing, notes all in one product.\n- **Brighter Vision / TherapySites:** integrate with external booking tools; level of polish varies — *[TODO: verify current native vs integration story].*\n\n### 4. Who writes the words\n\nThis is where boutique studios separate from template shops. A template-shop site is *yours to fill in*; a boutique-studio site is *built around what you actually say in session.*\n\n- **Ashford Boutique Concierge:** an in-house writer ghostwrites your Insights Journal — 14+ clinically-grounded pieces per year, edited with you. That's the tier built for clinicians who want clinical authority on Google without writing it themselves.\n- **Ashford Boutique / Pro:** copy is shaped with you on a kickoff call; we write the first pass, you edit.\n- **Brighter Vision / TherapySites:** copy templates with personalization — *[TODO: verify whether dedicated copywriting is included or upsold].*\n- **SimplePractice:** primarily DIY copy — the website builder is a tool, not a service.\n\n### 5. Support response time and contract length\n\n- **Ashford:** month-to-month, cancel anytime; support replies same business day from a Texas-based team.\n- **Brighter Vision / TherapySites:** subscription, typically month-to-month — *[TODO: verify current cancellation terms].*\n- **SimplePractice:** tied to the practice-management subscription; pausing the website usually means pausing the EHR.\n\n## Honest tradeoffs (where each option wins)\n\n- **Pick Brighter Vision if:** you want a long-track-record mental-health-only vendor with a large customer base and you don't need bilingual or ghostwriting.\n- **Pick TherapySites if:** you've used them before, like the editor, and the directory-style integrations match your referral mix.\n- **Pick SimplePractice if:** you're already on their EHR and the bundled website is good enough — the trade is convenience versus a more crafted public-facing site.\n- **Pick Ashford if:** you want a boutique, bilingual, ghostwriter-backed site with a Texas studio behind it, and you value the editorial voice over template-fill speed.\n\n## What we'd tell you if we weren't selling\n\nThe single biggest mistake therapists make when picking a website vendor isn't picking the wrong one — it's picking based on the first month's price and ignoring month-13. Ask every vendor on your shortlist: *what does year two look like, what does it cost to leave, and who owns the domain when I cancel?*\n\nIf the answers feel evasive, that's the answer.\n\n## A note on what's in this article\n\nWe sell against the other three named in this piece. We've tried to keep specific claims about competitors conservative and have marked anything we wouldn't bet on as *[TODO: verify]* rather than guess. If you're a vendor named here and we've gotten something wrong, email us — we update this page when we learn we're off.\n\n---\n\n*Versión en español*\n\n## Comparación de constructores de sitios para terapeutas: Ashford vs Brighter Vision vs TherapySites vs SimplePractice\n\n*Una comparación honesta escrita por un estudio pequeño en Texas que construye en este espacio. Declaramos nuestro sesgo al principio: Ashford Creative es uno de los cuatro. Hemos intentado mantener el marco justo y reconocer nuestras limitaciones con la misma claridad que nuestras fortalezas.*\n\n### Las cuatro opciones que la mayoría de las prácticas considera\n\n1. **Brighter Vision** — un servicio de sitios web enfocado solo en salud mental, con muchos años en el mercado.\n2. **TherapySites** — otro proveedor especializado en salud mental, con más de una década en el sector.\n3. **SimplePractice** — principalmente una plataforma de gestión clínica (EHR) que incluye un constructor de sitios como complemento.\n4. **Ashford Creative** — nosotros. Un estudio boutique en Texas, con tres niveles, bilingüe EN/ES de forma predeterminada y un Diario de Perspectivas escrito por nosotros en el nivel Concierge.\n\n### Lo que cualquier opción razonable cubre\n\nTodos ofrecen un sitio en vivo, captura de consultas, una pequeña biblioteca de plantillas enfocadas en salud mental, SSL y soporte. Si un proveedor no cubre eso, descártalo.\n\n### Dónde están las diferencias reales\n\n**Precio mensual y lo que incluye:**\n\n- **Ashford Boutique:** $199/mes, sin cargo de configuración.\n- **Ashford Boutique Pro:** $299/mes, añade reservas en línea, video de primera visita, puente de telesalud y hub de bienvenida.\n- **Ashford Boutique Concierge:** $649/mes, añade Diario de Perspectivas escrito por nosotros (14+ piezas por año) y telesalud llave en mano.\n- **Brighter Vision / TherapySites / SimplePractice:** *[TODO: verificar precios actuales antes de citar].*\n\n**Soporte bilingüe EN/ES:** Es la diferencia más grande para el mercado de Texas. Casi el 30% de los hogares texanos hablan español en casa. En Ashford, cada página es bilingüe de forma predeterminada — no usamos traducción automática. En los otros tres, el español suele ser un complemento o un trabajo personalizado — *[TODO: verificar oferta actual].*\n\n**Reservas en línea y telesalud:** Ashford Pro y Concierge incluyen reservas y un puente de telesalud a tu sala existente. SimplePractice es el más fuerte de los cuatro aquí porque también es el EHR.\n\n**Quién escribe los textos:** El nivel Boutique Concierge de Ashford incluye un escritor que redacta tu Diario de Perspectivas — 14+ piezas clínicas al año. Los demás suelen ofrecer plantillas para que tú llenes.\n\n**Soporte y duración del contrato:** Ashford es mes a mes, cancelas cuando quieras, soporte el mismo día hábil desde un equipo en Texas.\n\n### Cómo elegir\n\n- **Elige Brighter Vision** si quieres un proveedor con larga trayectoria y no necesitas bilingüe ni redacción.\n- **Elige TherapySites** si ya lo conoces y te gusta su editor.\n- **Elige SimplePractice** si ya estás en su EHR y un sitio adecuado dentro del mismo producto te conviene.\n- **Elige Ashford** si quieres un sitio boutique, bilingüe, con redacción incluida y un estudio en Texas detrás.\n\n### Lo que te diríamos si no estuviéramos vendiendo\n\nEl error más grande no es elegir mal — es elegir basándose en el precio del primer mes e ignorar el mes 13. Pregunta a cada proveedor: *¿cómo se ve el año dos, cuánto cuesta irme, y quién es dueño del dominio cuando cancele?* Si la respuesta es evasiva, esa es la respuesta.\n",
    authorName: "Marcus Hill",
  },
];

const BLOG_COMMENTS = [
  // Post: psychology-today-worst-place-to-be-found
  {
    slug: "psychology-today-worst-place-to-be-found",
    authorName: "Dr. Anita Patel, LCSW",
    authorPractice: "Patel Counseling, Austin",
    body: "I dropped the directory after my caseload filled following an Ashford redesign. This is exactly right.",
  },
  {
    slug: "psychology-today-worst-place-to-be-found",
    authorName: "James Whitfield, LPC",
    authorPractice: "Whitfield Counseling, Dallas",
    body: "The point about domain authority is something I had never thought about. I was literally paying to rank the directory above my own name.",
  },
  {
    slug: "psychology-today-worst-place-to-be-found",
    authorName: "Carmen Ruiz, LMFT",
    authorPractice: "Ruiz Family Therapy, San Antonio",
    body: "Kept the directory as one channel but stopped treating it as my primary presence. Huge mindset shift.",
  },
  // Post: what-your-website-says-about-your-boundaries
  {
    slug: "what-your-website-says-about-your-boundaries",
    authorName: "Marcos Lima, LPC",
    authorPractice: "Lima Counseling, Houston",
    body: "Cutting the carousel and the pop-up alone made the homepage feel like a clinic again, not a landing page.",
  },
  {
    slug: "what-your-website-says-about-your-boundaries",
    authorName: "Dr. Layla Torres, PsyD",
    authorPractice: "Torres Psychology, Austin",
    body: "The parallel between a cluttered homepage and a dysregulated session is one I will be sharing with every colleague who asks why their site feels off.",
  },
  {
    slug: "what-your-website-says-about-your-boundaries",
    authorName: "Brian Okafor, LCSW",
    authorPractice: "Okafor Healing Center, Houston",
    body: "Removed the carousel and the insurance-upfront chatbot the same day. Site feels like mine again.",
  },
  // Post: 9-second-rule-mental-health-patients-decide
  {
    slug: "9-second-rule-mental-health-patients-decide",
    authorName: "Sofia Ramos, LMFT",
    authorPractice: "Familia Wellness, San Antonio",
    body: "We tested the squint test and rewrote our hero. Inquiries up the next month.",
  },
  {
    slug: "9-second-rule-mental-health-patients-decide",
    authorName: "Rachel Kim, LPC",
    authorPractice: "Kim Counseling, Plano",
    body: "Did the squint test on my phone and could only read the logo. Complete rewrite the next morning.",
  },
  {
    slug: "9-second-rule-mental-health-patients-decide",
    authorName: "David Morales, LMFT",
    authorPractice: "Morales Couples Therapy, Fort Worth",
    body: "Nine seconds sounds scary until you realize most of us already know intuitively that something is wrong. This article gave me language for it.",
  },
  // Post: composite-houston-emdr-stopped-paying-directories
  {
    slug: "composite-houston-emdr-stopped-paying-directories",
    authorName: "Vanessa Tran, LCSW",
    authorPractice: "Tran Trauma Therapy, Houston",
    body: "The part about referrals still flowing after the directory cancel matches my own experience exactly. You don't lose your network — you just stop paying for a channel that was never really yours.",
  },
  {
    slug: "composite-houston-emdr-stopped-paying-directories",
    authorName: "Anthony Rios, LPC",
    authorPractice: "Rios Counseling, Sugar Land",
    body: "Three pages — home, about, one modality page — sounds almost too simple. But I've been living with an eight-page WordPress nightmare for two years.",
  },
  {
    slug: "composite-houston-emdr-stopped-paying-directories",
    authorName: "Dr. Patricia Nguyen, PhD",
    authorPractice: "Nguyen Psychology, The Woodlands",
    body: "The 60% to 95% caseload arc is real. Not overnight, but real. Two months is about right in my experience.",
  },
  // Post: composite-san-antonio-couples-doubled-inquiries
  {
    slug: "composite-san-antonio-couples-doubled-inquiries",
    authorName: "Isabel Vargas, LMFT",
    authorPractice: "Vargas Couples & Family, San Antonio",
    body: "The Spanish-first homepage variant is underutilized by so many bilingual practices in this city. Glad someone finally wrote about it as a strategy, not just a nice-to-have.",
  },
  {
    slug: "composite-san-antonio-couples-doubled-inquiries",
    authorName: "Michael Castillo, LPC",
    authorPractice: "Castillo Counseling, San Antonio",
    body: "Rewrote my homepage in second person after reading the study. It felt uncomfortable at first — like I was the client — then I realized that was the whole point.",
  },
  {
    slug: "composite-san-antonio-couples-doubled-inquiries",
    authorName: "Dr. Andrea Fuentes, PsyD",
    authorPractice: "Fuentes Family Psychology, Laredo",
    body: "City plus modality pages were the missing piece. I had three city pages with no modality and three modality pages with no city. Combined them and movement started within six weeks.",
  },
  // Post: hipaa-aware-web-design-solo-practitioner
  {
    slug: "hipaa-aware-web-design-solo-practitioner",
    authorName: "Daniel Cho, LPC",
    authorPractice: "Cho Therapy, Plano",
    body: "Saved me from another agency trying to sell me a 'HIPAA-compliant website' for $4k.",
  },
  {
    slug: "hipaa-aware-web-design-solo-practitioner",
    authorName: "Sarah Jennings, LPC",
    authorPractice: "Jennings Counseling, McKinney",
    body: "The distinction between HIPAA applying to PHI versus general marketing pages should be posted in every therapist Facebook group. The misinformation costs us money.",
  },
  {
    slug: "hipaa-aware-web-design-solo-practitioner",
    authorName: "Roberto Mendez, LMFT",
    authorPractice: "Mendez Family Therapy, El Paso",
    body: "Switched to Paubox last year after my previous email provider couldn't produce a BAA. The contact form cleanup was the next piece. This article covers both.",
  },
  // Post: local-seo-therapists-texas-four-things
  {
    slug: "local-seo-therapists-texas-four-things",
    authorName: "Rebecca Allen, LCSW",
    authorPractice: "Allen Counseling, Frisco",
    body: "City+modality pages were the thing that finally moved me onto page one for Frisco.",
  },
  {
    slug: "local-seo-therapists-texas-four-things",
    authorName: "Tanya Foster, LPC",
    authorPractice: "Foster Therapy, Round Rock",
    body: "Claimed my Google Business Profile after reading this and found it had been sitting unverified for two years. Fix it before it costs you.",
  },
  {
    slug: "local-seo-therapists-texas-four-things",
    authorName: "Marcus Webb, LCSW",
    authorPractice: "Webb Counseling, Waco",
    body: "The backlink point about community blogs is something agencies never lead with because they can't bill hours for it. It's also the thing that actually works.",
  },
  // Post: designing-for-people-in-crisis-five-principles
  {
    slug: "designing-for-people-in-crisis-five-principles",
    authorName: "Dr. Simone Garrett, PsyD",
    authorPractice: "Garrett Trauma Center, Austin",
    body: "Principle two — no autoplay — should be the law. A client in crisis has even less margin than the rest of us.",
  },
  {
    slug: "designing-for-people-in-crisis-five-principles",
    authorName: "Lisa Obi, LMFT",
    authorPractice: "Obi Wellness, Houston",
    body: "The sixth-grade reading level guidance is something I take into every page review now. If I wouldn't say it to a client in a first session, it doesn't go on the homepage.",
  },
  {
    slug: "designing-for-people-in-crisis-five-principles",
    authorName: "Carlos Herrera, LPC",
    authorPractice: "Herrera Counseling, Lubbock",
    body: "Added the 988 footer line after reading this. Took five minutes. Should have been there from day one.",
  },
];

// Per-post seeded like counts (fingerprint-based likes table).
const BLOG_LIKES_BY_SLUG: Record<string, number> = {
  "psychology-today-worst-place-to-be-found": 47,
  "what-your-website-says-about-your-boundaries": 31,
  "9-second-rule-mental-health-patients-decide": 58,
  "composite-houston-emdr-stopped-paying-directories": 22,
  "composite-san-antonio-couples-doubled-inquiries": 18,
  "hipaa-aware-web-design-solo-practitioner": 41,
  "local-seo-therapists-texas-four-things": 35,
  "designing-for-people-in-crisis-five-principles": 64,
};

const randPick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const randPhone = () =>
  `+1${String(214 + Math.floor(Math.random() * 600)).padStart(3, "0")}${String(
    Math.floor(Math.random() * 10000000),
  ).padStart(7, "0")}`;

async function main() {
  console.log("seeding...");
  await db.execute(sql`TRUNCATE TABLE blog_comments, blog_likes, blog_posts RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE link_events, prospect_links, callback_schedules, twilio_messages, email_messages, notifications, contact_requests RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE leads RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE custom_dev_quotes, client_onboardings, subscriptions, sales, stripe_events RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE onboarding_acknowledgments, sales_reps RESTART IDENTITY CASCADE`);

  const password = "Ashford2026";
  const passwordHash = await hashPassword(password);

  const insertedReps = await db
    .insert(salesReps)
    .values(
      REPS.map((r) => ({
        username: r.username,
        displayName: r.displayName,
        passwordHash,
        role: r.role,
        promoCode: r.promoCode,
        hourlyRateCents: 2500,
        // 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
      })),
    )
    .returning();
  const repCount = insertedReps.filter((r) => r.role === "rep").length;
  const adminCount = insertedReps.filter((r) => r.role === "admin").length;
  console.log(
    `  reps: ${repCount} + admins: ${adminCount} (password = ${password})`,
  );

  const leadRows: (typeof leads.$inferInsert)[] = [];
  for (let i = 0; i < 200; i++) {
    const first = randPick(FIRST_NAMES);
    const last = randPick(LAST_NAMES);
    const specialty = randPick(SPECIALTIES);
    const city = randPick(TEXAS_CITIES);
    const initials = `${first[0]}${last[0]}`.toLowerCase();
    leadRows.push({
      name: `${first} ${last}`,
      practice: `${last} ${randPick([
        "Counseling",
        "Therapy",
        "Mental Health",
        "Wellness",
        "Psychiatry",
        "Psychology",
      ])}`,
      specialty,
      city,
      state: "TX",
      phone: randPhone(),
      email: `${initials}${i}@example.com`,
      currentWebsite: `https://${last.toLowerCase()}therapy.example.com`,
      profileBlurb: randPick(PROFILE_BLURBS),
      status: "available",
    });
  }
  const insertedLeads = await db.insert(leads).values(leadRows).returning({ id: leads.id });
  console.log(`  leads: ${insertedLeads.length}`);

  // Append the shared three-tier positioning footer to every post body at
  // insert time. The flagship comparison post is self-contained and already
  // covers tier positioning in its own copy, so we skip the footer there to
  // avoid a duplicate Boutique/Pro/Concierge block at the end.
  const postsToInsert = BLOG_POSTS.map((p) =>
    p.slug === "therapy-website-builder-comparison"
      ? p
      : { ...p, bodyMd: p.bodyMd + TIER_POSITIONING_FOOTER_MD },
  );
  const insertedPosts = await db.insert(blogPosts).values(postsToInsert).returning();
  console.log(`  blog posts: ${insertedPosts.length}`);

  for (const c of BLOG_COMMENTS) {
    const post = insertedPosts.find((p: typeof insertedPosts[number]) => p.slug === c.slug);
    if (!post) continue;
    await db.insert(blogComments).values({
      postId: post.id,
      authorName: c.authorName,
      authorPractice: c.authorPractice,
      body: c.body,
    }).onConflictDoNothing();
  }
  console.log(`  blog comments: ${BLOG_COMMENTS.length}`);

  // Seed blog likes (fingerprint-based, idempotent per fingerprint).
  let totalLikes = 0;
  for (const post of insertedPosts as typeof insertedPosts) {
    const n = BLOG_LIKES_BY_SLUG[post.slug] ?? 0;
    if (n === 0) continue;
    const rows = Array.from({ length: n }, (_, i) => ({
      postId: post.id,
      fingerprint: `seed-${post.slug}-${i}`,
    }));
    await db.insert(blogLikes).values(rows);
    totalLikes += n;
  }
  console.log(`  blog likes: ${totalLikes}`);

  // Three composite testimonials shown on the public marketing site.
  await db.delete(testimonials);
  await db.insert(testimonials).values([
    {
      authorName: "Dr. Hannah Reyes-Whitfield",
      authorTitle: "LCSW",
      authorPractice: "Cedar Park Counseling Collective",
      city: "Cedar Park",
      state: "TX",
      quote:
        "Within six weeks the new site was paying for itself. I went from one or two intake calls a month to a steady waitlist, and I never had to learn another piece of software. This is the only marketing decision I'm not second-guessing.",
      displayOrder: 1,
      isComposite: 1,
    },
    {
      authorName: "Marcus Holloway, LPC",
      authorTitle: "Owner",
      authorPractice: "Holloway Trauma & EMDR",
      city: "Houston",
      state: "TX",
      quote:
        "The previous web 'agency' charged me four thousand dollars and disappeared. Ashford rebuilt everything in a week, the writing actually sounds like me, and I can text my rep when I need a tweak. Quietly excellent.",
      displayOrder: 2,
      isComposite: 1,
    },
    {
      authorName: "Dr. Priya Shah-Bennett",
      authorTitle: "PsyD",
      authorPractice: "Bennett Family Psychology",
      city: "San Antonio",
      state: "TX",
      quote:
        "Three couples-therapy referrals in the first month, all from people who said the website made them feel like they were already in good hands. That is the entire job. I cannot recommend the team enough.",
      displayOrder: 3,
      isComposite: 1,
    },
  ]);
  console.log(`  testimonials: 3 (composite)`);

  console.log("seed complete");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
