/**
 * Demo personas for the template gallery.
 *
 * One persona per template key; the gallery route renders the persona
 * verbatim. The prospect-portal route still uses real lead content
 * (TemplateContent) — personas are the *defaults* templates fall back
 * to when no real data is mounted.
 *
 * Ownership model: editorial voice + clinical accuracy lives here.
 * Templates render personas through the section primitives; they do
 * not invent therapy copy of their own.
 */

export interface FocusArea {
  title: string;
  body: string;
}

export interface FeeLine {
  label: string;
  price: string;
  note?: string;
}

export interface Testimonial {
  quote_en: string;
  quote_es: string;
  attribution: string;
}

export interface OfficeTourPhoto {
  caption_en: string;
  caption_es: string;
  description: string;
}

export interface PersonaProfile {
  name: string;
  credentials: string;
  city: string;
  state: string;
  modalities: string[];
  populations: string[];
  focus_areas: FocusArea[];
  fees: FeeLine[];
  insurance: string[];
  telehealth: boolean;
  bio_en: string;
  bio_es: string;
  /** Persona portrait URL. After the Phase 4 photo wiring this is a base
   *  path WITHOUT extension (e.g. `/images/atrium-portrait`) so the
   *  ResponsivePicture primitive in `components/photo/ResponsivePicture`
   *  expands it into WebP@1x/2x + JPG variants. Legacy entries with a
   *  `.png` / `.svg` extension still render as a bare `<img>` via the
   *  About primitive's smart-detect path. */
  photo_url: string;
  booking_url: string;
  license_number: string;
  /** Descriptive alt text for the portrait, EN + ES. 8-15 words; specific
   *  rather than "therapist photo". Surfaced through resolvePersona as
   *  `portraitAlt` for templates that render the persona via <About>.
   *  Optional so personas that don't yet have a portrait (quiet_practice)
   *  can omit it. */
  photo_alt?: {
    en: string;
    es: string;
  };
  /** 2–3 short quotes from clients (or first-person "what clients tell me" lines
   *  when no client review is available). Optional so older personas that
   *  pre-date Phase 8 still type-check. */
  testimonials?: Testimonial[];
  /** Office-tour photo descriptions (image briefs, not URLs). The marketing
   *  team turns these into real assets later; templates that render an
   *  office-tour grid read the captions for alt text + on-page copy. */
  office_tour?: OfficeTourPhoto[];
}

/**
 * The keys here will eventually align with TemplateKeyLiteral once the
 * 9-template lineup is finalised. For now the record is keyed by
 * `string` so the two unannounced template keys can be added in Phase 3
 * without first widening the canonical TemplateKeyLiteral union.
 */
export const PERSONAS: Record<string, PersonaProfile> = {
  // ---------------------------------------------------------------------
  // Legacy alias — Atrium retired 2026-05. Kept in the record so callers
  // that still pass templateKey "atrium" before normalisation don't 404.
  // The persona itself reads as a tasteful default; templates resolve to
  // garden when "atrium" is encountered downstream.
  // ---------------------------------------------------------------------
  atrium: {
    name: "Dr. Helena Sun-Reyes",
    credentials: "PhD, Licensed Psychologist",
    city: "Austin",
    state: "TX",
    modalities: [
      "Psychodynamic therapy",
      "EMDR",
      "Internal Family Systems (IFS)",
      "Existential therapy",
    ],
    populations: [
      "Adults",
      "High-functioning professionals",
      "Bilingual EN/ES clients",
      "Adult children of immigrants",
    ],
    focus_areas: [
      {
        title: "The architecture of becoming",
        body:
          "Long-form depth work for adults rebuilding the framework of a life that no longer fits. Cadence is weekly; meaningful change usually unfolds over six to eighteen months.",
      },
      {
        title: "Trauma without urgency",
        body:
          "EMDR and parts work, paced to your nervous system. We don't rush re-processing; we build resourcing first and let memory networks settle on their own timeline.",
      },
      {
        title: "Identity at the seams",
        body:
          "For bicultural clients, adult children of immigrants, and anyone holding more than one self in public. We treat the seam, not just the parts.",
      },
    ],
    fees: [
      { label: "Initial consultation (50 min)", price: "Complimentary, 15 min" },
      { label: "Individual session (50 min)", price: "$285" },
      { label: "Extended session (80 min)", price: "$420" },
      { label: "EMDR intensive (3 hrs)", price: "$850" },
    ],
    insurance: ["Aetna", "BlueCross BlueShield", "Cigna", "Out-of-network superbill provided"],
    telehealth: true,
    bio_en:
      "I work with adults rebuilding the architecture of a life that no longer fits. My practice draws on psychodynamic theory, EMDR, and Internal Family Systems — all held inside a clear treatment frame. Sessions are weekly; depth work usually unfolds over six to eighteen months. I see clients in English and Spanish, in person in Austin and online across Texas. Twelve years of clinical work, four of those in private practice.",
    bio_es:
      "Trabajo con adultos que reconstruyen la arquitectura de una vida que ya no encaja. Mi práctica integra teoría psicodinámica, EMDR y Sistemas Internos de la Familia — sostenidos dentro de un encuadre clínico claro. Sesiones semanales; el trabajo profundo suele desplegarse entre seis y dieciocho meses. Atiendo en inglés y español, presencialmente en Austin y en línea en todo Texas. Doce años de trabajo clínico, cuatro en práctica privada.",
    // Reuses the existing Atrium portrait asset already shipped in
    // public/images/. Swap to a Helena-specific photo when available.
    photo_url: "/images/atrium-portrait.jpg",
    booking_url: "https://cal.com/helena-sun-reyes/15min",
    license_number: "TX PSY 38291",
    photo_alt: {
      en: "Dr. Helena Sun-Reyes seated in a slate and linen interior, slate-blue blouse, calm warm smile",
      es: "La Dra. Helena Sun-Reyes sentada en un interior de lino y pizarra, blusa azul, sonrisa cálida y serena",
    },
  },

  // ---------------------------------------------------------------------
  // TODO stubs — Phase 3 will populate these from the brief's persona table.
  // Each stub satisfies the type so tsc passes; copy is intentionally
  // unusable so a forgotten stub fails the editorial review obviously.
  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // Garden — Joanna Reyes-Kim, LMFT. Phase 2 pilot.
  // Plano, TX · trauma-informed family therapy + perinatal mental health
  // for the family system. Sage greenhouse aesthetic, warm and plain-
  // spoken — speaks to a parent reading at the end of a hard day.
  // ---------------------------------------------------------------------
  garden: {
    name: "Joanna Reyes-Kim, LMFT",
    credentials: "LMFT, Licensed Marriage & Family Therapist",
    city: "Plano",
    state: "TX",
    modalities: [
      "Trauma-informed family therapy",
      "Attachment-focused therapy",
      "Perinatal mental health (family-system)",
      "Play therapy",
    ],
    populations: [
      "Children",
      "Parents",
      "Couples becoming parents",
      "Adoptive and blended families",
    ],
    focus_areas: [
      {
        title: "Parenting through hard seasons",
        body:
          "When your child is struggling and the strategies you grew up with don't quite fit. We make sense of what's happening underneath the behavior, and find a way to keep the connection while you both find your feet.",
      },
      {
        title: "Children and family attachment",
        body:
          "Play-based, family-included sessions for children five and up — and the parents who love them. Trauma-informed, attachment-focused, and paced for whoever in the room needs the most patience that week.",
      },
      {
        title: "Becoming a parent (perinatal)",
        body:
          "For the part of pregnancy, postpartum, or the road to becoming a parent that nobody quite warned you about. We hold space for both partners and the family that's coming into being.",
      },
    ],
    fees: [
      { label: "Initial consultation (15 min)", price: "Free" },
      { label: "Family or couple session (50 min)", price: "$190" },
      { label: "Individual or child session (45 min)", price: "$165" },
      { label: "Sliding-scale spots", price: "Ask in consult" },
    ],
    insurance: [
      "BCBS Texas",
      "Aetna",
      "Cigna",
      "Sliding-scale spots available",
    ],
    telehealth: true,
    bio_en:
      "Hi, I'm Joanna. I'm a marriage and family therapist in Plano, and I work with whole families — children, parents, couples becoming parents, and the families that grow through adoption or blending. My approach is trauma-informed and attachment-focused, which is a clinical way of saying that I pay close attention to safety, connection, and the small repeats that make a family feel like home. I see clients in person at my Plano office and online across Texas.\n\nMost of the families who find me are in a hard season — a child who is struggling, a postpartum that turned out heavier than anyone expected, a blended-family rhythm that hasn't quite landed yet. We don't try to fix everyone in the first session. We slow the room down, look at what's actually happening underneath, and build a new way of being together that holds up after we close the office door.",
    bio_es:
      "Hola, soy Joanna. Soy terapeuta de matrimonio y familia en Plano, y trabajo con familias enteras — niños, padres, parejas que están por ser padres, y las familias que crecen por adopción o por mezcla. Mi enfoque es informado en trauma y centrado en el apego, que es una manera clínica de decir que pongo mucha atención a la seguridad, la conexión y los pequeños gestos repetidos que hacen que una familia se sienta como un hogar. Atiendo en persona en mi oficina de Plano y en línea en todo Texas.\n\nLa mayoría de las familias que llegan a mí están en una temporada difícil — un hijo que está sufriendo, un postparto más pesado de lo esperado, una familia ensamblada que aún no ha encontrado su ritmo. No intentamos arreglar todo en la primera sesión. Bajamos el ritmo, miramos lo que está pasando por debajo y construimos juntos una manera de estar que se sostenga después de cerrar la puerta de la oficina.",
    photo_url: "/images/garden-portrait.jpg",
    booking_url: "https://cal.com/joanna-reyes-kim/15min",
    license_number: "TX LMFT 12345",
    photo_alt: {
      en: "Joanna Reyes-Kim smiling in a sage cardigan over cream linen, beside a sunlit windowsill of potted houseplants",
      es: "Joanna Reyes-Kim sonriendo con cárdigan salvia sobre lino crema, junto a una ventana soleada con plantas en macetas",
    },
    testimonials: [
      {
        quote_en: "Joanna helped us slow down enough to actually hear our son. Six months in, the house feels like home again.",
        quote_es: "Joanna nos ayudó a bajar el ritmo lo suficiente para escuchar de verdad a nuestro hijo. A los seis meses, la casa vuelve a sentirse como un hogar.",
        attribution: "Parent of a 9-year-old · Plano",
      },
      {
        quote_en: "I came in expecting parenting tips. I left with a different relationship with my own mother — and then with my daughter.",
        quote_es: "Llegué esperando consejos para criar. Me fui con una relación distinta con mi propia madre — y luego con mi hija.",
        attribution: "Mom of two · Frisco",
      },
      {
        quote_en: "She held space for both of us during postpartum without ever taking sides. We needed that more than we knew.",
        quote_es: "Sostuvo el espacio para los dos durante el postparto sin tomar partido nunca. Lo necesitábamos más de lo que sabíamos.",
        attribution: "New parents · Allen",
      },
    ],
    office_tour: [
      {
        caption_en: "The waiting nook — a low sage couch, a stack of board books, a teapot kept warm on weekday afternoons.",
        caption_es: "El rincón de espera — un sofá bajo color salvia, una pila de libros ilustrados, una tetera tibia en las tardes entre semana.",
        description: "Sage linen couch with cream cushions, low children's bookshelf, ceramic teapot on small wooden side table, soft afternoon window light",
      },
      {
        caption_en: "The play corner — wool rug, wooden animal figures, a basket of sand-tray miniatures for when words run out.",
        caption_es: "El rincón de juego — alfombra de lana, figuras de madera, una canasta de miniaturas para la bandeja de arena cuando faltan palabras.",
        description: "Soft wool rug, hand-carved wooden animals, woven basket of small sand-tray figures, natural light from greenhouse window",
      },
      {
        caption_en: "The greenhouse window — succulents, a fiddle-leaf, a pair of armchairs angled toward each other rather than the therapist.",
        caption_es: "La ventana invernadero — suculentas, una ficus lira, dos sillones inclinados el uno hacia el otro, no hacia la terapeuta.",
        description: "Two upholstered armchairs facing each other under a tall window dense with houseplants, soft sage walls",
      },
    ],
  },
  // ---------------------------------------------------------------------
  // Sunrise — Dr. Riya Mehta, LPC. Phase 2 port.
  // Dallas, TX (telehealth across Texas) · perinatal mental health,
  // birth trauma, pregnancy loss. Warm and hopeful — names the
  // loneliness of postpartum specifically.
  // ---------------------------------------------------------------------
  sunrise: {
    name: "Dr. Riya Mehta, LPC",
    credentials: "LPC, PMH-C · Perinatal Mental Health Certified",
    city: "Dallas",
    state: "TX",
    modalities: [
      "Perinatal Mental Health (PMH-C)",
      "Cognitive Behavioral Therapy (CBT)",
      "Acceptance & Commitment Therapy (ACT)",
      "Trauma-focused therapy",
    ],
    populations: [
      "Pregnant and postpartum people",
      "Partners",
      "Pregnancy loss",
      "Birth trauma",
    ],
    focus_areas: [
      {
        title: "Postpartum depression and anxiety",
        body:
          "For the part of postpartum that nobody warned you about — the 3 a.m. catastrophizing, the rage that surprises you, the flatness where joy used to live. We name what's happening, build practical tools, and slow the spiral.",
      },
      {
        title: "Birth trauma and PTSD",
        body:
          "When the birth didn't go the way you hoped — or it did, and you still can't stop replaying it. Trauma-focused work paced for a body still recovering, with room for the partner who was in the room too.",
      },
      {
        title: "Pregnancy loss",
        body:
          "Miscarriage, stillbirth, infant loss, the loss of a pregnancy you didn't realize you were already planning a life around. We make space for the grief without rushing it, and for the question of what comes next when you're ready.",
      },
    ],
    fees: [
      { label: "15-min consultation", price: "Free" },
      { label: "Individual session (50 min)", price: "$210" },
      { label: "Couples session (60 min)", price: "$245" },
      { label: "Pregnancy-loss support session", price: "$190" },
    ],
    insurance: ["BCBS", "Aetna", "United", "Cigna", "HSA/FSA accepted"],
    telehealth: true,
    bio_en:
      "Hi, I'm Riya. I'm a perinatal mental health-certified counselor, which means I sit specifically with the people whose hardest season has happened around pregnancy, birth, and the first years after. Postpartum depression and anxiety, birth trauma, pregnancy loss, the partner who was a witness and is now wondering if they're allowed to fall apart too. My approach is warm and practical — CBT and ACT for the parts of your day that need a tool, trauma-focused work for the parts of you that need to be heard before they need a tool.\n\nMost of my clients see me online from anywhere in Texas; I keep a small in-person practice in Dallas one week a quarter. You don't need a diagnosis or a worst day to call. The free 15-minute consultation is for you to feel out whether I'm a fit, no pressure either way.",
    bio_es:
      "Hola, soy Riya. Soy consejera certificada en salud mental perinatal, lo que significa que acompaño específicamente a personas cuya temporada más difícil ha sucedido alrededor del embarazo, el parto y los primeros años después. Depresión y ansiedad postparto, trauma del parto, pérdida gestacional, la pareja que fue testigo y ahora se pregunta si también tiene permiso para derrumbarse. Mi enfoque es cálido y práctico — TCC y ACT para las partes del día que necesitan una herramienta, trabajo centrado en trauma para las partes de ti que necesitan ser escuchadas antes de necesitar una herramienta.\n\nLa mayoría de mis pacientes me ven en línea desde cualquier punto de Texas; mantengo una pequeña práctica presencial en Dallas una semana por trimestre. No necesitas un diagnóstico ni un día especialmente malo para llamar. La consulta gratuita de 15 minutos es para que sientas si encajamos, sin compromiso.",
    photo_url: "/images/sunrise-portrait.jpg",
    booking_url: "https://cal.com/riya-mehta/15min",
    license_number: "TX LPC 67890",
    photo_alt: {
      en: "Dr. Riya Mehta with long dark hair in a dusty plum sweater, soft hopeful expression under golden-hour peach light",
      es: "La Dra. Riya Mehta con cabello largo oscuro y suéter ciruelo, expresión esperanzadora bajo luz dorada melocotón",
    },
    testimonials: [
      {
        quote_en: "Riya was the first person who didn't try to fix me at four months postpartum. She just stayed in the room with it. That was the turn.",
        quote_es: "Riya fue la primera persona que no intentó arreglarme a los cuatro meses postparto. Solo se quedó en la sala conmigo. Ese fue el giro.",
        attribution: "Postpartum client · Dallas",
      },
      {
        quote_en: "After the loss, I didn't think anyone could hold both the grief and the still-wanting. She did, every week, for as long as it took.",
        quote_es: "Después de la pérdida, no creí que nadie pudiera sostener el duelo y el seguir queriendo a la vez. Ella lo hizo, cada semana, todo el tiempo que hizo falta.",
        attribution: "Pregnancy-loss client · Plano",
      },
      {
        quote_en: "I came in for the flashbacks from the birth. I left, six months later, able to be in a room with my own baby without bracing.",
        quote_es: "Vine por los flashbacks del parto. Salí, seis meses después, capaz de estar en una sala con mi propia bebé sin tensarme.",
        attribution: "Birth-trauma client · Telehealth, Houston",
      },
    ],
    office_tour: [
      {
        caption_en: "The Dallas room — dusty plum walls, a low chaise, a soft throw kept folded on the back for the days that need it.",
        caption_es: "La sala de Dallas — paredes color ciruelo, un diván bajo, una manta suave doblada en el respaldo para los días que la piden.",
        description: "Dusty plum accent wall, low velvet chaise in deep mauve, soft cream throw folded over arm, warm peach-toned floor lamp",
      },
      {
        caption_en: "The window seat — overlooking a small inner courtyard, a tissue box that doesn't pretend not to be needed.",
        caption_es: "El asiento junto a la ventana — con vista a un pequeño patio interior, una caja de pañuelos que no finge no ser necesaria.",
        description: "Window seat with cushions facing a quiet courtyard, ceramic tissue box on side table, soft golden hour light through linen curtains",
      },
      {
        caption_en: "The telehealth corner — the same plum wall, the same low light, so the screen feels less like a screen.",
        caption_es: "El rincón de telesalud — la misma pared ciruelo, la misma luz baja, para que la pantalla se sienta menos como una pantalla.",
        description: "Small home-office nook with plum backdrop, warm desk lamp, single armchair angled for camera, framed botanical print on wall",
      },
    ],
  },
  // ---------------------------------------------------------------------
  // Constellation — Dr. Elena Park, PsyD. Phase 2 port.
  // Houston · executive therapy for founders, C-suite, creatives.
  // Controlled, clinical-but-warm voice; references her own years
  // working with executives without making it the page's subject.
  // ---------------------------------------------------------------------
  constellation: {
    name: "Dr. Elena Park, PsyD",
    credentials: "PsyD · Licensed Psychologist",
    city: "Houston",
    state: "TX",
    modalities: [
      "Cognitive Behavioral Therapy (CBT)",
      "Executive coaching framework",
      "Acceptance & Commitment Therapy (ACT)",
      "Internal Family Systems (IFS)",
    ],
    populations: [
      "Founders",
      "C-suite executives",
      "Creatives at the top of their field",
      "High-performing adults",
    ],
    focus_areas: [
      {
        title: "Executive burnout and decision fatigue",
        body:
          "When the volume of decisions has compounded for long enough that your nervous system is making them too. We restore the bandwidth, then build a sustainable cadence.",
      },
      {
        title: "Identity beyond the company",
        body:
          "For the founder considering an exit, the C-suite executive at year fourteen, the creative who hasn't taken a Sunday off since 2019. We work on who you are when the role isn't doing the work for you.",
      },
      {
        title: "Perfectionism and self-criticism",
        body:
          "The internal monologue that got you here is also the one keeping you awake. We don't try to silence it. We re-train it.",
      },
    ],
    fees: [
      { label: "Initial consultation (15 min)", price: "Complimentary" },
      { label: "Individual session (50 min)", price: "$340" },
      { label: "Extended session (75 min)", price: "$485" },
      { label: "Executive intensive (3 hrs)", price: "$1,200" },
    ],
    insurance: ["Out-of-network only", "Superbills provided", "HSA/FSA accepted"],
    telehealth: true,
    bio_en:
      "I'm Elena Park, a licensed psychologist based in Houston. I work primarily with founders, executives, and creatives at the top of their field — people whose work demands a high tolerance for ambiguity and whose internal life often hasn't caught up. Before I returned to clinical practice, I spent eight years embedded inside C-suite teams as an organizational consultant, which is where I learned that the most effective leaders are also the most often quietly exhausted.\n\nMy approach is controlled and direct. I work in CBT, ACT, IFS, and the executive-coaching framework — not as separate boxes, but as a single integrated method paced for the kind of mind that prefers a clear treatment plan to an open-ended one. I see clients in person at my Houston office and online across Texas. The first conversation is a complimentary 15-minute call; we'll know inside it whether to keep going.",
    bio_es:
      "Soy Elena Park, psicóloga licenciada en Houston. Trabajo principalmente con fundadores, ejecutivos y creativos en la cima de su campo — personas cuyo trabajo exige una alta tolerancia a la ambigüedad y cuya vida interior a menudo no ha alcanzado a la externa. Antes de regresar a la práctica clínica, pasé ocho años integrada en equipos C-suite como consultora organizacional, y ahí aprendí que los líderes más efectivos suelen ser también los más calladamente agotados.\n\nMi enfoque es controlado y directo. Trabajo en TCC, ACT, IFS y el marco del coaching ejecutivo — no como cajas separadas, sino como un método integrado al ritmo de mentes que prefieren un plan de tratamiento claro a uno abierto. Atiendo presencial en mi oficina de Houston y en línea en todo Texas. La primera conversación es una llamada gratuita de 15 minutos; lo sabremos durante esa llamada si seguimos adelante.",
    photo_url: "/images/constellation-portrait.jpg",
    booking_url: "https://cal.com/elena-park/15min",
    license_number: "TX PSY 41209",
    photo_alt: {
      en: "Dr. Elena Park in a black blazer over cream silk, composed direct gaze, warm gold rim light against deep navy",
      es: "La Dra. Elena Park con blazer negro sobre seda crema, mirada serena, luz dorada sobre fondo azul profundo",
    },
    testimonials: [
      {
        quote_en: "Elena reads a room — including the one in my head — faster than anyone I've worked with, and she does it without performing it.",
        quote_es: "Elena lee una sala — incluida la que tengo en la cabeza — más rápido que cualquiera con quien haya trabajado, y lo hace sin actuarlo.",
        attribution: "Series-B founder · Houston",
      },
      {
        quote_en: "I came in because I couldn't sleep before board meetings. I stayed because she's the only person who's ever asked me what I'd build if no one were watching.",
        quote_es: "Vine porque no podía dormir antes de las juntas. Me quedé porque es la única persona que me ha preguntado qué construiría si nadie estuviera mirando.",
        attribution: "C-suite operator · Houston",
      },
      {
        quote_en: "She is direct. She is also kind. I had not understood those two things could occupy the same fifty minutes.",
        quote_es: "Es directa. También es amable. No había entendido que esas dos cosas pudieran ocupar los mismos cincuenta minutos.",
        attribution: "Creative director · Austin (telehealth)",
      },
    ],
    office_tour: [
      {
        caption_en: "The Houston suite — deep navy walls, brass sconces, two leather chairs angled toward each other under a single low pendant.",
        caption_es: "La oficina de Houston — paredes azul profundo, apliques de latón, dos sillones de cuero inclinados bajo una única lámpara baja.",
        description: "Deep navy painted walls, two oxblood leather wingback chairs facing each other, brass pendant lamp casting warm pool of light, polished walnut floor",
      },
      {
        caption_en: "The library wall — a quiet collection of clinical, philosophy, and business titles, kept tidy without performing the keeping.",
        caption_es: "La pared biblioteca — una colección discreta de títulos clínicos, filosóficos y de negocios, ordenada sin actuar el orden.",
        description: "Floor-to-ceiling walnut bookshelf with arranged hardcover books, brass reading lamp, single framed botanical etching, navy backdrop",
      },
      {
        caption_en: "The window over the skyline — the city visible but distant; the room itself stays quiet.",
        caption_es: "La ventana sobre el horizonte — la ciudad visible pero distante; la sala misma se mantiene en silencio.",
        description: "Wide window overlooking Houston skyline at dusk, gold rim light catching the edge of a low velvet sofa, single ceramic vessel on side table",
      },
    ],
  },
  // ---------------------------------------------------------------------
  // Polaroid — Maya Alvarado, LCSW. Phase 2 port.
  // East Austin · EMDR + IFS + somatic experiencing. Personal voice
  // with a quiet acknowledgment that she's walked the recovery path
  // herself; never performative.
  // ---------------------------------------------------------------------
  polaroid: {
    name: "Maya Alvarado, LCSW",
    credentials: "LCSW · Trauma & Recovery Therapy",
    city: "Austin",
    state: "TX",
    modalities: [
      "EMDR (Eye Movement Desensitization and Reprocessing)",
      "Internal Family Systems (IFS)",
      "Somatic Experiencing",
    ],
    populations: [
      "Women in their 30s and 40s",
      "Survivors of childhood trauma",
      "People in long-term recovery",
    ],
    focus_areas: [
      {
        title: "EMDR for childhood trauma",
        body:
          "Slow, evidence-based reprocessing for memories that still shape the way you move through the day. We build resourcing first, take it one piece at a time, and let the nervous system set the pace.",
      },
      {
        title: "Internal Family Systems (parts work)",
        body:
          "For the part of you that wants to heal and the part that doesn't trust this won't be one more disappointment. We meet both, name them kindly, and let them talk to each other for a change.",
      },
      {
        title: "Body-based therapy",
        body:
          "Trauma lives in the body. Somatic Experiencing helps the body finish what it didn't get to finish — without forcing words onto experiences that don't have any yet.",
      },
    ],
    fees: [
      { label: "15-min consultation", price: "Free" },
      { label: "Individual session (50 min)", price: "$165" },
      { label: "EMDR intensive (90 min)", price: "$260" },
      { label: "Sliding scale (Open Path)", price: "$30–80" },
    ],
    insurance: ["BCBS", "Aetna", "Open Path sliding scale"],
    telehealth: true,
    bio_en:
      "Hi, I'm Maya. I'm a licensed clinical social worker in East Austin, and I work mostly with women in their 30s and 40s — survivors of childhood trauma, people in long-term recovery, and the in-between selves we all become while figuring out which parts to keep. I trained in EMDR, Internal Family Systems, and Somatic Experiencing because the body and the parts both have things to say that words alone can't reach.\n\nI've walked some of this road myself. I don't lead with that, and I don't make sessions about it — but it's part of why I trust the slow, body-based work I do. My office is on the east side, with a back door, plants, and a porch the resident cat sometimes claims. Most of my clients come in person; I keep telehealth open for the weeks when getting out of the house is too much.",
    bio_es:
      "Hola, soy Maya. Soy trabajadora social clínica licenciada en East Austin, y trabajo sobre todo con mujeres en sus 30 y 40 años — sobrevivientes de trauma infantil, personas en recuperación a largo plazo, y los selves intermedios que todas vamos siendo mientras decidimos qué partes conservar. Me formé en EMDR, Sistemas Internos de la Familia y Experiencia Somática porque el cuerpo y las partes tienen cosas que decir que las palabras solas no alcanzan.\n\nHe caminado parte de este camino yo misma. No lo pongo al frente, y no convierto las sesiones en eso — pero es parte de por qué confío en el trabajo lento y corporal que hago. Mi oficina está en el lado este, con puerta trasera, plantas y un porche que la gata residente a veces reclama como suyo. La mayoría de mis pacientes viene en persona; mantengo la telesalud abierta para las semanas en las que salir de casa es demasiado.",
    photo_url: "/images/polaroid-portrait.jpg",
    booking_url: "https://cal.com/maya-alvarado/15min",
    license_number: "TX LCSW 24680",
    photo_alt: {
      en: "Maya Alvarado caught mid-laugh in a cream knit sweater, deep-teal wall with ceramic mugs and houseplants behind",
      es: "Maya Alvarado riéndose con suéter de punto crema, pared turquesa con tazas de cerámica y plantas detrás",
    },
    testimonials: [
      {
        quote_en: "Maya is the first therapist whose office didn't feel like a waiting room. The cat helped. She did more.",
        quote_es: "Maya es la primera terapeuta cuya oficina no se sintió como una sala de espera. La gata ayudó. Ella hizo más.",
        attribution: "EMDR client · Austin",
      },
      {
        quote_en: "She paces the work so I never feel rushed and never feel stuck. Two years in, I still can't quite explain how she does that.",
        quote_es: "Marca el ritmo del trabajo para que nunca me sienta apurada y nunca atascada. A los dos años, aún no sé explicar cómo lo hace.",
        attribution: "Long-term client · East Austin",
      },
      {
        quote_en: "The somatic work was the part I almost skipped. It turned out to be the part that actually changed me.",
        quote_es: "El trabajo somático fue la parte que casi me salté. Resultó ser la parte que de verdad me cambió.",
        attribution: "Trauma-recovery client · Round Rock",
      },
    ],
    office_tour: [
      {
        caption_en: "The back-door porch — a small wooden bench, a hanging fern, the resident cat sometimes asleep on the welcome mat.",
        caption_es: "El porche trasero — un banquito de madera, un helecho colgante, la gata residente a veces dormida sobre el felpudo.",
        description: "Weathered wooden bench on small back porch, hanging Boston fern, terracotta pot with rosemary, friendly orange cat curled on woven welcome mat",
      },
      {
        caption_en: "The therapy room — deep teal walls, two armchairs, a low side table with a clay mug and a small stack of pebbles for resourcing.",
        caption_es: "La sala de terapia — paredes turquesa profundo, dos sillones, una mesita con una taza de barro y unas piedras pulidas para regulación.",
        description: "Deep teal accent wall, two soft armchairs with cream throws, low wooden side table holding clay coffee mug and small bowl of polished river stones",
      },
      {
        caption_en: "The window shelf — a row of mismatched ceramic mugs Maya has collected over the years; clients sometimes pick a different one each visit.",
        caption_es: "La repisa de la ventana — una hilera de tazas de cerámica que Maya ha coleccionado con los años; los pacientes a veces eligen una distinta cada vez.",
        description: "Sunlit windowsill lined with eight to ten handmade ceramic mugs in cream, sage, terracotta, deep teal — each unique, none precious",
      },
    ],
  },
  // ---------------------------------------------------------------------
  // Playful Modern — Dr. Naomi Bellamy, PsyD. Phase 2 port.
  // Online-only across Texas · CBT + ACT + MI for adults 25–40.
  // D2C-brand voice — direct, slightly funny, confident without being
  // clinical (think Hims / Modern Fertility marketing copy).
  // ---------------------------------------------------------------------
  playful_modern: {
    name: "Dr. Naomi Bellamy, PsyD",
    credentials: "PsyD · Licensed Psychologist",
    city: "Austin",
    state: "TX",
    modalities: [
      "Cognitive Behavioral Therapy (CBT)",
      "Acceptance & Commitment Therapy (ACT)",
      "Motivational Interviewing",
    ],
    populations: [
      "Adults 25–40",
      "Anxiety + overthinking",
      "ADHD in adulthood",
      "Perfectionism + identity",
    ],
    focus_areas: [
      {
        title: "Anxiety and overthinking",
        body:
          "If your brain runs Premium Tier All-Day Catastrophizing, you don't need a calmer brain. You need a different relationship with the one you have. We work on that.",
      },
      {
        title: "ADHD in adulthood",
        body:
          "For the people who got the diagnosis at 32 and the explanation at 33. We'll figure out the systems, undo a few decades of self-blame, and stop pretending the productivity hacks were going to fix it.",
      },
      {
        title: "When 'high-functioning' stops working",
        body:
          "Achievement was the load-bearing wall. Now it's not. We do the structural rework — together, on Zoom, in 50-minute blocks that fit on a Tuesday.",
      },
    ],
    fees: [
      { label: "Free 90-second match quiz", price: "Free" },
      { label: "Individual session (50 min)", price: "$220" },
      { label: "Standard package (4 sessions)", price: "$800" },
      { label: "Single intake (75 min)", price: "$300" },
    ],
    insurance: ["BCBS", "Aetna", "Private pay welcome", "HSA/FSA accepted"],
    telehealth: true,
    bio_en:
      "Hi, I'm Naomi. I'm a licensed psychologist (PsyD), and I see adults 25–40 across Texas — online-only, evenings included, no waiting room. My clients tend to be the high-functioning ones nobody worries about, until things get quietly worse and the productivity stack stops doing its job. I work in CBT, ACT, and motivational interviewing, which is the clinical way of saying we'll figure out what you actually want, why your brain keeps voting no, and what to do about it.\n\nI took the online-only route on purpose. Therapy shouldn't require a 45-minute drive across town in traffic to confirm that yes, you do still have anxiety. I keep evening hours, accept BCBS and Aetna, and do a free 90-second match quiz before the first session because the worst version of starting therapy is paying for the wrong therapist.",
    bio_es:
      "Hola, soy Naomi. Soy psicóloga licenciada (PsyD) y atiendo a adultos de 25 a 40 años en todo Texas — solo en línea, con horarios de tarde, sin sala de espera. Mis pacientes suelen ser los high-functioning de los que nadie se preocupa, hasta que las cosas empeoran en silencio y el stack de productividad deja de hacer su trabajo. Trabajo en TCC, ACT y entrevista motivacional, que es la forma clínica de decir que vamos a averiguar qué quieres realmente, por qué tu cerebro vota que no, y qué hacer al respecto.\n\nMe fui al modelo solo en línea a propósito. La terapia no debería requerir 45 minutos de tráfico para confirmar que sí, sigues teniendo ansiedad. Tengo horarios de tarde, acepto BCBS y Aetna, y hago un quiz gratuito de 90 segundos antes de la primera sesión porque la peor versión de empezar terapia es pagar a la terapeuta equivocada.",
    photo_url: "/images/playful_modern-portrait.jpg",
    booking_url: "https://cal.com/naomi-bellamy/match",
    license_number: "TX PSY 55432",
    photo_alt: {
      en: "Dr. Naomi Bellamy in a rust knit sweater, soft confident smile, indigo studio backdrop with warm coral gel light",
      es: "La Dra. Naomi Bellamy con suéter rojizo, sonrisa segura, fondo de estudio índigo con luz coral cálida",
    },
    testimonials: [
      {
        quote_en: "The match quiz saved me a month of trying to figure out if she was The One. She was. We started the next Tuesday.",
        quote_es: "El quiz de match me ahorró un mes intentando averiguar si era la indicada. Lo era. Empezamos el martes siguiente.",
        attribution: "Anxiety client · Austin",
      },
      {
        quote_en: "Naomi makes ADHD sound like a thing my brain does, not a thing I am. After 30 years of the other framing, that's a lot.",
        quote_es: "Naomi hace que el TDAH suene como algo que hace mi cerebro, no como algo que soy. Después de 30 años del otro marco, eso es mucho.",
        attribution: "Late-diagnosis ADHD client · Houston (telehealth)",
      },
      {
        quote_en: "Funny without being a comedian. Direct without being a coach. Actually a therapist. Hard to find.",
        quote_es: "Graciosa sin ser comediante. Directa sin ser coach. Realmente terapeuta. Difícil de encontrar.",
        attribution: "Burnout client · Dallas (telehealth)",
      },
    ],
    office_tour: [
      {
        caption_en: "The home studio — indigo backdrop, a single rust armchair, one warm coral key light. The whole point is that you don't have to come anywhere.",
        caption_es: "El estudio en casa — fondo índigo, un único sillón rojizo, una luz coral cálida. La idea es que no tengas que ir a ningún lado.",
        description: "Clean indigo painted wall, single rust velvet armchair, warm coral-gelled key light, small framed poster reading 'show up as you are' in chunky display type",
      },
      {
        caption_en: "The desk — a notebook, a chunky candle, a 'closed for Tuesday evenings' sticker on the laptop because boundaries are part of the job.",
        caption_es: "El escritorio — una libreta, una vela gruesa, una calcomanía en la laptop que dice 'cerrado los martes en la tarde' porque los límites son parte del trabajo.",
        description: "Small wooden desk with leather notebook, chunky cream candle, laptop with playful sticker, brass desk lamp, ceramic plant",
      },
      {
        caption_en: "The shelf behind the camera — a few books, one framed line of text from a client, no pretending the home isn't a home.",
        caption_es: "El estante detrás de la cámara — unos cuantos libros, una línea enmarcada de un paciente, sin fingir que la casa no es una casa.",
        description: "Open wooden shelf with curated paperbacks, single framed handwritten line from a client, small ceramic figure, warm task lamp",
      },
    ],
  },
  // ---------------------------------------------------------------------
  // Front Porch — Marcus Holloway, LMFT. Phase 3 (new template, port 7).
  // San Antonio (Stone Oak) · Gottman + EFT for couples + families.
  // Texas-rooted, plain-spoken voice; mentions clinical credentials AND
  // lived perspective without making the lived perspective the point.
  // ---------------------------------------------------------------------
  front_porch: {
    name: "Marcus Holloway, LMFT",
    credentials: "LMFT · Gottman Method (Level 3)",
    city: "San Antonio",
    state: "TX",
    modalities: [
      "Gottman Method (Level 3)",
      "Emotionally Focused Therapy (EFT)",
    ],
    populations: [
      "Couples",
      "Families",
      "Couples becoming parents",
      "Blended families",
    ],
    focus_areas: [
      {
        title: "Couples in their first decade",
        body:
          "The years where you've built a life together and started discovering you didn't agree on as much as you thought. We work on what's actually happening underneath the recurring fights — and how to stop having the same one twice.",
      },
      {
        title: "Becoming parents together",
        body:
          "Pregnancy, postpartum, and the early-childhood years rearrange a relationship in ways nobody warns you about. We make space for both of you to land in this new shape without losing each other along the way.",
      },
      {
        title: "Repair after rupture",
        body:
          "Affair recovery, broken trust, the long quiet stretch after a hard year. Repair work is slower than people expect and more possible than people fear. We do it deliberately.",
      },
    ],
    fees: [
      { label: "Free 15-min consultation", price: "Free" },
      { label: "Couples session (60 min)", price: "$220" },
      { label: "Family session (60 min)", price: "$220" },
      { label: "Individual session (50 min)", price: "$180" },
    ],
    insurance: ["BCBS", "Aetna", "United (in-network)", "HSA/FSA accepted"],
    telehealth: true,
    bio_en:
      "I'm Marcus. I'm a licensed marriage and family therapist working with couples and families in San Antonio, and online across Texas. I trained through Level 3 in the Gottman Method and lean on Emotionally Focused Therapy where the work calls for it. Most of what I do is sitting with two or three people in a room — sometimes a whole family — while we figure out what's actually going on underneath the surface fight, the silent stretch, the pattern that keeps repeating.\n\nI grew up in Texas, and I've been on the receiving end of family therapy myself in earlier seasons. I don't lead with that, and I don't make sessions about it — but it's part of why I trust the work, and why I take the long view on couples who feel like they've already failed at this. The first call is fifteen minutes, free, and I won't pitch you. We just see if you want me in the room.",
    bio_es:
      "Soy Marcus. Soy terapeuta licenciado de matrimonio y familia, atiendo parejas y familias en San Antonio y en línea en todo Texas. Me formé hasta Nivel 3 en el Método Gottman y me apoyo en la Terapia Centrada en las Emociones cuando el trabajo lo pide. La mayor parte de lo que hago es sentarme en una sala con dos o tres personas — a veces una familia entera — mientras averiguamos qué está pasando realmente por debajo de la pelea de superficie, del silencio largo, del patrón que se repite.\n\nCrecí en Texas, y yo mismo he estado del otro lado de la terapia familiar en otras temporadas. No lo pongo al frente, y no convierto las sesiones en eso — pero es parte de por qué confío en este trabajo, y por qué tomo la vista larga con parejas que sienten que ya fallaron en esto. La primera llamada son quince minutos, gratis, y no te voy a vender nada. Solo vemos si me quieres en la sala.",
    photo_url: "/images/front_porch-portrait.jpg",
    booking_url: "https://cal.com/marcus-holloway/15min",
    license_number: "TX LMFT 33178",
    photo_alt: {
      en: "Marcus Holloway in a brown henley on a Texas porch at golden hour, warm relaxed smile, weathered rocking chairs behind",
      es: "Marcus Holloway con henley marrón en un porche de Texas al atardecer, sonrisa cálida, mecedoras de madera al fondo",
    },
    testimonials: [
      {
        quote_en: "Marcus is the first person who got both of us to stop performing in the first session. We didn't know we were doing it.",
        quote_es: "Marcus es la primera persona que nos hizo dejar de actuar a los dos en la primera sesión. No sabíamos que lo estábamos haciendo.",
        attribution: "Couple, year nine · Stone Oak",
      },
      {
        quote_en: "We came in to decide if we were getting divorced. We left, ten months later, married in a way we'd never been before.",
        quote_es: "Vinimos para decidir si nos divorciábamos. Salimos, diez meses después, casados de una manera en que nunca lo habíamos estado.",
        attribution: "Couple after rupture · San Antonio",
      },
      {
        quote_en: "Our son did the work alongside us. Marcus made the room feel safe enough for a thirteen-year-old to actually use it.",
        quote_es: "Nuestro hijo hizo el trabajo con nosotros. Marcus hizo que la sala se sintiera segura para que un chico de trece años de verdad la usara.",
        attribution: "Family of four · Boerne",
      },
    ],
    office_tour: [
      {
        caption_en: "The front porch — two rocking chairs and a butter-yellow ceiling, the way Texas porches are supposed to be.",
        caption_es: "El porche de entrada — dos mecedoras y un techo color mantequilla, como deben ser los porches de Texas.",
        description: "Wide Texan front porch, two weathered cedar rocking chairs, butter-yellow painted ceiling, hanging fern, golden-hour light",
      },
      {
        caption_en: "The couples room — a long cedar bench facing two armchairs, a small ceramic pitcher of water always on the side table.",
        caption_es: "La sala de parejas — una banca larga de cedro frente a dos sillones, una jarra de cerámica con agua siempre en la mesita.",
        description: "Cedar-paneled accent wall, long upholstered bench with cream cushions facing two leather armchairs, low cedar table with ceramic water pitcher and two glasses",
      },
      {
        caption_en: "The family room — a low rug, a basket of regulation tools for the youngest in the room, art on the walls that doesn't feel like office art.",
        caption_es: "La sala familiar — una alfombra baja, una canasta con herramientas de regulación para el más joven de la sala, arte en las paredes que no se siente de oficina.",
        description: "Warm woven rug, woven basket of fidget tools and weighted lap pad, framed local Texas landscape paintings, four mismatched soft seats arranged in a loose circle",
      },
    ],
  },
  // ---------------------------------------------------------------------
  // Hello Friend — Sam Castillo (they/them), LPC-A. Phase 3 (new
  // template, port 8). Conversational/Gen-Z voice; queer/ND-affirming
  // sliding-scale practice; the only template in the lineup whose CTA
  // is an intake form rather than a calendar embed.
  // ---------------------------------------------------------------------
  hello_friend: {
    name: "Sam Castillo (they/them)",
    credentials: "LPC-A · Provisionally Licensed",
    city: "Austin",
    state: "TX",
    modalities: [
      "Acceptance & Commitment Therapy (ACT)",
      "Internal Family Systems (IFS)",
      "Narrative Therapy",
      "Neurodivergent-affirming practice",
    ],
    populations: [
      "Queer adults in their 20s and 30s",
      "ADHD diagnosed late",
      "Anxiety + identity exploration",
      "Early-career burnout",
      "Relationship stuff (queer, non-traditional, polyamorous)",
    ],
    focus_areas: [
      {
        title: "Figuring out queer identity in your 20s/30s",
        body:
          "For the people who didn't know yet at 18 and didn't get the language until 26. We make space for what you actually want without ranking your queerness against anyone else's timeline.",
      },
      {
        title: "ADHD that wasn't caught earlier",
        body:
          "If the diagnosis arrived at 32 and the explanation arrived at 33 — we'll undo a decade of being told you were lazy, build systems that fit the brain you have, and stop blaming you for the way it works.",
      },
      {
        title: "Burning out before 30",
        body:
          "The job was supposed to be temporary. The hours weren't supposed to stick. The plan wasn't supposed to be 'survive Monday and start again Tuesday.' We figure out what changes — including the parts of the plan you didn't pick.",
      },
    ],
    fees: [
      { label: "Intake message", price: "Free, always" },
      { label: "Session — sliding scale", price: "$80–$140" },
      { label: "Couples / chosen family session", price: "$100–$160" },
      { label: "Cancellation < 24 hrs", price: "Full session fee" },
    ],
    insurance: [
      "Sliding scale only ($80–$140)",
      "Not in-network with any insurance",
      "Superbills available on request",
    ],
    telehealth: true,
    bio_en:
      "Hi, I'm Sam — LPC-Associate based in Austin, working with adults across Texas, all online. I see mostly queer folks in their 20s and 30s, a lot of ADHD that wasn't caught earlier, and a lot of people whose 'high-functioning' arrangement has stopped functioning. My approach is ACT, IFS, and narrative therapy, which is the clinical way of saying we're going to figure out what you actually want, why your brain keeps voting against it, and what to do about it that doesn't require you becoming a different person first.\n\nThings I won't do: rank your queerness, tell you your ADHD is a discipline problem, recommend a 5am routine, or pretend the system you're tired of isn't real. Things I will do: respond to the intake form within a business day, run a sliding scale ($80–$140) so the work is actually accessible, and tell you up front if I don't think I'm the right fit — y'all deserve a 'no' that comes fast more than a 'maybe' that drags. The first step is the intake form, not a calendar. We start with a conversation.",
    bio_es:
      "Hola, soy Sam — LPC-Associate en Austin, atiendo a adultos en todo Texas, todo en línea. Veo sobre todo a personas queer en sus 20 y 30, mucho TDAH que no se detectó antes, y mucha gente cuyo arreglo 'high-functioning' dejó de funcionar. Mi enfoque es ACT, IFS y terapia narrativa, que es la manera clínica de decir que vamos a averiguar qué quieres realmente, por qué tu cerebro vota en contra, y qué hacer al respecto sin pedirte que primero te conviertas en otra persona.\n\nLo que no voy a hacer: rankear tu queerness, decirte que el TDAH es un problema de disciplina, recomendarte una rutina de las 5 am, o pretender que el sistema que te tiene cansadx no existe. Lo que sí voy a hacer: responder al formulario en un día hábil, sostener una escala reducida ($80–$140) para que el trabajo sea accesible, y decirte de frente si no soy la persona indicada — un 'no' rápido vale más que un 'tal vez' que se alarga. El primer paso es el formulario, no un calendario. Empezamos con una conversación.",
    photo_url: "/images/hello_friend-portrait.jpg",
    booking_url: "/intake/sam",
    license_number: "TX LPC-A 91234",
    photo_alt: {
      en: "Sam Castillo in an indigo beanie and oversized sweater, mid-laugh holding a ceramic mug in a warm sunlit room",
      es: "Sam Castillo con gorro índigo y suéter holgado, riéndose con una taza de cerámica en una sala cálida y soleada",
    },
    testimonials: [
      {
        quote_en: "Sam was the first therapist who didn't make me explain my pronouns and my anxiety in the same breath. The session started where I actually was.",
        quote_es: "Sam fue la primera terapeute que no me hizo explicar mis pronombres y mi ansiedad de un tirón. La sesión empezó donde yo realmente estaba.",
        attribution: "Queer client in late 20s · Austin (telehealth)",
      },
      {
        quote_en: "I got the ADHD diagnosis at 31 and was furious. Sam let me be furious for as long as it took, then we built the systems together.",
        quote_es: "Me diagnosticaron TDAH a los 31 y estaba furiosx. Sam me dejó estar furiosx el tiempo que hizo falta, luego construimos los sistemas juntes.",
        attribution: "Late-diagnosis ADHD client · Houston",
      },
      {
        quote_en: "The sliding scale is the thing that made therapy actually possible for me. The work being good is why I stayed.",
        quote_es: "La escala reducida es lo que hizo que la terapia fuera realmente posible para mí. Que el trabajo sea bueno es por lo que me quedé.",
        attribution: "Sliding-scale client · Dallas",
      },
    ],
    office_tour: [
      {
        caption_en: "The Zoom corner — butter-yellow wall, a chunky knit throw, one good plant. Online-only is the whole practice, on purpose.",
        caption_es: "El rincón de Zoom — pared color mantequilla, una manta tejida gruesa, una buena planta. Solo en línea es toda la práctica, a propósito.",
        description: "Indigo-painted home studio with butter-yellow accent panel, chunky cream knit throw on chair, single tall monstera plant, warm ring light",
      },
      {
        caption_en: "The desk — a row of small pride flags Sam keeps for the clients who told them which ones to add.",
        caption_es: "El escritorio — una hilera de pequeñas banderas del orgullo que Sam guarda gracias a clientes que les dijeron cuáles agregar.",
        description: "Small wooden desk with row of mini pride flags (rainbow, trans, nonbinary, ace, bi), ceramic mug of pens, open notebook, indigo wall behind",
      },
      {
        caption_en: "The shelf — paperback IFS and ACT manuals, a hand-thrown mug from a client who graduated, no clinical posters.",
        caption_es: "El estante — manuales de IFS y ACT en rústica, una taza hecha a mano por une cliente que terminó, sin pósters clínicos.",
        description: "Open shelf with stacked therapy paperbacks, hand-thrown ceramic mug, small framed line drawing, soft sunlight from window left",
      },
    ],
  },
  // ---------------------------------------------------------------------
  // Quiet Practice — Dr. Catherine Whitfield, PhD. Phase 3 (new
  // template, port 9). Psychoanalytic / depth practice; the homepage
  // deliberately has no Services / Reviews / hero image — focus_areas
  // is left empty on purpose. Service info lives at /work, accessible
  // only via a small text link the template renders in its hero.
  // ---------------------------------------------------------------------
  quiet_practice: {
    name: "Dr. Catherine Whitfield, PhD",
    credentials: "PhD · Licensed Psychologist",
    city: "Austin",
    state: "TX",
    modalities: [
      "Psychoanalytic psychotherapy",
      "Twice-weekly psychotherapy",
      "Analytic frequency (3–4x/week) for patients the work calls for",
    ],
    populations: [
      "Adults in long-term depth work",
    ],
    // Empty by design — the Quiet Practice template does not render a
    // Services section on the homepage. Service information lives at
    // /work and is reached via a small text link the template renders
    // beneath the inquiry line. Adding focus_areas here would tempt a
    // future maintainer to surface them; better to leave the array
    // empty so the template stays restrained even under edit drift.
    focus_areas: [],
    fees: [
      { label: "Initial consultation (50 min)", price: "$320" },
      { label: "Twice-weekly psychotherapy (50 min)", price: "$320" },
      { label: "Analytic frequency (50 min, 3–4x/week)", price: "$320" },
    ],
    insurance: [
      "Out-of-network only",
      "Superbills provided",
    ],
    telehealth: true,
    bio_en:
      "Therapy, as I practice it, is the slow work of attending to a life that is asking to be heard. It is not advice. It is not a series of tools. It is a particular kind of conversation, sustained week after week — and, when the work calls for it, several times a week — in which the things that have not yet been said begin to find their language. Most of my patients come to me because the surface arrangement of their life is no longer holding what it was made to hold.\n\nMy training is psychoanalytic. I work in the long form, often over several years, with adults who are willing to listen for what the symptom is actually saying. I see patients in person in Austin; telehealth is available, sparingly, for established patients during the weeks they cannot travel. I do not accept new patients in acute crisis — the work I do requires a different pace, and other clinicians do that earlier work better than I would.",
    bio_es:
      "La terapia, tal como la ejerzo, es el trabajo lento de atender una vida que pide ser escuchada. No es consejo. No es una serie de herramientas. Es una conversación particular, sostenida semana tras semana — y, cuando el trabajo lo pide, varias veces por semana — en la que aquello que aún no ha sido dicho comienza a encontrar su lenguaje. La mayoría de mis pacientes llega cuando el arreglo superficial de su vida ya no contiene lo que estaba hecho para contener.\n\nMi formación es psicoanalítica. Trabajo en el largo plazo, a menudo durante varios años, con adultos dispuestos a escuchar lo que el síntoma realmente está diciendo. Atiendo de manera presencial en Austin; ofrezco telesalud, con moderación, para pacientes establecidos en las semanas en que no pueden trasladarse. No recibo pacientes nuevos en crisis aguda — el trabajo que hago pide un ritmo distinto, y otros clínicos hacen ese trabajo temprano mejor de lo que yo lo haría.",
    photo_url: "",
    booking_url: "/inquire",
    license_number: "TX PSY 27411",
  },
};

function stub(key: string): PersonaProfile {
  return {
    name: `TODO Persona (${key})`,
    credentials: "TODO",
    city: "TODO",
    state: "TX",
    modalities: [],
    populations: [],
    focus_areas: [],
    fees: [],
    insurance: [],
    telehealth: false,
    bio_en: "TODO — populate from Phase 3 persona brief.",
    bio_es: "TODO — completar con el brief de la fase 3.",
    photo_url: "",
    booking_url: "#",
    license_number: "",
  };
}
