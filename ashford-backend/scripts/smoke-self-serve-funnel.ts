import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { leads, sales, funnelEvents } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const API = process.env.SMOKE_API ?? "http://localhost:80";

async function post(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r;
}

async function main() {
  const sessionId = `smoke-${randomUUID()}`;
  const email = `smoke+${Date.now()}@example.test`;
  const slug = "clinic";

  console.log(`[smoke] sessionId=${sessionId}`);

  const single = await post("/api/public/funnel-events", {
    sessionId,
    event: "template_view",
    slug,
  });
  console.log(`[smoke] single funnel event status=${single.status}`);
  if (single.status !== 204) throw new Error("expected 204");

  const batch = await post("/api/public/funnel-events", {
    sessionId,
    events: [
      { event: "template_pick", slug },
      { event: "palette_pick", slug, payload: { paletteIdx: 1 } },
      { event: "addon_toggle", slug, payload: { addon: "cms", enabled: true } },
      { event: "domain_claim", slug },
      { event: "reserve_open", slug },
      { event: "reserve_submit", slug },
    ],
  });
  console.log(`[smoke] batched funnel events status=${batch.status}`);
  if (batch.status !== 204) throw new Error("expected 204");

  const rows = await db
    .select({ event: funnelEvents.event })
    .from(funnelEvents)
    .where(eq(funnelEvents.sessionId, sessionId));
  console.log(
    `[smoke] persisted events: ${rows.map((r) => r.event).join(",")}`,
  );
  if (rows.length < 7) throw new Error(`expected >=7 events, got ${rows.length}`);

  const fakeCheckout = {
    id: `evt_smoke_${Date.now()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_smoke_${Date.now()}`,
        mode: "subscription",
        customer_details: { email, name: "Smoke Tester" },
        customer_email: email,
        subscription: `sub_smoke_${Date.now()}`,
        amount_total: 19900,
        currency: "usd",
        metadata: {
          source: "self_serve_template",
          templateKey: slug,
          paletteKey: "warm-clay",
          addonKeys: "cms,blog",
          chosenDomain: "smoke.test",
          funnelSessionId: sessionId,
        },
      },
    },
  };

  const { handleStripeEvent } = await import(
    "../src/services/stripeWebhook.js"
  );
  await handleStripeEvent(fakeCheckout as never);

  const lead = await db
    .select()
    .from(leads)
    .where(eq(leads.email, email))
    .limit(1);
  if (!lead.length) throw new Error("lead not synthesized");
  console.log(
    `[smoke] lead id=${lead[0].id} source=${lead[0].source} status=${lead[0].status}`,
  );
  if (lead[0].source !== "self_serve_template")
    throw new Error("source mismatch");

  const meta = lead[0].selfServeMeta as Record<string, unknown> | null;
  if (!meta) throw new Error("selfServeMeta missing");
  if (meta.funnelSessionId !== sessionId)
    throw new Error("funnelSessionId not stitched");
  if (meta.templateKey !== slug)
    throw new Error(`templateKey mismatch: ${String(meta.templateKey)}`);
  if (meta.paletteKey !== "warm-clay")
    throw new Error(`paletteKey mismatch: ${String(meta.paletteKey)}`);
  const addons = Array.isArray(meta.addons) ? meta.addons : [];
  if (!addons.includes("cms") || !addons.includes("blog"))
    throw new Error(`addons missing cms/blog: ${JSON.stringify(addons)}`);
  if (meta.chosenDomain !== "smoke.test")
    throw new Error(`chosenDomain mismatch: ${String(meta.chosenDomain)}`);
  console.log(`[smoke] selfServeMeta=${JSON.stringify(meta)}`);

  await handleStripeEvent(fakeCheckout as never);
  const after = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.email, email));
  if (after[0].c !== 1) throw new Error("idempotency violated");
  console.log("[smoke] idempotent re-run OK");

  await db.delete(sales).where(eq(sales.leadId, lead[0].id));
  await db.delete(leads).where(eq(leads.email, email));
  await db.delete(funnelEvents).where(eq(funnelEvents.sessionId, sessionId));
  console.log("[smoke] cleanup done — PASS");
}

main().catch((e) => {
  console.error("[smoke] FAIL", e);
  process.exit(1);
});
