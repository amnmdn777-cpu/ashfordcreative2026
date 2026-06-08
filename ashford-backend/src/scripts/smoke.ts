// Smoke test — boots the app on a local port and exercises the happy path.
// Usage: pnpm --filter @workspace/api-server test:smoke

import {
  pool,
  db,
  salesReps,
  leads,
  // 2026-05-21 — `onboardingAcknowledgments` table dropped (rep training gate killed).
  customDevQuotes,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import {
  synthesizeDevCheckout,
  synthesizeDevQuotePayment,
} from "../services/stripeWebhook";

const PORT = Number(process.env.SMOKE_PORT ?? 4567);

const COOKIE_HEADER = "cookie";

async function main() {
  const server = app.listen(PORT);
  await new Promise((r) => server.on("listening", r));
  const base = `http://localhost:${PORT}/api`;
  let pass = 0;
  let fail = 0;

  const expect = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.error(`  FAIL  ${name}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  };

  let sessionCookie = "";

  // Reset rep1's onboarding state so the gate test is meaningful across re-runs.
  const [rep1] = await db
    .select()
    .from(salesReps)
    .where(eq(salesReps.username, "rep1"))
    .limit(1);
  if (rep1) {
    // 2026-05-21 — `onboardingAcknowledgments` table + `hasCompletedOnboarding`
    // column dropped (rep training gate killed, Sprint 2 streamline).
    await db
      .update(leads)
      .set({ claimedByRepId: null, claimedAt: null, status: "available" })
      .where(eq(leads.claimedByRepId, rep1.id));
  }

  await expect("GET /healthz", async () => {
    const r = await fetch(`${base}/healthz`);
    if (r.status !== 200) throw new Error(`status=${r.status}`);
    const json = (await r.json()) as { status: string };
    if (json.status !== "ok") throw new Error(`bad status: ${JSON.stringify(json)}`);
  });

  await expect("GET /public/pricing", async () => {
    const r = await fetch(`${base}/public/pricing`);
    if (r.status !== 200) throw new Error(`status=${r.status}`);
    const json = (await r.json()) as {
      plans: unknown[];
      addons: unknown[];
      packs: unknown[];
    };
    if (json.plans.length !== 2)
      throw new Error(`expected 2 plans got ${json.plans.length}`);
    if (json.addons.length !== 8)
      throw new Error(`expected 8 addons got ${json.addons.length}`);
    // Add-on packs were retired April 2026; the catalog now returns an
    // empty packs array. Keep the field shape in case it's restored later.
    if (json.packs.length !== 0)
      throw new Error(`expected 0 packs (retired) got ${json.packs.length}`);
  });

  await expect("GET /public/templates", async () => {
    const r = await fetch(`${base}/public/templates`);
    const json = (await r.json()) as {
      templates: unknown[];
      palettes: unknown[];
    };
    if (json.templates.length !== 6)
      throw new Error(`expected 6 templates got ${json.templates.length}`);
  });

  // Catalog 2.0 (April 28, 2026) — `ai_quiz` was retired; we now smoke-test
  // the same pricing-quote round-trip with a current add-on. `online_booking`
  // is a $20/mo client-angle add-on, so Plan A ($199) + booking ($20) = $219.
  await expect("POST /public/pricing/quote (Plan A + online_booking)", async () => {
    const r = await fetch(`${base}/public/pricing/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planKey: "A",
        selectedAddons: ["online_booking"],
      }),
    });
    const json = (await r.json()) as {
      monthlyTotalCents: number;
      setupCents: number;
    };
    if (json.monthlyTotalCents !== 21900)
      throw new Error(`expected 21900 (199 + 20) got ${json.monthlyTotalCents}`);
  });

  await expect("GET /public/blog returns 8 seeded posts", async () => {
    const r = await fetch(`${base}/public/blog`);
    const json = (await r.json()) as { posts: { slug: string }[] };
    if (json.posts.length < 8)
      throw new Error(`expected >=8 blog posts, got ${json.posts.length}`);
  });

  await expect("POST /auth/login (rep1 / ashford2026)", async () => {
    const r = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "rep1", password: "Ashford2026" }),
    });
    if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
    const setCookie = r.headers.get("set-cookie");
    if (!setCookie) throw new Error("no set-cookie");
    sessionCookie = setCookie.split(";")[0];
  });

  await expect("GET /auth/me with session", async () => {
    const r = await fetch(`${base}/auth/me`, {
      headers: { [COOKIE_HEADER]: sessionCookie },
    });
    if (r.status !== 200) throw new Error(`status=${r.status}`);
    const json = (await r.json()) as {
      user: { username: string };
    };
    if (json.user.username !== "rep1") throw new Error("wrong user");
  });

  // 2026-05-21 — Onboarding gate + sections + acknowledge smoke tests
  // removed (rep training gate killed, Sprint 2 streamline).

  let firstLeadId = 0;

  await expect("GET /dashboard/leads/available now allowed", async () => {
    const r = await fetch(`${base}/dashboard/leads/available`, {
      headers: { [COOKIE_HEADER]: sessionCookie },
    });
    if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as {
      leads: { id: number }[];
      claimsRemainingToday: number;
    };
    if (json.leads.length === 0)
      throw new Error("no available leads (did seed run?)");
    firstLeadId = json.leads[0].id;
    if (json.claimsRemainingToday <= 0)
      throw new Error(`expected positive claimsRemainingToday sentinel, got ${json.claimsRemainingToday}`);
  });

  await expect("POST /dashboard/leads/:id/claim succeeds", async () => {
    const r = await fetch(`${base}/dashboard/leads/${firstLeadId}/claim`, {
      method: "POST",
      headers: { [COOKIE_HEADER]: sessionCookie },
    });
    if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as {
      lead: { status: string };
      claimsRemainingToday: number;
    };
    if (json.lead.status !== "claimed")
      throw new Error(`bad status ${json.lead.status}`);
    if (json.claimsRemainingToday <= 0)
      throw new Error(`expected positive claimsRemainingToday sentinel`);
  });

  await expect(
    "POST /dashboard/leads/:id/claim again returns 409",
    async () => {
      const r = await fetch(`${base}/dashboard/leads/${firstLeadId}/claim`, {
        method: "POST",
        headers: { [COOKIE_HEADER]: sessionCookie },
      });
      if (r.status !== 409) throw new Error(`expected 409 got ${r.status}`);
    },
  );

  let previewToken = "";
  let previewLinkId = 0;
  await expect(
    "POST /dashboard/leads/preview-link auto-sends SMS+email",
    async () => {
      const r = await fetch(`${base}/dashboard/leads/preview-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [COOKIE_HEADER]: sessionCookie,
        },
        body: JSON.stringify({ leadId: firstLeadId }),
      });
      if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
      const json = (await r.json()) as {
        token: string;
        url: string;
        smsStatus?: string;
        emailStatus?: string;
      };
      if (!json.token || json.token.length < 10) throw new Error("bad token");
      if (!json.smsStatus) throw new Error("missing smsStatus");
      if (!json.emailStatus) throw new Error("missing emailStatus");
      previewToken = json.token;
    },
  );

  await expect(
    "GET /public/preview/:token logs 'opened' event",
    async () => {
      const r = await fetch(`${base}/public/preview/${previewToken}`);
      if (r.status !== 200) throw new Error(`status=${r.status}`);
      const json = (await r.json()) as {
        info: { practice: string; rep: { promoCode: string } };
      };
      if (!json.info.practice) throw new Error("missing practice");
      if (json.info.rep.promoCode !== "REP1")
        throw new Error(`wrong promo code ${json.info.rep.promoCode}`);
    },
  );

  await expect(
    "GET /dashboard/links/:id/events shows opened event",
    async () => {
      const list = await fetch(`${base}/dashboard/links`, {
        headers: { [COOKIE_HEADER]: sessionCookie },
      });
      const lj = (await list.json()) as { links: { id: number }[] };
      previewLinkId = lj.links[0].id;
      const r = await fetch(
        `${base}/dashboard/links/${previewLinkId}/events`,
        { headers: { [COOKIE_HEADER]: sessionCookie } },
      );
      if (r.status !== 200) throw new Error(`status=${r.status}`);
      const json = (await r.json()) as { events: { eventType: string }[] };
      if (!json.events.some((e) => e.eventType === "opened"))
        throw new Error("no opened event recorded");
    },
  );

  await expect(
    "POST /public/preview/:token/events records and notifies",
    async () => {
      const r = await fetch(`${base}/public/preview/${previewToken}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: "preferred_template",
          templateKey: "clinic",
        }),
      });
      if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
      const notif = await fetch(`${base}/dashboard/notifications`, {
        headers: { [COOKIE_HEADER]: sessionCookie },
      });
      const njson = (await notif.json()) as {
        notifications: { type: string }[];
      };
      if (!njson.notifications.some((n) => n.type === "preview.preferred"))
        throw new Error("no preview.preferred notification");
    },
  );

  await expect("POST /dashboard/sms/send persists message", async () => {
    const r = await fetch(`${base}/dashboard/sms/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [COOKIE_HEADER]: sessionCookie,
      },
      body: JSON.stringify({
        leadId: firstLeadId,
        body: "Hi from Karen, looped you in on a quick preview.",
      }),
    });
    if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as { status: string };
    if (json.status !== "dev_skipped" && json.status !== "sent")
      throw new Error(`unexpected status ${json.status}`);
  });

  await expect(
    "Synthesize Stripe checkout completed -> sale + closing-bonus notification",
    async () => {
      const result = await synthesizeDevCheckout({
        tierKey: "boutique_pro",
        leadId: firstLeadId,
        repId: rep1!.id,
        promoCode: "REP1",
        monthlyTotalCents: 14900,
      });
      if (!result.processed) throw new Error("event not processed");
      const notif = await fetch(`${base}/dashboard/notifications`, {
        headers: { [COOKIE_HEADER]: sessionCookie },
      });
      const njson = (await notif.json()) as {
        notifications: { type: string }[];
      };
      if (!njson.notifications.some((n) => n.type === "sale.won"))
        throw new Error("no sale.won notification");
    },
  );

  // Custom dev flow: rep submits quote request, admin sets amount + sends, payment webhook fires, 10% commission credited.
  let quoteId = 0;
  await expect("POST /dashboard/custom-dev quote request", async () => {
    const r = await fetch(`${base}/dashboard/custom-dev/quotes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [COOKIE_HEADER]: sessionCookie,
      },
      body: JSON.stringify({
        leadId: firstLeadId,
        featureKeys: ["appointment_booking_advanced", "intake_form"],
        customDescription: "Calendly-style booking + intake form with HIPAA-friendly fields.",
      }),
    });
    if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as { quote: { id: number } };
    quoteId = json.quote.id;
  });

  let adminCookie = "";
  await expect("Admin login + quote, send", async () => {
    const r = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "Ashford2026" }),
    });
    if (r.status !== 200) throw new Error(`admin login: ${r.status}`);
    adminCookie = r.headers.get("set-cookie")!.split(";")[0];

    const q = await fetch(
      `${base}/admin/custom-dev/quotes/${quoteId}/quote`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [COOKIE_HEADER]: adminCookie,
        },
        body: JSON.stringify({
          quotedAmountCents: 250000,
          adminNote: "Standard scope.",
        }),
      },
    );
    if (q.status !== 200) throw new Error(`quote set: ${q.status}: ${await q.text()}`);

    const s = await fetch(
      `${base}/admin/custom-dev/quotes/${quoteId}/send`,
      { method: "POST", headers: { [COOKIE_HEADER]: adminCookie } },
    );
    if (s.status !== 200) throw new Error(`quote send: ${s.status}: ${await s.text()}`);
    const sjson = (await s.json()) as {
      quote: { status: string };
      sms: { status: string } | null;
      email: { status: string } | null;
    };
    if (sjson.quote.status !== "sent")
      throw new Error(`quote not marked sent: ${sjson.quote.status}`);
    // Quote was created against a lead with phone+email; both deliveries should have fired.
    if (!sjson.sms) throw new Error("quote send did not deliver SMS");
    if (!sjson.email) throw new Error("quote send did not deliver email");
  });

  await expect(
    "Synthesize quote payment -> 10% commission notification to rep",
    async () => {
      const result = await synthesizeDevQuotePayment(quoteId);
      if (!result.processed) throw new Error("quote payment not processed");
      const [q] = await db
        .select()
        .from(customDevQuotes)
        .where(eq(customDevQuotes.id, quoteId))
        .limit(1);
      if (q.status !== "paid") throw new Error(`quote status ${q.status}`);

      const notif = await fetch(`${base}/dashboard/notifications`, {
        headers: { [COOKIE_HEADER]: sessionCookie },
      });
      const njson = (await notif.json()) as {
        notifications: {
          type: string;
          payload?: { commissionCents?: number };
        }[];
      };
      const commission = njson.notifications.find(
        (n) => n.type === "custom_dev.commission",
      );
      if (!commission) throw new Error("no custom_dev.commission notification");
      if (commission.payload?.commissionCents !== 25000)
        throw new Error(
          `expected 25000 commission cents, got ${commission.payload?.commissionCents}`,
        );
    },
  );

  await expect(
    "POST /public/contact-requests + queue + claim flow",
    async () => {
      const r = await fetch(`${base}/public/contact-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "smoke_test",
          name: "Test Therapist",
          practice: "Test Counseling",
          email: "test@example.com",
          phone: "5125550000",
          preferredContact: "callback",
          message: "Please reach out.",
        }),
      });
      if (r.status !== 200) throw new Error(`status=${r.status}: ${await r.text()}`);
      const queue = await fetch(
        `${base}/dashboard/contact-requests/queue`,
        { headers: { [COOKIE_HEADER]: sessionCookie } },
      );
      const qj = (await queue.json()) as { contactRequests: { id: number }[] };
      if (qj.contactRequests.length === 0) throw new Error("queue empty");
      const cid = qj.contactRequests[0].id;
      const claim = await fetch(
        `${base}/dashboard/contact-requests/${cid}/claim`,
        { method: "POST", headers: { [COOKIE_HEADER]: sessionCookie } },
      );
      if (claim.status !== 200)
        throw new Error(`claim: ${claim.status}: ${await claim.text()}`);
    },
  );

  await expect("Admin dashboard reflects sale", async () => {
    const dash = await fetch(`${base}/admin/dashboard`, {
      headers: { [COOKIE_HEADER]: adminCookie },
    });
    if (dash.status !== 200)
      throw new Error(`admin dash: ${dash.status}: ${await dash.text()}`);
    const json = (await dash.json()) as {
      activeSubscriptions: number;
      salesThisMonth: number;
    };
    if (json.salesThisMonth < 1)
      throw new Error(`expected >=1 sale, got ${json.salesThisMonth}`);
  });

  // Verify spec-aligned aliases & new endpoints work end-to-end.
  await expect("Spec aliases: GET /blog/posts + GET /preview/:token", async () => {
    const blog = await fetch(`${base}/blog/posts`);
    if (blog.status !== 200) throw new Error(`/blog/posts: ${blog.status}`);
    const prev = await fetch(`${base}/preview/${previewToken}`);
    if (prev.status !== 200)
      throw new Error(`/preview/${previewToken}: ${prev.status}`);
  });

  await expect("POST /contact-requests (spec alias) works", async () => {
    const r = await fetch(`${base}/contact-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Spec Alias",
        practice: "Spec Alias Practice",
        email: "alias@example.com",
        phone: "5125550199",
        preferredContact: "email",
        message: "Testing spec alias.",
        source: "blog",
      }),
    });
    if (r.status !== 200) throw new Error(`status=${r.status}`);
  });

  await expect("GET /dashboard/leads/:id timeline returns events", async () => {
    const r = await fetch(`${base}/dashboard/leads/${firstLeadId}`, {
      headers: { [COOKIE_HEADER]: sessionCookie },
    });
    if (r.status !== 200)
      throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as {
      lead: { id: number };
      links: unknown[];
      linkEvents: unknown[];
    };
    if (json.lead.id !== firstLeadId) throw new Error("wrong lead");
    if (!Array.isArray(json.linkEvents))
      throw new Error("linkEvents missing");
  });

  await expect("GET /dashboard/leads/available paginates", async () => {
    const r = await fetch(
      `${base}/dashboard/leads/available?page=1&pageSize=5`,
      { headers: { [COOKIE_HEADER]: sessionCookie } },
    );
    if (r.status !== 200) throw new Error(`status=${r.status}`);
    const json = (await r.json()) as {
      leads: unknown[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    if (json.page !== 1 || json.pageSize !== 5)
      throw new Error("page/pageSize mismatch");
    if (json.leads.length > 5) throw new Error("returned > pageSize");
    if (typeof json.total !== "number" || json.total < 1)
      throw new Error("total missing or zero");
  });

  await expect(
    "POST /dashboard/leads/:id/schedule-callback with sendRecap fires SMS+email",
    async () => {
      const when = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const r = await fetch(
        `${base}/dashboard/leads/${firstLeadId}/schedule-callback`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [COOKIE_HEADER]: sessionCookie,
          },
          body: JSON.stringify({ scheduledFor: when, note: "demo", sendRecap: true }),
        },
      );
      if (r.status !== 200)
        throw new Error(`status=${r.status}: ${await r.text()}`);
      const json = (await r.json()) as {
        callback: { id: number };
        recapSmsStatus: string | null;
        recapEmailStatus: string | null;
      };
      if (!json.callback?.id) throw new Error("no callback returned");
      if (json.recapSmsStatus === null)
        throw new Error("recapSmsStatus should not be null when sendRecap=true");
    },
  );

  await expect("GET /admin/custom-dev/queue (spec path)", async () => {
    const r = await fetch(`${base}/admin/custom-dev/queue`, {
      headers: { [COOKIE_HEADER]: adminCookie },
    });
    if (r.status !== 200)
      throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as { quotes: unknown[] };
    if (!Array.isArray(json.quotes)) throw new Error("quotes missing");
  });

  await expect("PATCH /admin/reps/:id updates rep", async () => {
    // rep1 id = 1
    const r = await fetch(`${base}/admin/reps/1`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        [COOKIE_HEADER]: adminCookie,
      },
      body: JSON.stringify({ hourlyRateCents: 3000 }),
    });
    if (r.status !== 200)
      throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as {
      rep: { id: number; hourlyRateCents: number };
    };
    if (json.rep.hourlyRateCents !== 3000)
      throw new Error("hourlyRateCents not updated");
  });

  await expect("POST /admin/leads/import dedupes by phone+email", async () => {
    // Use random phones/emails so the test is hermetic across re-runs.
    const rnd1 = Math.floor(1_000_000 + Math.random() * 8_999_999);
    const rnd2 = Math.floor(1_000_000 + Math.random() * 8_999_999);
    const phone1 = `512555${String(rnd1).slice(0, 4)}`;
    const phone2 = `512555${String(rnd2).slice(0, 4)}`;
    const email1 = `imp${rnd1}@example.com`;
    const email2 = `imp${rnd2}@example.com`;
    const csv =
      "name,practice,specialty,city,state,phone,email\n" +
      `New Person,New Practice,LPC,Austin,TX,${phone1},${email1}\n` +
      `Dup Phone,Dup Practice,LPC,Austin,TX,${phone1},dup-${email2}\n` +
      `Brand New,Brand New Practice,LPC,Austin,TX,${phone2},${email2}\n`;
    const r = await fetch(`${base}/admin/leads/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [COOKIE_HEADER]: adminCookie,
      },
      body: JSON.stringify({ csv }),
    });
    if (r.status !== 200) throw new Error(`status=${r.status}`);
    const json = (await r.json()) as {
      inserted: number;
      duplicates: number;
    };
    // First import: rows 1 and 3 inserted (rows 2 dups row 1 by phone1).
    if (json.inserted !== 2)
      throw new Error(`first inserted=${json.inserted}, want 2`);
    if (json.duplicates !== 1)
      throw new Error(`first duplicates=${json.duplicates}, want 1`);
    const r2 = await fetch(`${base}/admin/leads/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [COOKIE_HEADER]: adminCookie,
      },
      body: JSON.stringify({ csv }),
    });
    const json2 = (await r2.json()) as {
      inserted: number;
      duplicates: number;
    };
    if (json2.inserted !== 0)
      throw new Error(`second inserted=${json2.inserted}, want 0 (dedup)`);
    if (json2.duplicates !== 3)
      throw new Error(`second duplicates=${json2.duplicates}, want 3`);
    // Self-clean: delete the synthetic rows we just imported so the leads
    // table doesn't accumulate "Brand New / New Person" junk across runs.
    // (See dev-DB pollution incident on 2026-04-25.)
    const { inArray } = await import("drizzle-orm");
    await db.delete(leads).where(inArray(leads.phone, [phone1, phone2]));
  });

  await expect("GET /admin/dashboard exposes leadsPool, churn, topReps", async () => {
    const r = await fetch(`${base}/admin/dashboard`, {
      headers: { [COOKIE_HEADER]: adminCookie },
    });
    if (r.status !== 200) throw new Error(`status=${r.status}`);
    const json = (await r.json()) as {
      leadsPool: Record<string, number>;
      churn: { thisMonth: number; ratePct: number };
      topReps: unknown[];
      mrrCents: number;
    };
    if (!json.leadsPool || typeof json.leadsPool.available !== "number")
      throw new Error("leadsPool missing");
    if (!json.churn || typeof json.churn.thisMonth !== "number")
      throw new Error("churn missing");
    if (!Array.isArray(json.topReps))
      throw new Error("topReps must be an array");
    if (typeof json.mrrCents !== "number")
      throw new Error("mrrCents missing");
  });

  await expect("Seeded 8 blog posts include the spec-mandated titles + likes", async () => {
    const r = await fetch(`${base}/blog/posts`);
    if (r.status !== 200) throw new Error(`status=${r.status}`);
    const json = (await r.json()) as {
      posts: { slug: string; title: string; likeCount?: number }[];
    };
    const required = [
      "psychology-today-worst-place-to-be-found",
      "what-your-website-says-about-your-boundaries",
      "9-second-rule-mental-health-patients-decide",
      "composite-houston-emdr-stopped-paying-directories",
      "composite-san-antonio-couples-doubled-inquiries",
      "hipaa-aware-web-design-solo-practitioner",
      "local-seo-therapists-texas-four-things",
      "designing-for-people-in-crisis-five-principles",
    ];
    const slugs = new Set(json.posts.map((p) => p.slug));
    for (const slug of required) {
      if (!slugs.has(slug)) throw new Error(`missing post: ${slug}`);
    }
    const totalLikes = json.posts.reduce(
      (a, p) => a + (p.likeCount ?? 0),
      0,
    );
    if (totalLikes < 1)
      throw new Error("expected seeded blog likes (totalLikes >= 1)");
  });

  await expect("GET /admin/sales returns the recorded sale", async () => {
    const r = await fetch(`${base}/admin/sales`, {
      headers: { [COOKIE_HEADER]: adminCookie },
    });
    if (r.status !== 200)
      throw new Error(`status=${r.status}: ${await r.text()}`);
    const json = (await r.json()) as { sales: unknown[] };
    if (!Array.isArray(json.sales) || json.sales.length < 1)
      throw new Error("expected at least 1 sale");
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  await pool.end();
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
