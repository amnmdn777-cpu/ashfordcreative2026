import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { WarmBackdrop, Cta } from "./skin";

/**
 * Clarity-specific section components — built for the premium feel and
 * interactivity the shared generic sections can't express: hover-lift
 * cards, an accent underline that draws on hover, staggered scroll
 * reveals, and graceful fallbacks for sparse leads (initials avatar
 * when a team member has no photo). All motion is reduced-motion safe.
 */

interface ServiceItem {
  title: string;
  body: string;
}

interface TeamMember {
  name: string;
  credentials?: string;
  photo?: string;
  bio?: string;
  bio_en?: string;
  bio_es?: string;
  modalities?: string[];
  pronouns?: string;
}

function useMotionPresets() {
  const reduced = useReducedMotion();
  const reveal = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: {
            duration: 0.55,
            ease: [0.16, 1, 0.3, 1] as const,
            delay,
          },
        };
  const hover = reduced ? {} : { whileHover: { y: -6 } };
  return { reduced, reveal, hover };
}

function SectionHead({
  heading,
  subhead,
}: {
  heading: string;
  subhead?: string;
}) {
  const { reveal } = useMotionPresets();
  return (
    <motion.div {...reveal()} className="max-w-2xl mb-12">
      <h2
        className="text-3xl md:text-4xl font-bold tracking-[-0.02em]"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--color-text)",
        }}
      >
        {heading}
      </h2>
      {subhead ? (
        <p
          className="mt-3 text-[15px] leading-relaxed"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {subhead}
        </p>
      ) : null}
    </motion.div>
  );
}

/** Service cards with a coral accent bar that draws in on hover + lift. */
export function ClarityServices({
  id,
  heading,
  subhead,
  items,
}: {
  id?: string;
  heading: string;
  subhead?: string;
  items: ServiceItem[];
}) {
  const { reveal, hover } = useMotionPresets();
  if (!items?.length) return null;
  return (
    <section
      id={id}
      className="scroll-mt-24 mx-auto max-w-6xl px-6 py-16 md:py-24"
    >
      <SectionHead heading={heading} subhead={subhead} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((s, i) => (
          <motion.div
            key={s.title + i}
            {...reveal(Math.min(i * 0.06, 0.3))}
            {...hover}
            className="group relative rounded-2xl p-7 transition-shadow duration-300"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border:
                "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
              boxShadow:
                "0 1px 2px color-mix(in srgb, var(--color-text) 6%, transparent)",
            }}
          >
            <span
              aria-hidden
              className="block h-1 w-8 rounded-full mb-5 transition-all duration-300 group-hover:w-14"
              style={{ backgroundColor: "var(--color-accent)" }}
            />
            <h3
              className="text-lg font-semibold mb-2 tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-text)",
              }}
            >
              {s.title}
            </h3>
            <p
              className="text-[14px] leading-relaxed"
              style={{
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {s.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  const initials = name
    .replace(/^(Dr\.?|Dra\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }
  // Sparse-data fallback: warm initials tile, never a broken image.
  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 28%, transparent), color-mix(in srgb, var(--color-secondary) 60%, transparent))",
      }}
    >
      <span
        className="text-2xl font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--color-text)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}

/** Team / "Meet the team" grid — bio cards with hover-lift. Renders only
 *  when the practice actually has team members (group practices). */
export function ClarityTeam({
  id,
  heading,
  subhead,
  members,
  locale,
}: {
  id?: string;
  heading: string;
  subhead?: string;
  members: TeamMember[];
  locale: "en" | "es";
}) {
  const { reveal, hover } = useMotionPresets();
  if (!members?.length) return null;
  return (
    <section
      id={id}
      className="scroll-mt-24 py-16 md:py-24"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-secondary) 22%, var(--color-surface))",
      }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead heading={heading} subhead={subhead} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((m, i) => {
            const bio = (locale === "es" ? m.bio_es : m.bio_en) || m.bio || "";
            return (
              <motion.div
                key={m.name + i}
                {...reveal(Math.min(i * 0.06, 0.3))}
                {...hover}
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: "var(--color-surface-soft)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                }}
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <Avatar name={m.name} photo={m.photo} />
                </div>
                <div className="p-5">
                  <h3
                    className="text-lg font-semibold tracking-tight"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "var(--color-text)",
                    }}
                  >
                    {m.name}
                  </h3>
                  <p
                    className="text-[12px] uppercase tracking-[0.12em] mt-0.5"
                    style={{
                      color: "var(--color-accent)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {[m.credentials, m.pronouns].filter(Boolean).join(" · ")}
                  </p>
                  {bio ? (
                    <p
                      className="mt-3 text-[14px] leading-relaxed line-clamp-4"
                      style={{
                        color: "var(--color-text-muted)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {bio}
                    </p>
                  ) : null}
                  {m.modalities?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {m.modalities.slice(0, 4).map((mod) => (
                        <span
                          key={mod}
                          className="text-[11px] px-2.5 py-1 rounded-full"
                          style={{
                            border:
                              "1px solid color-mix(in srgb, var(--color-text) 14%, transparent)",
                            color: "var(--color-text-muted)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Stats band ─────────────────────────── */

/** Count-up that runs once when scrolled into view (instant under reduced motion). */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(reduced ? to : 0);
  const started = useRef(false);
  const run = () => {
    if (started.current) return;
    started.current = true;
    if (reduced) return;
    const dur = 1200;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  return (
    <motion.span
      onViewportEnter={run}
      viewport={{ once: true, margin: "-40px" }}
    >
      {val}
      {suffix}
    </motion.span>
  );
}

export interface ClarityStat {
  to: number;
  suffix?: string;
  label: string;
}

/** Lively stats band — count-up figures on a soft tinted strip. */
export function ClarityStats({ items }: { items: ClarityStat[] }) {
  const { reveal } = useMotionPresets();
  if (!items?.length) return null;
  return (
    <section
      className="py-14 md:py-16"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-secondary) 26%, var(--color-surface))",
        borderTop:
          "1px solid color-mix(in srgb, var(--color-text) 6%, transparent)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-text) 6%, transparent)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {items.map((s, i) => (
          <motion.div
            key={s.label}
            {...reveal(i * 0.08)}
            className="text-center md:text-left"
          >
            <div
              className="text-4xl md:text-5xl font-bold tracking-[-0.02em]"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-text)",
              }}
            >
              <CountUp to={s.to} suffix={s.suffix} />
            </div>
            <div
              className="mt-1.5 text-[13px]"
              style={{
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── Video intro ─────────────────────────── */

/** Designed "watch the intro" section — a warm framed panel with a play
 *  button. `videoUrl` opens in a new tab when present; otherwise it's a
 *  styled placeholder the rep can wire to the practice's real intro clip. */
export function ClarityVideo({
  id,
  heading,
  subhead,
  caption,
  videoUrl,
  poster,
}: {
  id?: string;
  heading: string;
  subhead?: string;
  caption: string;
  videoUrl?: string;
  poster?: string;
}) {
  const { reveal } = useMotionPresets();
  return (
    <section
      id={id}
      className="scroll-mt-24 mx-auto max-w-6xl px-6 py-16 md:py-24"
    >
      <SectionHead heading={heading} subhead={subhead} />
      <motion.a
        {...reveal()}
        href={videoUrl || undefined}
        target={videoUrl ? "_blank" : undefined}
        rel={videoUrl ? "noreferrer" : undefined}
        className="group relative block rounded-3xl overflow-hidden aspect-[16/9]"
        style={{
          background: poster
            ? undefined
            : "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 26%, var(--color-surface-soft)), color-mix(in srgb, var(--color-secondary) 70%, var(--color-surface-soft)))",
        }}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="flex items-center justify-center h-20 w-20 rounded-full transition-transform duration-300 group-hover:scale-110"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 10px 30px -8px rgba(0,0,0,0.35)",
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              aria-hidden
              style={{ color: "var(--color-text)" }}
            >
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        </div>
        <span
          className="absolute bottom-0 inset-x-0 p-5 md:p-6 text-white text-lg md:text-xl font-semibold"
          style={{
            fontFamily: "var(--font-display)",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.45), transparent)",
          }}
        >
          {caption}
        </span>
      </motion.a>
    </section>
  );
}

/* ─────────────────────────── Location / map ─────────────────────────── */

interface HourLine {
  day: string;
  open: string;
}

/** Premium location section — a framed live Google map (keyless embed)
 *  beside an address + hours + actions card. Replaces the generic map. */
export function ClarityLocation({
  id,
  heading,
  address,
  hours,
  phone,
  labels,
}: {
  id?: string;
  heading: string;
  address: string;
  hours?: HourLine[];
  phone?: string;
  labels: { eyebrow: string; hours: string; call: string; directions: string };
}) {
  const { reveal } = useMotionPresets();
  if (!address) return null;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return (
    <section
      id={id}
      className="scroll-mt-24 mx-auto max-w-6xl px-6 py-16 md:py-24"
    >
      <div className="grid md:grid-cols-2 gap-8 items-stretch">
        <motion.div
          {...reveal()}
          className="rounded-3xl overflow-hidden min-h-[320px]"
          style={{
            border:
              "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
          }}
        >
          <iframe
            title={heading}
            src={mapSrc}
            loading="lazy"
            className="w-full h-full min-h-[320px] border-0"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </motion.div>

        <motion.div
          {...reveal(0.1)}
          className="rounded-3xl p-8 md:p-10 flex flex-col"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border:
              "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
          }}
        >
          <p
            className="text-[12px] uppercase tracking-[0.18em] mb-2"
            style={{
              color: "var(--color-accent)",
              fontFamily: "var(--font-body)",
            }}
          >
            {labels.eyebrow}
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-[-0.02em] mb-4"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text)",
            }}
          >
            {heading}
          </h2>
          <p
            className="text-[15px] leading-relaxed mb-6"
            style={{
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            {address}
          </p>

          {hours?.length ? (
            <div className="mb-6">
              <p
                className="text-[12px] uppercase tracking-[0.14em] mb-3"
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {labels.hours}
              </p>
              <ul className="space-y-1.5">
                {hours.slice(0, 5).map((h) => (
                  <li
                    key={h.day}
                    className="flex justify-between text-[14px]"
                    style={{
                      color: "var(--color-text)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <span>{h.day}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {h.open}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-3 pt-2">
            {phone ? (
              <a
                href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
                className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium"
                style={{
                  backgroundColor: "var(--color-text)",
                  color: "var(--color-surface)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {labels.call} {phone}
              </a>
            ) : null}
            <a
              href={dirHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium"
              style={{
                border:
                  "1px solid color-mix(in srgb, var(--color-text) 18%, transparent)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
              }}
            >
              {labels.directions}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Blog index ─────────────────────────── */

interface BlogPost {
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readMins: number;
}

const BLOG_POSTS_EN: BlogPost[] = [
  {
    title: "Why your nervous system thinks a deadline is a bear",
    excerpt:
      "A short primer on the stress response — and three things that actually bring it down in the moment. (None of them are “just breathe.”)",
    category: "Anxiety",
    date: "Apr 2026",
    readMins: 5,
  },
  {
    title: "What a first session is really like",
    excerpt:
      "We walk through exactly what happens in your first 50 minutes, so the unknown feels a little less unknown before you ever book.",
    category: "Getting started",
    date: "Mar 2026",
    readMins: 4,
  },
  {
    title: "EMDR, explained without the jargon",
    excerpt:
      "One of our trauma specialists breaks down how reprocessing works, who it tends to help most, and what a session actually feels like.",
    category: "Trauma",
    date: "Mar 2026",
    readMins: 6,
  },
  {
    title: "Couples: the four-minute check-in",
    excerpt:
      "A simple weekly ritual that heads off most of the fights that send couples to our door in the first place.",
    category: "Relationships",
    date: "Feb 2026",
    readMins: 3,
  },
  {
    title: "The myth of “just relax”",
    excerpt:
      "Why willpower rarely calms an anxious body — and what the research says actually does.",
    category: "Anxiety",
    date: "Feb 2026",
    readMins: 5,
  },
  {
    title: "Sleep, stress, and the 3am spiral",
    excerpt:
      "If your brain saves its worst worries for the middle of the night, here's what's happening — and a plan that helps.",
    category: "Wellbeing",
    date: "Jan 2026",
    readMins: 4,
  },
];

const BLOG_POSTS_ES: BlogPost[] = [
  {
    title: "Por qué tu sistema nervioso cree que una fecha límite es un oso",
    excerpt:
      "Una breve guía sobre la respuesta al estrés — y tres cosas que de verdad la calman en el momento. (Ninguna es “solo respira”.)",
    category: "Ansiedad",
    date: "Abr 2026",
    readMins: 5,
  },
  {
    title: "Cómo es realmente una primera sesión",
    excerpt:
      "Te contamos exactamente qué pasa en tus primeros 50 minutos, para que lo desconocido se sienta un poco menos desconocido.",
    category: "Para empezar",
    date: "Mar 2026",
    readMins: 4,
  },
  {
    title: "EMDR, explicado sin tecnicismos",
    excerpt:
      "Una de nuestras especialistas en trauma explica cómo funciona el reprocesamiento y a quién suele ayudar más.",
    category: "Trauma",
    date: "Mar 2026",
    readMins: 6,
  },
  {
    title: "Parejas: el chequeo de cuatro minutos",
    excerpt:
      "Un ritual semanal sencillo que evita la mayoría de las discusiones que traen a las parejas a nuestra puerta.",
    category: "Relaciones",
    date: "Feb 2026",
    readMins: 3,
  },
  {
    title: "El mito de “solo relájate”",
    excerpt:
      "Por qué la fuerza de voluntad rara vez calma un cuerpo ansioso — y qué dice la investigación que sí funciona.",
    category: "Ansiedad",
    date: "Feb 2026",
    readMins: 5,
  },
  {
    title: "Sueño, estrés y la espiral de las 3am",
    excerpt:
      "Si tu mente guarda sus peores preocupaciones para la madrugada, esto es lo que pasa — y un plan que ayuda.",
    category: "Bienestar",
    date: "Ene 2026",
    readMins: 4,
  },
];

const POST_GRADIENTS = [
  "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 34%, var(--color-surface-soft)), color-mix(in srgb, var(--color-secondary) 60%, var(--color-surface-soft)))",
  "linear-gradient(135deg, color-mix(in srgb, var(--color-secondary) 70%, var(--color-surface-soft)), color-mix(in srgb, var(--color-accent) 22%, var(--color-surface-soft)))",
  "linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 26%, var(--color-surface-soft)), color-mix(in srgb, var(--color-secondary) 55%, var(--color-surface-soft)))",
];

/** Blog index — a grid of post cards with warm gradient thumbnails,
 *  category chip, excerpt, and meta. Self-contained sample posts for the
 *  showcase; on a real portal these map to the prospect's crawled blog. */
export function ClarityBlog({
  heading,
  subhead,
  locale,
  readLabel,
}: {
  heading: string;
  subhead?: string;
  locale: "en" | "es";
  readLabel: string;
}) {
  const { reveal, hover } = useMotionPresets();
  const posts = locale === "es" ? BLOG_POSTS_ES : BLOG_POSTS_EN;
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <SectionHead heading={heading} subhead={subhead} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
        {posts.map((p, i) => (
          <motion.a
            key={p.title}
            href="#"
            onClick={(e) => e.preventDefault()}
            {...reveal(Math.min(i * 0.06, 0.3))}
            {...hover}
            className="group block rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border:
                "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
            }}
          >
            <div
              className="relative aspect-[16/10]"
              style={{ background: POST_GRADIENTS[i % POST_GRADIENTS.length] }}
            >
              <span
                className="absolute top-4 left-4 text-[11px] uppercase tracking-[0.12em] px-3 py-1 rounded-full"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--color-surface-soft) 85%, transparent)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {p.category}
              </span>
            </div>
            <div className="p-6">
              <h3
                className="text-lg font-semibold tracking-tight leading-snug transition-colors"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text)",
                }}
              >
                {p.title}
              </h3>
              <p
                className="mt-2 text-[14px] leading-relaxed line-clamp-3"
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {p.excerpt}
              </p>
              <p
                className="mt-4 text-[12px]"
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {p.date} · {p.readMins} {readLabel}
              </p>
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────── Sub-page building blocks ───────────────────── */

/** Page header for sub-pages — eyebrow + oversized title + intro, over the
 *  signature warm backdrop so a sub-page opens as richly as the homepage. */
export function ClarityPageHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  const { reveal } = useMotionPresets();
  return (
    <section className="relative overflow-hidden">
      <WarmBackdrop />
      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-20 md:pb-14">
        <motion.p
          {...reveal()}
          className="inline-block text-[12px] uppercase tracking-[0.18em] px-3 py-1 rounded-full mb-5"
          style={{
            color: "var(--color-accent)",
            border:
              "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
            fontFamily: "var(--font-body)",
          }}
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          {...reveal(0.05)}
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.02em] leading-[1.05]"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          {title}
        </motion.h1>
        {intro ? (
          <motion.p
            {...reveal(0.12)}
            className="mt-5 max-w-2xl text-[16px] leading-relaxed"
            style={{
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            {intro}
          </motion.p>
        ) : null}
      </div>
    </section>
  );
}

/** Readable prose column for About / legal copy — first paragraph lifted. */
export function ClarityProse({ paragraphs }: { paragraphs: string[] }) {
  const { reveal } = useMotionPresets();
  if (!paragraphs?.length) return null;
  return (
    <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {paragraphs.map((p, i) => (
        <motion.p
          key={i}
          {...reveal(Math.min(i * 0.05, 0.2))}
          className={`leading-relaxed ${i === 0 ? "text-[19px] md:text-[21px] mb-6" : "text-[16px] mb-5"}`}
          style={{
            color: i === 0 ? "var(--color-text)" : "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {p}
        </motion.p>
      ))}
    </section>
  );
}

/** Three value cards (About) — numbered, accent-led. */
export function ClarityValueCards({
  heading,
  items,
}: {
  heading: string;
  items: { title: string; body: string }[];
}) {
  const { reveal, hover } = useMotionPresets();
  if (!items?.length) return null;
  return (
    <section
      className="py-16 md:py-20"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-secondary) 20%, var(--color-surface))",
      }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead heading={heading} />
        <div className="grid sm:grid-cols-3 gap-6">
          {items.map((v, i) => (
            <motion.div
              key={v.title}
              {...reveal(i * 0.08)}
              {...hover}
              className="rounded-2xl p-7"
              style={{
                backgroundColor: "var(--color-surface-soft)",
                border:
                  "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
              }}
            >
              <span
                className="block text-3xl font-bold mb-3"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-accent)",
                }}
              >
                0{i + 1}
              </span>
              <h3
                className="text-lg font-semibold mb-2 tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text)",
                }}
              >
                {v.title}
              </h3>
              <p
                className="text-[14px] leading-relaxed"
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {v.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "How it works" 3-step band (Services). */
export function ClarityProcess({
  heading,
  steps,
}: {
  heading: string;
  steps: { title: string; body: string }[];
}) {
  const { reveal } = useMotionPresets();
  if (!steps?.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <SectionHead heading={heading} />
      <div className="grid sm:grid-cols-3 gap-8">
        {steps.map((s, i) => (
          <motion.div key={s.title} {...reveal(i * 0.08)}>
            <div
              className="flex items-center justify-center h-12 w-12 rounded-full mb-4 text-lg font-bold"
              style={{
                backgroundColor: "var(--color-text)",
                color: "var(--color-surface)",
                fontFamily: "var(--font-display)",
              }}
            >
              {i + 1}
            </div>
            <h3
              className="text-lg font-semibold mb-2 tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--color-text)",
              }}
            >
              {s.title}
            </h3>
            <p
              className="text-[14px] leading-relaxed"
              style={{
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {s.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/** Closing CTA band reused at the foot of every sub-page. */
export function ClarityCtaBand({
  heading,
  subhead,
  ctaLabel,
  ctaHref,
}: {
  heading: string;
  subhead?: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const { reveal } = useMotionPresets();
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <motion.div
        {...reveal()}
        className="rounded-3xl px-8 py-12 md:px-12 md:py-16 text-center"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 20%, var(--color-surface-soft)), color-mix(in srgb, var(--color-secondary) 60%, var(--color-surface-soft)))",
        }}
      >
        <h2
          className="text-3xl md:text-4xl font-bold tracking-[-0.02em]"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          {heading}
        </h2>
        {subhead ? (
          <p
            className="mt-3 max-w-xl mx-auto text-[15px] leading-relaxed"
            style={{
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            {subhead}
          </p>
        ) : null}
        <div className="mt-7">
          <Cta href={ctaHref} size="lg">
            {ctaLabel}
          </Cta>
        </div>
      </motion.div>
    </section>
  );
}

/* ───────────────────── Additional homepage elements ───────────────────── */

/** Thin top announcement strip (e.g. "Now accepting new clients"). */
export function ClarityAnnouncementBar({
  text,
  ctaLabel,
  ctaHref,
}: {
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div
      className="w-full text-center text-[13px] py-2 px-4"
      style={{
        backgroundColor: "var(--color-text)",
        color: "var(--color-surface)",
        fontFamily: "var(--font-body)",
      }}
    >
      {text}
      {ctaLabel && ctaHref ? (
        <a
          href={ctaHref}
          className="underline underline-offset-2 ml-2 font-medium"
        >
          {ctaLabel}
        </a>
      ) : null}
    </div>
  );
}

/** Trust band — in-network / accepted insurance + credentials, as chips. */
export function ClarityTrustBand({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  if (!items?.length) return null;
  return (
    <section
      className="py-8"
      style={{
        borderTop:
          "1px solid color-mix(in srgb, var(--color-text) 7%, transparent)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-text) 7%, transparent)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
        <span
          className="text-[12px] uppercase tracking-[0.16em]"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {label}
        </span>
        {items.map((it) => (
          <span
            key={it}
            className="text-[14px] font-medium"
            style={{
              color: "var(--color-text)",
              fontFamily: "var(--font-display)",
            }}
          >
            {it}
          </span>
        ))}
      </div>
    </section>
  );
}

const Check = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden
    style={{ color: "var(--color-accent)" }}
  >
    <path
      d="M20 6L9 17l-5-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** "What we treat" — a grid of specialty chips with check marks. */
export function ClaritySpecialties({
  heading,
  subhead,
  items,
}: {
  heading: string;
  subhead?: string;
  items: string[];
}) {
  const { reveal } = useMotionPresets();
  if (!items?.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <SectionHead heading={heading} subhead={subhead} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((it, i) => (
          <motion.div
            key={it}
            {...reveal(Math.min(i * 0.04, 0.3))}
            className="flex items-center gap-2.5 rounded-xl px-4 py-3"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border:
                "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
            }}
          >
            <Check />
            <span
              className="text-[14px]"
              style={{
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
              }}
            >
              {it}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/** Approach / modalities — name + plain-language description rows. */
export function ClarityApproach({
  heading,
  subhead,
  items,
}: {
  heading: string;
  subhead?: string;
  items: { name: string; body: string }[];
}) {
  const { reveal } = useMotionPresets();
  if (!items?.length) return null;
  return (
    <section
      className="py-16 md:py-24"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-secondary) 18%, var(--color-surface))",
      }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead heading={heading} subhead={subhead} />
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
          {items.map((m, i) => (
            <motion.div
              key={m.name}
              {...reveal(Math.min(i * 0.06, 0.3))}
              className="flex gap-4"
            >
              <span
                aria-hidden
                className="mt-2 h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
              <div>
                <h3
                  className="text-lg font-semibold tracking-tight mb-1"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--color-text)",
                  }}
                >
                  {m.name}
                </h3>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {m.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Large featured pull-quote testimonial. */
export function ClarityTestimonialSpotlight({
  quote,
  author,
  source,
}: {
  quote: string;
  author: string;
  source?: string;
}) {
  const { reveal } = useMotionPresets();
  if (!quote) return null;
  return (
    <section className="mx-auto max-w-4xl px-6 py-16 md:py-24 text-center">
      <motion.div {...reveal()}>
        <span
          aria-hidden
          className="block text-6xl leading-none mb-4"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-accent)",
          }}
        >
          “
        </span>
        <p
          className="text-2xl md:text-3xl leading-snug font-medium tracking-[-0.01em]"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          {quote}
        </p>
        <p
          className="mt-6 text-[14px]"
          style={{
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          — {author}
          {source ? ` · ${source}` : ""}
        </p>
      </motion.div>
    </section>
  );
}

/** Newsletter / email capture band (demo — no real submit). */
export function ClarityNewsletter({
  heading,
  subhead,
  placeholder,
  button,
}: {
  heading: string;
  subhead?: string;
  placeholder: string;
  button: string;
}) {
  const { reveal } = useMotionPresets();
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <motion.div
        {...reveal()}
        className="rounded-3xl px-8 py-10 md:px-12 md:py-12 md:flex md:items-center md:justify-between gap-8"
        style={{
          backgroundColor: "var(--color-surface-soft)",
          border:
            "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
        }}
      >
        <div className="md:max-w-md mb-6 md:mb-0">
          <h2
            className="text-2xl md:text-3xl font-bold tracking-[-0.02em]"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text)",
            }}
          >
            {heading}
          </h2>
          {subhead ? (
            <p
              className="mt-2 text-[15px] leading-relaxed"
              style={{
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {subhead}
            </p>
          ) : null}
        </div>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex gap-2 md:shrink-0"
        >
          <input
            type="email"
            placeholder={placeholder}
            className="rounded-full px-5 py-3 text-sm outline-none w-full md:w-64"
            style={{
              backgroundColor: "var(--color-surface)",
              border:
                "1px solid color-mix(in srgb, var(--color-text) 14%, transparent)",
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
            }}
          />
          <button
            type="submit"
            className="rounded-full px-6 py-3 text-sm font-medium shrink-0"
            style={{
              backgroundColor: "var(--color-text)",
              color: "var(--color-surface)",
              fontFamily: "var(--font-body)",
            }}
          >
            {button}
          </button>
        </form>
      </motion.div>
    </section>
  );
}

/** Rich multi-column footer — brand, quick links, contact, hours. */
export function ClarityFooter({
  name,
  tagline,
  navItems,
  contact,
  hours,
  columns,
  signature,
  onNavigate,
}: {
  name: string;
  tagline?: string;
  navItems: { label: string; href: string }[];
  contact: { phone?: string; email?: string; address?: string };
  hours?: { day: string; open: string }[];
  columns: { links: string; contact: string; hours: string };
  signature: string;
  onNavigate?: (path: string) => void;
}) {
  return (
    <footer
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-text) 96%, var(--color-accent))",
        color: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-1">
          <div
            className="text-lg font-semibold tracking-tight mb-3"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--color-surface)",
            }}
          >
            {name}
          </div>
          {tagline ? (
            <p
              className="text-[14px] leading-relaxed opacity-80"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {tagline}
            </p>
          ) : null}
        </div>

        <div>
          <h4
            className="text-[12px] uppercase tracking-[0.16em] mb-4 opacity-70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {columns.links}
          </h4>
          <ul className="space-y-2.5">
            {navItems.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={
                    n.href.startsWith("/") && onNavigate
                      ? (e) => {
                          e.preventDefault();
                          onNavigate(n.href);
                        }
                      : undefined
                  }
                  className="text-[14px] opacity-85 hover:opacity-100 transition-opacity"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4
            className="text-[12px] uppercase tracking-[0.16em] mb-4 opacity-70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {columns.contact}
          </h4>
          <ul
            className="space-y-2.5 text-[14px] opacity-85"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {contact.phone ? <li>{contact.phone}</li> : null}
            {contact.email ? <li>{contact.email}</li> : null}
            {contact.address ? (
              <li className="leading-relaxed">{contact.address}</li>
            ) : null}
          </ul>
        </div>

        <div>
          <h4
            className="text-[12px] uppercase tracking-[0.16em] mb-4 opacity-70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {columns.hours}
          </h4>
          <ul
            className="space-y-1.5 text-[14px] opacity-85"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {(hours ?? []).slice(0, 5).map((h) => (
              <li key={h.day} className="flex justify-between gap-4">
                <span>{h.day}</span>
                <span className="opacity-70">{h.open}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="border-t"
        style={{
          borderColor:
            "color-mix(in srgb, var(--color-surface) 16%, transparent)",
        }}
      >
        <div
          className="mx-auto max-w-6xl px-6 py-5 text-[12px] opacity-70"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {signature}
        </div>
      </div>
    </footer>
  );
}
