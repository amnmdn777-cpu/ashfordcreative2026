import { db, prospectPortals, leads, salesReps } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Renders a portal-specific Open Graph PNG (1200x630). This is the rich
 * link card iMessage / Slack / X / WhatsApp will display when a prospect
 * receives the portal URL.
 *
 * Implementation: satori (HTML/JSX → SVG) + @resvg/resvg-js (SVG → PNG).
 * Both imports are dynamic so a missing package only soft-fails the renderer
 * instead of breaking the whole boot.
 */
export const renderPortalOgPng = async (portalId: number): Promise<Buffer> => {
  const [portal] = await db
    .select()
    .from(prospectPortals)
    .where(eq(prospectPortals.id, portalId))
    .limit(1);
  if (!portal) throw new Error("portal not found");
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, portal.leadId))
    .limit(1);
  if (!lead) throw new Error("lead not found");
  const rep = lead.claimedByRepId
    ? (
        await db
          .select()
          .from(salesReps)
          .where(eq(salesReps.id, lead.claimedByRepId))
          .limit(1)
      )[0] ?? null
    : null;

  const satoriMod = await import("satori");
  const satori = (satoriMod as unknown as { default: typeof import("satori").default }).default ?? (satoriMod as unknown as typeof import("satori").default);
  const resvgMod = await import("@resvg/resvg-js");
  const Resvg = (resvgMod as unknown as { Resvg: typeof import("@resvg/resvg-js").Resvg }).Resvg;

  // Satori needs a font Buffer. Use a shipped Google Fonts call (fetched at
  // boot would be cleaner — for now we fetch on each render and rely on
  // upstream caching). Soft-fail to a system font if unreachable.
  const fontBuffer = await fetchFontWithFallback();

  const repName = rep?.displayName ?? "Ashford Creative";
  const headline = `Prepared for ${lead.name}`;
  const subline = `${lead.practice} · ${lead.city}, ${lead.state}`;

  // Use a plain JSX-like structure (satori accepts a React-like vDOM).
  const node = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #f7f3ec 0%, #efe5d4 100%)",
        padding: "72px",
        fontFamily: "Inter",
        color: "#1a1a14",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              fontSize: "20px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8a6a3f",
              marginBottom: "24px",
            },
            children: "Ashford Creative",
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: "72px",
              lineHeight: 1.05,
              fontWeight: 700,
              marginBottom: "20px",
              maxWidth: "1000px",
            },
            children: headline,
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: "32px",
              color: "#5e503f",
              marginBottom: "auto",
            },
            children: subline,
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "2px solid #d6c8a8",
              paddingTop: "28px",
              fontSize: "26px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { color: "#1a1a14", display: "flex" },
                  children: `Personal site preview from ${repName}`,
                },
              },
              {
                type: "div",
                props: {
                  style: { color: "#8a6a3f", fontWeight: 600, display: "flex" },
                  children: "→ Open",
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(node as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: fontBuffer
      ? [
          {
            name: "Inter",
            data: fontBuffer,
            weight: 700,
            style: "normal",
          },
          {
            name: "Inter",
            data: fontBuffer,
            weight: 400,
            style: "normal",
          },
        ]
      : [],
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
    .render()
    .asPng();
  return Buffer.from(png);
};

/**
 * Fetch an Inter font from a CDN — purely best-effort, returns null on
 * failure so the caller can fall back to default fonts (which satori
 * doesn't actually have built-in, so the render will fail and the OG
 * route will 302 to the static fallback).
 */
let cachedFont: Buffer | null = null;
let fontFetchAttempted = false;
const fetchFontWithFallback = async (): Promise<Buffer | null> => {
  if (cachedFont) return cachedFont;
  if (fontFetchAttempted) return null;
  fontFetchAttempted = true;
  try {
    const res = await fetch(
      "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.woff2",
    );
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    cachedFont = Buffer.from(arr);
    return cachedFont;
  } catch (err) {
    logger.warn({ err }, "ogImage: font fetch failed");
    return null;
  }
};
