import type { TemplateKey } from "@workspace/api-zod";
import type { Locale } from "@site/lib/strings";

/**
 * Per-template chrome copy in EN + ES.
 *
 * Background: each canvas-port template (Sunrise, Garden, Constellation,
 * Polaroid, Atrium) was authored as a self-contained visual replica that
 * hard-coded English copy throughout — service titles, hero headlines,
 * fee tables, FAQs, closing CTAs, etc. The `props.content` shape only
 * carries practitioner-level data (name, contact, hero image, etc.), so
 * the EN/ES toggle in those templates was either decorative or only
 * flipped a small slice of visible text.
 *
 * `TEMPLATE_CHROME` lifts every previously hard-coded chrome string into
 * one place, with both locales side-by-side so an in-template `setLocale`
 * call (wired through `useI18n`) flips the entire visible page. Spanish
 * copy is written for warm Texas/MX usage — informal, plain, not
 * Google-translated — to match the founder's voice.
 *
 * Practitioner name interpolation: a few headings reference the
 * practitioner's first name (e.g. "Meet Maya"). Use {firstName} as the
 * placeholder; the template substitutes via `pickChrome(...).about`.
 */

interface Service {
  title: string;
  desc: string;
  /** Optional handwritten note (Polaroid uses this). */
  note?: string;
}

interface FeeItem {
  label: string;
  price: string;
}

interface Faq {
  q: string;
  a: string;
}

export interface TemplateChrome {
  /** Header CTA pill ("Book Consult" / "Client Portal" / "Consult"). */
  navCta: string;
  hero: {
    /** Optional eyebrow / pre-headline tag. */
    eyebrow?: string;
    /** First line of the hero H1. */
    headlineL1: string;
    /** Optional accent word (rendered with brand-gradient styling). */
    headlineAccent?: string;
    /** Continuation line after the accent (often empty). */
    headlineL2?: string;
    /** Optional sub-headline. When omitted, templates fall back to b.tagline. */
    sub?: string;
    /** Primary hero CTA. */
    ctaPrimary: string;
    /** Optional secondary hero CTA (Garden uses this). */
    ctaSecondary?: string;
  };
  services: {
    heading: string;
    subhead?: string;
    items: Service[];
    /** Garden's "Learn More" tail label. */
    learnMore?: string;
    /** Atrium's "Explore" tail label. */
    explore?: string;
  };
  about: {
    /** Optional small eyebrow above the heading. May contain {firstName}. */
    eyebrow?: string;
    /** May contain {firstName}. */
    heading: string;
    /** Optional accent word for split headings (Constellation). */
    headingAccent?: string;
    /** Optional bigger lead paragraph (Sunrise). */
    lead?: string;
    body: string[];
    /** Optional cert pills (Sunrise). */
    certs?: string[];
    /** Optional handwritten captions on Polaroid frames. */
    polaroidCaptions?: { back: string; front: string; about: string };
  };
  fees: {
    heading: string;
    /** Optional card-level heading distinct from the section heading. */
    cardHeading?: string;
    items: FeeItem[];
    /** Label above the in-network plan badges. */
    inNetworkLabel?: string;
    /** Plan names rendered as pills. Brand names typically stay in English. */
    insurancePlans?: string[];
    insuranceCardHeading?: string;
    insuranceLead?: string;
    outOfNetworkHeading?: string;
    outOfNetworkBody?: string;
    slidingScaleNote?: string;
  };
  faq: {
    heading: string;
    items: Faq[];
  };
  closing?: {
    /** Optional closing-section headline. */
    heading?: string;
    /** Optional CTA button label. */
    cta?: string;
  };
  footer?: {
    /** Constellation's brand tagline in the footer. */
    tagline?: string;
    contactHeading?: string;
    locationHeading?: string;
    /** Atrium's bilingual footer pill. */
    bilingualLabel?: string;
    /** Atrium's "Design by" prefix before the agency credit. */
    designByPrefix?: string;
    /** Polaroid's mini hours line under the phone. */
    hoursLabel?: string;
    /** Polaroid's mini reply-time line under the email. */
    emailNote?: string;
    /** Tagline after the © year + name. e.g. "All rights reserved." */
    rightsReserved?: string;
    /** Legal-row link labels (Privacy / Terms / Good Faith Estimate). */
    legalLinks?: string[];
    /** Constellation: prefix before the star icon ("Built with"). */
    builtWithLabel?: string;
    /** Constellation: suffix after the star icon ("by Ashford Creative"). */
    builtWithSuffix?: string;
    /** Polaroid: locale-aware fallback when practitioner has no credentials. */
    credentialsFallback?: string;
  };
  /** Optional decorative quote (Polaroid uses this on the about side). */
  quote?: {
    text: string;
    attribution: string;
  };
}

type ChromeBundle = Record<Locale, TemplateChrome>;

const SUNRISE: ChromeBundle = {
  en: {
    navCta: "Book Consult",
    hero: {
      headlineL1: "A new chapter",
      headlineL2: "begins here.",
      ctaPrimary: "Book a free 15-min consult",
    },
    services: {
      heading: "How I can help",
      subhead: "Evidence-based approaches tailored to your unique journey.",
      items: [
        {
          title: "Individual Therapy",
          desc: "A safe space to explore anxiety, depression, and life transitions. Together, we'll build resilience and untangle the patterns holding you back.",
        },
        {
          title: "EMDR for Trauma",
          desc: "Specialized processing to help your brain heal from past distressing events. Move from feeling 'stuck' to finding resolution and peace.",
        },
        {
          title: "Couples Counseling",
          desc: "Reconnect and rebuild trust. We'll work on communication, navigating parenthood, and strengthening your foundational bond.",
        },
      ],
    },
    about: {
      heading: "Meet {firstName}",
      lead: "I believe that healing isn't about fixing what's broken—it's about rediscovering the warmth and strength that was always yours.",
      body: [
        "As a bilingual Licensed Clinical Social Worker with over 10 years of experience, I specialize in trauma recovery, perinatal mental health, and life transitions. My approach is warm, culturally affirming, and deeply collaborative. Whether we're processing a difficult birth experience or navigating the complexities of identity, I'm here to walk alongside you.",
      ],
      certs: ["LCSW in Texas", "EMDR Trained"],
    },
    fees: {
      heading: "Investment & Details",
      cardHeading: "Fees & Insurance",
      items: [
        { label: "Initial Consult (15 min)", price: "Free" },
        { label: "Individual Session (50 min)", price: "$180" },
        { label: "Couples Session (60 min)", price: "$210" },
      ],
      inNetworkLabel: "In-Network With:",
      insurancePlans: ["Aetna", "BCBS Texas"],
      slidingScaleNote: "Sliding scale spots available upon request.",
    },
    faq: {
      heading: "FAQ",
      items: [
        {
          q: "Do you offer virtual sessions?",
          a: "Yes! I offer secure telehealth via your therapist's existing platform for anyone located in Texas.",
        },
        {
          q: "What happens in a consultation?",
          a: "It's a casual 15-minute chat to see if we're a good fit. We'll discuss what brings you to therapy, what you're hoping to achieve, and you can ask any questions about my approach.",
        },
        {
          q: "What is EMDR like?",
          a: "EMDR uses bilateral stimulation (like eye movements or tapping) to help your brain reprocess traumatic memories. It doesn't require discussing the event in deep detail, and many clients find it acts faster than traditional talk therapy.",
        },
      ],
    },
    closing: {
      heading: "Ready to find your light?",
      cta: "Schedule a Consultation",
    },
    footer: {
      rightsReserved: "All rights reserved.",
    },
  },
  es: {
    navCta: "Reservar consulta",
    hero: {
      headlineL1: "Un nuevo capítulo",
      headlineL2: "comienza aquí.",
      ctaPrimary: "Agenda una consulta gratis de 15 min",
    },
    services: {
      heading: "Cómo te puedo ayudar",
      subhead: "Enfoques basados en evidencia, adaptados a tu camino.",
      items: [
        {
          title: "Terapia individual",
          desc: "Un espacio seguro para explorar la ansiedad, la depresión y las transiciones de vida. Juntos vamos a construir resiliencia y soltar los patrones que te están deteniendo.",
        },
        {
          title: "EMDR para trauma",
          desc: "Un proceso especializado para que tu cerebro sane lo que ha quedado guardado. Pasas de sentirte estancada o estancado a encontrar resolución y paz.",
        },
        {
          title: "Terapia de pareja",
          desc: "Reconectar y reconstruir la confianza. Trabajamos comunicación, la transición a ser madres o padres, y la base sobre la que sostienen su relación.",
        },
      ],
    },
    about: {
      heading: "Conoce a {firstName}",
      lead: "Sanar no es arreglar lo que está roto: es redescubrir la fuerza y la calidez que siempre fueron tuyas.",
      body: [
        "Soy trabajadora social clínica licenciada (LCSW) bilingüe, con más de 10 años de práctica. Me especializo en recuperación de trauma, salud mental perinatal y transiciones de vida. Mi enfoque es cálido, culturalmente afirmativo y profundamente colaborativo. Ya sea que estemos procesando una experiencia de parto difícil o navegando temas de identidad, estoy aquí para acompañarte.",
      ],
      certs: ["LCSW en Texas", "Entrenamiento EMDR"],
    },
    fees: {
      heading: "Inversión y detalles",
      cardHeading: "Honorarios y seguros",
      items: [
        { label: "Consulta inicial (15 min)", price: "Gratis" },
        { label: "Sesión individual (50 min)", price: "$180" },
        { label: "Sesión de pareja (60 min)", price: "$210" },
      ],
      inNetworkLabel: "Acepto las siguientes redes:",
      insurancePlans: ["Aetna", "BCBS Texas"],
      slidingScaleNote:
        "Hay cupos limitados en escala flexible — pregúntame en la consulta.",
    },
    faq: {
      heading: "Preguntas",
      items: [
        {
          q: "¿Ofreces sesiones virtuales?",
          a: "Sí. Ofrezco telesalud segura a través de la plataforma de su terapeuta para clientes en cualquier parte de Texas.",
        },
        {
          q: "¿Qué pasa en la consulta?",
          a: "Son 15 minutos sin presión para ver si encajamos. Hablamos de lo que te trae a terapia, lo que buscas lograr, y puedes hacerme cualquier pregunta sobre mi forma de trabajar.",
        },
        {
          q: "¿Cómo se siente el EMDR?",
          a: "EMDR usa estimulación bilateral (movimientos oculares o tapping) para que tu cerebro reprocese recuerdos difíciles. No tienes que contar el evento en detalle, y muchas personas avanzan más rápido que con la terapia hablada tradicional.",
        },
      ],
    },
    closing: {
      heading: "¿Lista o listo para encontrar tu luz?",
      cta: "Agendar una consulta",
    },
    footer: {
      rightsReserved: "Todos los derechos reservados.",
    },
  },
};

const GARDEN: ChromeBundle = {
  en: {
    navCta: "Book Consult",
    hero: {
      eyebrow: "Cultivating Growth & Resilience",
      headlineL1: "Find a space to",
      headlineAccent: "breathe and grow.",
      ctaPrimary: "Book a free 15-min consult",
      ctaSecondary: "Learn about my approach",
    },
    services: {
      heading: "Ways we can work together",
      subhead:
        "Every seed needs a different environment to thrive. I offer tailored therapeutic approaches to meet you where you are.",
      items: [
        {
          title: "Individual Therapy",
          desc: "A dedicated space to explore anxiety, depression, life transitions, and personal growth at your own pace.",
        },
        {
          title: "EMDR for Trauma",
          desc: "An evidence-based approach to help your brain reprocess traumatic memories and find lasting relief.",
        },
        {
          title: "Couples Therapy",
          desc: "Rebuild connection, improve communication, and break unhelpful patterns in your relationship.",
        },
      ],
      learnMore: "Learn More",
    },
    about: {
      eyebrow: "Meet {firstName}",
      heading: "Rooted in connection, focused on healing.",
      body: [
        "As a Licensed Clinical Social Worker, I believe that therapy is a collaborative process of uncovering the resilience that already exists within you. We all experience seasons of pruning and seasons of growth.",
        "With over 10 years of experience, I specialize in trauma-informed care, using evidence-based practices like EMDR alongside a warm, relational approach. I provide culturally responsive therapy in both English and Spanish, honoring the unique contexts of my clients' lives.",
        "Whether you are healing from past wounds, navigating a difficult transition, or seeking a deeper understanding of yourself, I am here to provide a grounded, safe environment for your journey.",
      ],
    },
    fees: {
      heading: "Investment in yourself",
      items: [{ label: "Standard Session", price: "$180" }],
      inNetworkLabel: "50-minute individual or couples session",
      insuranceCardHeading: "Accepted Insurance",
      insurancePlans: [
        "Aetna",
        "Blue Cross Blue Shield of Texas",
        "United Healthcare",
      ],
      outOfNetworkHeading: "Out of Network?",
      outOfNetworkBody:
        "I can provide superbills for out-of-network reimbursement. A limited number of sliding scale spots are available based on financial need.",
    },
    faq: {
      heading: "Common Questions",
      items: [
        {
          q: "Do you offer virtual therapy?",
          a: "Yes! I offer both in-person sessions at my Austin office and secure telehealth sessions for anyone located within the state of Texas.",
        },
        {
          q: "What can I expect in a 15-minute consultation?",
          a: "The consultation is a casual, no-pressure phone call to discuss what brings you to therapy, answer any questions you have about my approach, and see if we feel like a good fit to work together.",
        },
        {
          q: "How does EMDR therapy work?",
          a: "EMDR (Eye Movement Desensitization and Reprocessing) is an interactive psychotherapy technique used to relieve psychological stress. It involves recalling distressing events while receiving bilateral sensory input, which helps the brain properly process the memories.",
        },
        {
          q: "Do you offer therapy in Spanish?",
          a: "Yes, I'm fully bilingual and offer therapy in Spanish. I understand the importance of being able to express yourself in your mother tongue during the therapeutic process.",
        },
      ],
    },
    closing: {
      heading: "Ready to begin?",
      cta: "Book your free consultation",
    },
  },
  es: {
    navCta: "Reservar consulta",
    hero: {
      eyebrow: "Cultivando crecimiento y resiliencia",
      headlineL1: "Encuentra un espacio para",
      headlineAccent: "respirar y crecer.",
      ctaPrimary: "Agenda una consulta gratis de 15 min",
      ctaSecondary: "Conoce mi enfoque",
    },
    services: {
      heading: "Formas de trabajar juntos",
      subhead:
        "Cada semilla necesita un ambiente distinto para florecer. Adapto mi enfoque para encontrarte donde estás.",
      items: [
        {
          title: "Terapia individual",
          desc: "Un espacio dedicado para trabajar ansiedad, depresión, transiciones de vida y crecimiento personal, a tu propio ritmo.",
        },
        {
          title: "EMDR para trauma",
          desc: "Un enfoque basado en evidencia para que tu cerebro reprocese recuerdos difíciles y encuentre alivio duradero.",
        },
        {
          title: "Terapia de pareja",
          desc: "Reconstruye la conexión, mejora la comunicación y suelta los patrones que ya no les funcionan.",
        },
      ],
      learnMore: "Saber más",
    },
    about: {
      eyebrow: "Conoce a {firstName}",
      heading: "Arraigada en la conexión, enfocada en sanar.",
      body: [
        "Como trabajadora social clínica licenciada (LCSW), creo que la terapia es un proceso colaborativo donde vamos descubriendo la fuerza que ya vive dentro de ti. Todas y todos pasamos por estaciones: a veces de poda, a veces de crecimiento.",
        "Con más de 10 años de experiencia, me especializo en cuidado informado por el trauma, combinando prácticas basadas en evidencia como EMDR con un enfoque cálido y relacional. Ofrezco terapia culturalmente afirmativa en inglés y español, honrando el contexto único de cada persona.",
        "Ya sea que estés sanando heridas del pasado, atravesando una transición difícil o buscando entenderte mejor, estoy aquí para sostener un espacio seguro y firme.",
      ],
    },
    fees: {
      heading: "Una inversión en ti",
      items: [{ label: "Sesión estándar", price: "$180" }],
      inNetworkLabel: "Sesión individual o de pareja (50 min)",
      insuranceCardHeading: "Seguros aceptados",
      insurancePlans: [
        "Aetna",
        "Blue Cross Blue Shield of Texas",
        "United Healthcare",
      ],
      outOfNetworkHeading: "¿Fuera de red?",
      outOfNetworkBody:
        "Te doy un superbill para que pidas reembolso a tu seguro. También hay cupos limitados en escala flexible según necesidad económica.",
    },
    faq: {
      heading: "Preguntas frecuentes",
      items: [
        {
          q: "¿Ofreces terapia virtual?",
          a: "Sí — atiendo presencialmente en mi consultorio de Austin y por telesalud segura para cualquier persona dentro del estado de Texas.",
        },
        {
          q: "¿Qué pasa en la consulta de 15 minutos?",
          a: "Es una llamada relajada, sin presión, para hablar de lo que te trae a terapia, contestar tus dudas sobre mi forma de trabajar, y ver si nos sentimos en sintonía.",
        },
        {
          q: "¿Cómo funciona el EMDR?",
          a: "EMDR (desensibilización y reprocesamiento por movimientos oculares) es una técnica que alivia el malestar psicológico. Recordamos un evento difícil mientras recibes estimulación bilateral, lo que ayuda al cerebro a procesar el recuerdo de forma sana.",
        },
        {
          q: "¿Atiendes en español?",
          a: "Sí. Soy completamente bilingüe — entiendo lo importante que es poder expresarte en tu idioma materno durante el proceso terapéutico.",
        },
      ],
    },
    closing: {
      heading: "¿Lista o listo para comenzar?",
      cta: "Agenda tu consulta gratis",
    },
  },
};

const CONSTELLATION: ChromeBundle = {
  en: {
    navCta: "Client Portal",
    hero: {
      eyebrow: "Bilingual Therapy Practice",
      headlineL1: "Find clarity in the",
      headlineAccent: "constellation",
      headlineL2: "of your life.",
      sub: "Compassionate therapy for individuals and couples navigating trauma, life transitions, and relationship dynamics.",
      ctaPrimary: "Book a free 15-min consult",
    },
    services: {
      heading: "Focus Areas",
      items: [
        {
          title: "Individual Therapy",
          desc: "Explore your inner landscape, heal past wounds, and build resilience for the future in a safe, non-judgmental space.",
        },
        {
          title: "EMDR for Trauma",
          desc: "An evidence-based approach to help your brain reprocess traumatic memories and reduce emotional distress.",
        },
        {
          title: "Couples Therapy",
          desc: "Realign your relational stars. Improve communication, rebuild trust, and deepen your connection together.",
        },
      ],
    },
    about: {
      eyebrow: "Meet {firstName}",
      heading: "Mapping your",
      headingAccent: "inner universe.",
      body: [
        "I believe that our lives are made up of interconnected experiences—some bright, some dark—that form the unique constellation of who we are.",
        "As a bilingual licensed clinical social worker with over 12 years of experience, I specialize in helping individuals and couples navigate the complex terrain of trauma, anxiety, and relationship challenges.",
        "My approach is grounded in empathy, cultural humility, and evidence-based practices like EMDR. I'm here to help you find your north star and guide you toward healing and deeper connection.",
      ],
    },
    fees: {
      heading: "Details & Investment",
      cardHeading: "Fees",
      items: [
        { label: "Individual (50 min)", price: "$180" },
        { label: "Couples (60 min)", price: "$220" },
        { label: "EMDR (90 min)", price: "$250" },
      ],
      slidingScaleNote:
        "Sliding scale spots are occasionally available. Please inquire during your consultation.",
      insuranceCardHeading: "Insurance",
      insuranceLead: "I am currently an in-network provider for:",
      insurancePlans: ["Aetna", "BCBS Texas"],
      outOfNetworkBody:
        "For all other plans, I am considered out-of-network. I can provide a monthly superbill for you to submit to your insurance for potential reimbursement.",
    },
    faq: {
      heading: "FAQ",
      items: [
        {
          q: "What happens during the free consultation?",
          a: "The 15-minute phone consultation is a chance for us to connect briefly and see if we're a good fit. I'll ask you a bit about what brings you to therapy, you can ask me any questions about my approach or logistics, and we'll decide together on next steps. No pressure, just connection.",
        },
        {
          q: "Do you offer telehealth or in-person sessions?",
          a: "I currently offer a hybrid model. I see clients in-person at my South Austin office on Tuesdays and Wednesdays, and offer secure telehealth via your therapist's existing platform on Thursdays and Fridays for clients anywhere in Texas.",
        },
        {
          q: "How long does therapy usually last?",
          a: "Therapy is highly individualized. Some clients come for brief, solution-focused work (8-12 sessions) to address a specific transition, while others engage in longer-term depth work spanning months or years. We will regularly check in on your progress and ensure the work remains meaningful.",
        },
      ],
    },
    footer: {
      tagline: "Guiding you through the dark, toward connection and clarity.",
      contactHeading: "Contact",
      locationHeading: "Location",
      rightsReserved: "All rights reserved.",
      builtWithLabel: "Built with",
      builtWithSuffix: "by Ashford Creative",
    },
  },
  es: {
    navCta: "Portal del cliente",
    hero: {
      eyebrow: "Práctica de terapia bilingüe",
      headlineL1: "Encuentra claridad en la",
      headlineAccent: "constelación",
      headlineL2: "de tu vida.",
      sub: "Terapia compasiva para personas y parejas que atraviesan trauma, transiciones de vida y dinámicas de relación.",
      ctaPrimary: "Agenda una consulta gratis de 15 min",
    },
    services: {
      heading: "Áreas de enfoque",
      items: [
        {
          title: "Terapia individual",
          desc: "Explora tu paisaje interior, sana heridas del pasado y construye resiliencia para el futuro, en un espacio seguro y sin juicio.",
        },
        {
          title: "EMDR para trauma",
          desc: "Un enfoque basado en evidencia para que tu cerebro reprocese recuerdos difíciles y se calme el malestar emocional.",
        },
        {
          title: "Terapia de pareja",
          desc: "Reordena la constelación de su relación. Mejoren la comunicación, reconstruyan la confianza y profundicen su vínculo.",
        },
      ],
    },
    about: {
      eyebrow: "Conoce a {firstName}",
      heading: "Cartografiando tu",
      headingAccent: "universo interior.",
      body: [
        "Creo que nuestras vidas están hechas de experiencias entrelazadas — unas luminosas, otras oscuras — que forman la constelación única de quienes somos.",
        "Como trabajadora social clínica licenciada y bilingüe, con más de 12 años de experiencia, ayudo a personas y parejas a navegar el terreno complejo del trauma, la ansiedad y los retos de relación.",
        "Mi enfoque está cimentado en empatía, humildad cultural y prácticas basadas en evidencia como EMDR. Estoy aquí para ayudarte a encontrar tu estrella del norte y guiarte hacia la sanación y una conexión más profunda.",
      ],
    },
    fees: {
      heading: "Detalles e inversión",
      cardHeading: "Honorarios",
      items: [
        { label: "Individual (50 min)", price: "$180" },
        { label: "Pareja (60 min)", price: "$220" },
        { label: "EMDR (90 min)", price: "$250" },
      ],
      slidingScaleNote:
        "De vez en cuando hay cupos en escala flexible. Pregúntame en la consulta.",
      insuranceCardHeading: "Seguros",
      insuranceLead: "Actualmente estoy dentro de la red para:",
      insurancePlans: ["Aetna", "BCBS Texas"],
      outOfNetworkBody:
        "Para los demás planes estoy fuera de red. Te puedo dar un superbill mensual para que lo presentes a tu seguro y pidas reembolso.",
    },
    faq: {
      heading: "Preguntas",
      items: [
        {
          q: "¿Qué pasa durante la consulta gratis?",
          a: "La llamada de 15 minutos es para conocernos brevemente y ver si encajamos. Te pregunto un poco sobre lo que te trae a terapia, tú me preguntas lo que quieras sobre mi enfoque o los detalles, y decidimos juntos los siguientes pasos. Sin presión — solo conexión.",
        },
        {
          q: "¿Atiendes presencial o por telesalud?",
          a: "Trabajo híbrido. Atiendo en persona en mi consultorio del sur de Austin los martes y miércoles, y por telesalud segura a través de la plataforma de su terapeuta los jueves y viernes para clientes en cualquier parte de Texas.",
        },
        {
          q: "¿Cuánto suele durar la terapia?",
          a: "La terapia es muy personal. Algunas personas vienen para un trabajo breve y enfocado (8 a 12 sesiones) por una transición específica; otras hacen un trabajo más profundo que dura meses o años. Vamos revisando tu progreso para que el proceso siga teniendo sentido.",
        },
      ],
    },
    footer: {
      tagline:
        "Acompañándote a través de la oscuridad, hacia la conexión y la claridad.",
      contactHeading: "Contacto",
      locationHeading: "Ubicación",
      rightsReserved: "Todos los derechos reservados.",
      builtWithLabel: "Hecho con",
      builtWithSuffix: "por Ashford Creative",
    },
  },
};

const POLAROID: ChromeBundle = {
  en: {
    navCta: "Book Consult",
    hero: {
      eyebrow: "Therapy & Counseling",
      headlineL1: "Healing begins",
      headlineAccent: "where you are.",
      ctaPrimary: "Book a free 15-min consult",
    },
    services: {
      heading: "How we can work together",
      subhead: "tailored to your journey",
      items: [
        {
          title: "Individual Therapy",
          desc: "A dedicated space to explore your inner world, unlearn unhelpful patterns, and build resilience.",
          note: "one on one",
        },
        {
          title: "EMDR for Trauma",
          desc: "Evidence-based processing to help your brain heal from distressing memories and traumatic events.",
          note: "deep healing",
        },
        {
          title: "Couples Counseling",
          desc: "Rebuild connection, improve communication, and navigate conflict in a structured, supportive environment.",
          note: "together",
        },
      ],
    },
    about: {
      heading: "Hi, I'm {firstName}.",
      body: [
        "I'm a Licensed Clinical Social Worker based in Austin, Texas, offering bilingual therapy to adults navigating the complexities of modern life.",
        "With over 10 years of experience, my approach is rooted in compassion, evidence-based practices, and the belief that you are the expert of your own story.",
        "Whether we are working through past trauma with EMDR or finding new ways to connect in your relationships, my goal is to provide a warm, non-judgmental space for your growth.",
      ],
      polaroidCaptions: {
        back: "finding peace",
        front: "welcome in.",
        about: "hello!",
      },
    },
    fees: {
      heading: "Fees & Insurance",
      items: [
        { label: "Individual Session (50 min)", price: "$180" },
        { label: "Couples Session (60 min)", price: "$210" },
        { label: "EMDR Session (90 min)", price: "$250" },
      ],
      insuranceLead:
        "I am an in-network provider with the following insurance panels:",
      insurancePlans: ["Aetna", "BCBS of Texas"],
      slidingScaleNote:
        "A limited number of sliding scale slots are available based on financial need.",
    },
    faq: {
      heading: "Questions",
      items: [
        {
          q: "Do you offer in-person or telehealth sessions?",
          a: "Currently, I offer a hybrid model. I see clients in-person on Tuesdays and Thursdays in Central Austin, and offer telehealth via a secure video platform on Mondays and Wednesdays.",
        },
        {
          q: "What is EMDR therapy like?",
          a: "EMDR uses bilateral stimulation (like eye movements) to help process distressing memories. It's less about talking through the trauma and more about letting your brain's natural healing processes take over.",
        },
        {
          q: "How do I get started?",
          a: "The first step is a free 15-minute phone consultation to see if we're a good fit. We'll discuss your goals, my approach, and logistical details.",
        },
      ],
    },
    closing: {
      cta: "Schedule Consultation",
    },
    footer: {
      hoursLabel: "Mon-Thu, 9am - 5pm",
      emailNote: "Usually replies in 24h",
      rightsReserved: "All rights reserved.",
      legalLinks: ["Privacy Policy", "Good Faith Estimate"],
      credentialsFallback: "Licensed Clinical Social Worker",
    },
    quote: {
      text:
        "“The curious paradox is that when I accept myself just as I am, then I can change.”",
      attribution: "— Carl Rogers",
    },
  },
  es: {
    navCta: "Reservar consulta",
    hero: {
      eyebrow: "Terapia y consejería",
      headlineL1: "Sanar comienza",
      headlineAccent: "donde estás.",
      ctaPrimary: "Agenda una consulta gratis de 15 min",
    },
    services: {
      heading: "Cómo podemos trabajar juntos",
      subhead: "diseñado para tu camino",
      items: [
        {
          title: "Terapia individual",
          desc: "Un espacio dedicado para explorar tu mundo interior, soltar patrones que no ayudan y construir resiliencia.",
          note: "uno a uno",
        },
        {
          title: "EMDR para trauma",
          desc: "Procesamiento basado en evidencia para que tu cerebro sane los recuerdos difíciles y los eventos traumáticos.",
          note: "sanar profundo",
        },
        {
          title: "Terapia de pareja",
          desc: "Reconstruir la conexión, mejorar la comunicación y atravesar el conflicto en un espacio estructurado y de apoyo.",
          note: "juntos",
        },
      ],
    },
    about: {
      heading: "Hola, soy {firstName}.",
      body: [
        "Soy trabajadora social clínica licenciada (LCSW), con base en Austin, Texas. Ofrezco terapia bilingüe para personas adultas que están atravesando las complejidades de la vida moderna.",
        "Con más de 10 años de experiencia, mi enfoque está cimentado en la compasión, las prácticas basadas en evidencia y la convicción de que tú eres la persona experta en tu propia historia.",
        "Ya sea que estemos trabajando trauma del pasado con EMDR o encontrando nuevas formas de conectar en tus relaciones, mi meta es sostener un espacio cálido y sin juicios para que crezcas.",
      ],
      polaroidCaptions: {
        back: "encontrar la paz",
        front: "pásale.",
        about: "¡hola!",
      },
    },
    fees: {
      heading: "Honorarios y seguros",
      items: [
        { label: "Sesión individual (50 min)", price: "$180" },
        { label: "Sesión de pareja (60 min)", price: "$210" },
        { label: "Sesión EMDR (90 min)", price: "$250" },
      ],
      insuranceLead: "Estoy dentro de la red con los siguientes seguros:",
      insurancePlans: ["Aetna", "BCBS of Texas"],
      slidingScaleNote:
        "Hay cupos limitados en escala flexible, según necesidad económica.",
    },
    faq: {
      heading: "Preguntas",
      items: [
        {
          q: "¿Atiendes en persona o por telesalud?",
          a: "Trabajo híbrido. Atiendo en persona los martes y jueves en el centro de Austin, y por telesalud (plataforma de video segura) los lunes y miércoles.",
        },
        {
          q: "¿Cómo se siente la terapia EMDR?",
          a: "EMDR usa estimulación bilateral (como movimientos oculares) para procesar recuerdos difíciles. Hablamos menos del trauma y dejamos que el proceso natural de sanación de tu cerebro haga el trabajo.",
        },
        {
          q: "¿Cómo empezamos?",
          a: "El primer paso es una llamada gratis de 15 minutos para ver si encajamos. Hablamos de tus metas, de mi enfoque y de los detalles logísticos.",
        },
      ],
    },
    closing: {
      cta: "Agendar consulta",
    },
    footer: {
      hoursLabel: "Lun-Jue, 9am - 5pm",
      emailNote: "Suelo responder en 24h",
      rightsReserved: "Todos los derechos reservados.",
      legalLinks: ["Aviso de privacidad", "Presupuesto de buena fe"],
      credentialsFallback: "Trabajadora Social Clínica Licenciada",
    },
    quote: {
      text:
        "“La paradoja curiosa es que cuando me acepto tal como soy, entonces puedo cambiar.”",
      attribution: "— Carl Rogers",
    },
  },
};

const ATRIUM: ChromeBundle = {
  en: {
    navCta: "Consult",
    hero: {
      eyebrow: "Licensed Clinical Social Worker",
      // Atrium's H1 is built from the practitioner's name in the template.
      headlineL1: "",
      ctaPrimary: "Book a free 15-min consult",
    },
    services: {
      heading: "Clinical Focus",
      items: [
        {
          title: "Individual Therapy",
          desc: "A refined space to untangle complex narratives and reconstruct your inner foundation.",
        },
        {
          title: "EMDR for Trauma",
          desc: "Advanced bilateral stimulation to process and integrate deep-seated emotional structural fractures.",
        },
        {
          title: "Couples Counseling",
          desc: "Rebuilding relational bridges. Fostering secure attachment and sophisticated communication.",
        },
      ],
      explore: "Explore",
    },
    about: {
      heading: "The Architect",
      body: [
        "With over a decade of clinical excellence in Austin, I specialize in dismantling deep-rooted patterns and constructing resilient emotional frameworks.",
        "My approach marries the rigorous structure of evidence-based practice with the nuanced art of psychoanalytic inquiry.",
        "As a fully bilingual practitioner, I offer therapy that respects the cultural intricacies of your unique narrative.",
      ],
    },
    fees: {
      heading: "Investment",
      items: [
        { label: "Standard Session (50 min)", price: "$180" },
        { label: "EMDR Session (90 min)", price: "$250" },
      ],
      slidingScaleNote: "Sliding scale options available upon inquiry.",
      insuranceCardHeading: "Insurance",
      insuranceLead:
        "I am currently an in-network provider for select carriers in Texas. For out-of-network clients, I provide a superbill for direct reimbursement.",
      insurancePlans: ["Aetna", "BCBS Texas", "Out of Network"],
    },
    faq: {
      heading: "Inquiries",
      items: [
        {
          q: "Do you offer virtual sessions?",
          a: "Yes, I offer secure telehealth via your therapist's existing platform for clients residing anywhere in Texas.",
        },
        {
          q: "What happens in a 15-minute consult?",
          a: "We will discuss your current challenges, logistical needs, and determine if our therapeutic styles align before committing to an intake.",
        },
        {
          q: "How often should we meet?",
          a: "Typically, I recommend weekly sessions initially to build momentum, transitioning to bi-weekly as structural changes stabilize.",
        },
      ],
    },
    closing: {
      cta: "Begin Consultation",
    },
    footer: {
      bilingualLabel: "Bilingual (EN/ES)",
      designByPrefix: "Design by",
      rightsReserved: "All rights reserved.",
    },
  },
  es: {
    navCta: "Consulta",
    hero: {
      eyebrow: "Trabajadora social clínica licenciada",
      headlineL1: "",
      ctaPrimary: "Reserva una consulta gratis de 15 min",
    },
    services: {
      heading: "Enfoque clínico",
      items: [
        {
          title: "Terapia individual",
          desc: "Un espacio refinado para desenredar narrativas complejas y reconstruir tu base interior.",
        },
        {
          title: "EMDR para trauma",
          desc: "Estimulación bilateral avanzada para procesar e integrar las fracturas emocionales más profundas.",
        },
        {
          title: "Terapia de pareja",
          desc: "Reconstruyendo puentes relacionales. Cultivando apego seguro y una comunicación más sofisticada.",
        },
      ],
      explore: "Explorar",
    },
    about: {
      heading: "La arquitecta",
      body: [
        "Con más de una década de práctica clínica en Austin, me especializo en desarmar patrones arraigados y construir estructuras emocionales resilientes.",
        "Mi enfoque combina el rigor de la práctica basada en evidencia con el arte matizado de la indagación psicoanalítica.",
        "Como profesional completamente bilingüe, ofrezco una terapia que respeta las complejidades culturales de tu historia única.",
      ],
    },
    fees: {
      heading: "Inversión",
      items: [
        { label: "Sesión estándar (50 min)", price: "$180" },
        { label: "Sesión EMDR (90 min)", price: "$250" },
      ],
      slidingScaleNote: "Opciones de escala flexible disponibles a petición.",
      insuranceCardHeading: "Seguro",
      insuranceLead:
        "Actualmente estoy dentro de la red para algunas aseguradoras en Texas. Para clientes fuera de red, te entrego un superbill para que pidas reembolso directo.",
      insurancePlans: ["Aetna", "BCBS Texas", "Fuera de red"],
    },
    faq: {
      heading: "Preguntas",
      items: [
        {
          q: "¿Ofreces sesiones virtuales?",
          a: "Sí — ofrezco sesiones de telesalud segura a través de la plataforma de su terapeuta para clientes que residen en cualquier parte de Texas.",
        },
        {
          q: "¿Qué pasa en la consulta de 15 minutos?",
          a: "Conversamos sobre tus retos actuales, las necesidades logísticas y vemos si nuestros estilos terapéuticos se alinean antes de comprometernos a una sesión inicial.",
        },
        {
          q: "¿Con qué frecuencia nos vemos?",
          a: "Suelo recomendar sesiones semanales al principio para crear impulso; luego pasamos a quincenales cuando los cambios estructurales se estabilizan.",
        },
      ],
    },
    closing: {
      cta: "Comenzar consulta",
    },
    footer: {
      bilingualLabel: "Bilingüe (EN/ES)",
      designByPrefix: "Diseño por",
      rightsReserved: "Todos los derechos reservados.",
    },
  },
};

export const TEMPLATE_CHROME: Record<TemplateKey, ChromeBundle> = {
  sunrise: SUNRISE,
  garden: GARDEN,
  constellation: CONSTELLATION,
  polaroid: POLAROID,
  // Playful Modern inherits Sunrise's chrome bundle (closest visual
  // and tonal cousin) until per-template chrome is curated.
  playful_modern: SUNRISE,
  // Front Porch's own copy lives in strings.ts under fp_*. The retired
  // ATRIUM bundle (calm, considered first-person) is the closest
  // tonal match for any legacy caller that still uses pickChrome().
  front_porch: ATRIUM,
  // Hello Friend's own copy lives in strings.ts under hf_*. SUNRISE
  // is the closest existing tonal cousin for legacy callers.
  hello_friend: SUNRISE,
};

/**
 * Pick the chrome bundle for a (template, locale) pair. Templates pull
 * this once per render and read straight off the returned object.
 */
export function pickChrome(
  key: TemplateKey,
  locale: Locale,
): TemplateChrome {
  return TEMPLATE_CHROME[key][locale];
}

/**
 * Tiny `{firstName}` substitution helper. Kept here (rather than reusing
 * `strings.ts`'s interpolate) so chrome consumers don't have to import
 * from the i18n provider just for this one purpose.
 */
export function fillName(template: string, firstName: string): string {
  return template.replace(/\{firstName\}/g, firstName);
}
