function readEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

/** Parse `<start>-<end>` 24h half-open window. Default 8-11. Throws on bad input so a typo fails boot loudly. */
function parseSendWindow(raw: string | undefined): {
  startHour: number;
  endHour: number;
} {
  const DEFAULT = { startHour: 8, endHour: 11 } as const;
  if (!raw) return DEFAULT;
  const trimmed = raw.trim();
  const m = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(trimmed);
  if (!m) {
    throw new Error(
      `REENGAGEMENT_SEND_WINDOW_LOCAL_HOURS must look like "8-11" (got ${JSON.stringify(raw)}).`,
    );
  }
  const startHour = Number(m[1]);
  const endHour = Number(m[2]);
  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 1 ||
    endHour > 24 ||
    startHour >= endHour
  ) {
    throw new Error(
      `REENGAGEMENT_SEND_WINDOW_LOCAL_HOURS must be "<start>-<end>" with 0<=start<end<=24 (got ${JSON.stringify(raw)}).`,
    );
  }
  return { startHour, endHour };
}

const NODE_ENV = process.env.NODE_ENV ?? "development";
const IS_PROD = NODE_ENV === "production";

const SESSION_SECRET = (() => {
  const v = readEnv("SESSION_SECRET");
  if (v) return v;
  if (IS_PROD) {
    throw new Error(
      "SESSION_SECRET is required in production. Refusing to boot with an insecure default.",
    );
  }
  // eslint-disable-next-line no-console
  console.warn("[env] SESSION_SECRET missing — using insecure dev fallback (NODE_ENV != production).");
  return "dev-only-insecure-secret";
})();

/**
 * CORS allow-list.
 *
 * - `null` => permissive (`origin: true, credentials: true`). Used in dev
 *   so working from `localhost:5173`, the Replit preview proxy, ngrok,
 *   etc. all "just work" without env churn.
 * - `string[]` => strict allow-list. Browser requests with an `Origin`
 *   header outside this list are rejected. Same-origin / non-browser
 *   callers (no `Origin`) still pass.
 *
 * Production REQUIRES a non-empty `ALLOWED_ORIGINS`. We fail closed and
 * refuse to boot if it's missing — otherwise the very first deploy would
 * silently 4xx every browser request. See `docs/deploy.md` for the exact
 * hostnames that must be listed.
 */
const ALLOWED_ORIGINS: string[] | null = (() => {
  const raw = readEnv("ALLOWED_ORIGINS");
  const parsed = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (IS_PROD) {
    if (parsed.length === 0) {
      throw new Error(
        [
          "ALLOWED_ORIGINS is required in production and must list every browser origin",
          "that should be allowed to call this API (comma-separated, scheme + host, no trailing slash).",
          "Example: ALLOWED_ORIGINS=https://www.ashfordcreative.org,https://sales.ashfordcreative.org,https://admin.ashfordcreative.org",
          "See docs/deploy.md for the full list. Refusing to boot — without it every cross-origin",
          "browser request would be rejected and the frontends would appear broken.",
        ].join(" "),
      );
    }
    return parsed;
  }
  return parsed.length > 0 ? parsed : null;
})();

/**
 * Independent source-of-truth for the frontend origins this deploy should
 * be answering. Populated **separately** from `ALLOWED_ORIGINS` so a
 * typo in either is caught by the boot-time self-preflight in
 * `services/corsBootCheck.ts`. Operators must set this from the
 * deployed frontend hostnames documented in `docs/deploy.md`.
 *
 * Validation rules — entries must be scheme+host with no trailing slash.
 * Anything else is rejected at boot rather than counted as a CORS
 * failure later.
 *
 * Production behavior: REQUIRED. The API refuses to boot if it's missing
 * or empty. This is intentional — the boot CORS self-check is only
 * meaningful when the "expected" list is populated from a different
 * source than the one being checked, otherwise we'd be testing
 * `ALLOWED_ORIGINS` against itself and would never detect operator
 * typos in hostnames (the exact failure mode this guard exists to
 * catch). Refusing to boot here fails the Replit startup health probe
 * at `/api/healthz` and rolls the deploy back automatically.
 *
 * Development behavior: optional and largely ignored (the dev CORS
 * policy is permissive). When set in dev, the boot check still runs
 * — useful for testing the check itself locally.
 */
const EXPECTED_FRONTEND_ORIGINS: string[] | null = (() => {
  const raw = readEnv("EXPECTED_FRONTEND_ORIGINS");
  const parsed = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (IS_PROD && parsed.length === 0) {
    throw new Error(
      [
        "EXPECTED_FRONTEND_ORIGINS is required in production and must list every browser",
        "origin this deploy should be answering (comma-separated, scheme + host, no trailing slash).",
        "It must be populated independently from ALLOWED_ORIGINS so the boot CORS self-check",
        "(services/corsBootCheck.ts) can detect typos in either var. Set it to the same hostnames",
        "documented in docs/deploy.md, e.g.:",
        "  EXPECTED_FRONTEND_ORIGINS=https://www.ashfordcreative.org,https://sales.ashfordcreative.org,https://admin.ashfordcreative.org",
        "Refusing to boot — without it the post-deploy CORS gate is non-deterministic.",
      ].join(" "),
    );
  }
  for (const o of parsed) {
    let url: URL;
    try {
      url = new URL(o);
    } catch {
      throw new Error(
        `EXPECTED_FRONTEND_ORIGINS entry is not a valid URL: ${JSON.stringify(o)}`,
      );
    }
    if (url.pathname !== "/" && url.pathname !== "") {
      throw new Error(
        `EXPECTED_FRONTEND_ORIGINS entry must be scheme+host only (no path): ${o}`,
      );
    }
    if (o.endsWith("/")) {
      throw new Error(
        `EXPECTED_FRONTEND_ORIGINS entry must not have a trailing slash: ${o}`,
      );
    }
  }
  return parsed.length > 0 ? parsed : null;
})();

export const env = {
  nodeEnv: NODE_ENV,
  port: Number(process.env.PORT ?? 3001),
  sessionSecret: SESSION_SECRET,
  allowedOrigins: ALLOWED_ORIGINS,
  expectedFrontendOrigins: EXPECTED_FRONTEND_ORIGINS,
  // publicBaseUrl is what we paste into emails (preview links, portal
  // screenshot URLs, payment-link CTAs). It MUST resolve to https in
  // production — Gmail's image proxy refuses http:// remote images and
  // most modern mail clients flag http links as "not secure", which
  // tanks open and click rates. We assert at module-load time so a
  // misconfigured deploy fails the boot health check instead of
  // silently shipping broken hero images. Localhost is allowed in dev
  // for the obvious reason.
  publicBaseUrl: (() => {
    const resolved =
      readEnv("PUBLIC_BASE_URL") ??
      readEnv("REPLIT_DEV_DOMAIN")?.replace(/^/, "https://") ??
      "http://localhost:5173";
    if (NODE_ENV === "production" && !resolved.startsWith("https://")) {
      throw new Error(
        `PUBLIC_BASE_URL must be https in production (got "${resolved}"). ` +
          "Set PUBLIC_BASE_URL or REPLIT_DEV_DOMAIN to a TLS host before deploying.",
      );
    }
    return resolved;
  })(),

  // Origin where the prospect-facing marketing site (ashford-site) is served.
  // In dev this is the same Replit dev domain as the API (path-based routing
  // dispatches /api/* to the api-server and /template/* to ashford-site). In
  // production they diverge — the site lives at https://www.ashfordcreative.org
  // while the API lives on a separate subdomain. The screenshot service uses
  // this URL when navigating Chromium to capture template previews.
  siteBaseUrl:
    readEnv("SITE_BASE_URL") ??
    readEnv("PUBLIC_BASE_URL") ??
    readEnv("REPLIT_DEV_DOMAIN")?.replace(/^/, "https://") ??
    "http://localhost:5173",

  // Stripe-related env vars are exposed as getters because the secret key
  // is hydrated from the Replit OAuth connector at boot AFTER this module
  // is first imported (sentry.ts → logger.ts → env.ts is the first chain).
  // Without lazy reads, `integrations/stripe.ts` would see `undefined` and
  // initialize the singleton as `null`, disabling all payment paths even
  // though credentials are available a few hundred ms later. See
  // `lib/stripeBootstrap.ts` and `index.ts` for the boot sequence.
  get stripeSecretKey() {
    return readEnv("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return readEnv("STRIPE_WEBHOOK_SECRET");
  },
  get stripePriceMonthly() {
    return readEnv("STRIPE_PRICE_MONTHLY");
  },
  get stripePriceSetupA() {
    return readEnv("STRIPE_PRICE_SETUP_A");
  },
  get stripeProspectPaymentLink() {
    return readEnv("STRIPE_PROSPECT_PAYMENT_LINK");
  },

  twilioAccountSid: readEnv("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: readEnv("TWILIO_AUTH_TOKEN"),
  twilioFromNumber: readEnv("TWILIO_FROM_NUMBER"),
  // Voice — separate number from the SMS-only `TWILIO_FROM_NUMBER` so each
  // channel can be reasoned about (and rotated) independently. The Voice
  // pipeline soft-disables when this is unset; the admin dashboard surfaces
  // a banner so reps know clicks-to-call won't actually dial.
  twilioVoiceNumber: readEnv("TWILIO_VOICE_NUMBER"),
  // WhatsApp click-handoff number (Candice's personal WhatsApp). The
  // marketing site's floating "Chat on WhatsApp" pill hands the visitor
  // off to wa.me/<digits> with a prefilled greeting. Format: digits only,
  // no leading "+", no separators. When unset, the button hides itself.
  whatsappHandoffNumber: readEnv("WHATSAPP_HANDOFF_NUMBER"),
  // Twilio Voice JS SDK requires a short-lived JWT signed by an API Key
  // (account_sid + auth_token cannot mint AccessTokens). Both must be set
  // together — without either, `/api/dashboard/twilio/access-token` 503s
  // and the rep dashboard hides the dialer.
  twilioApiKeySid: readEnv("TWILIO_API_KEY_SID"),
  twilioApiKeySecret: readEnv("TWILIO_API_KEY_SECRET"),
  // TwiML App SID — bound to a Voice URL pointing at our `outbound-twiml`
  // webhook endpoint. The browser dialer presents this SID to Twilio when
  // it places an outbound call, telling Twilio "fetch the dial plan from
  // the URL configured on this app".
  twilioTwimlAppSid: readEnv("TWILIO_TWIML_APP_SID"),
  // Hard daily ceiling (USD) for outbound voice spend. Defaults to $20/day.
  // Sums Twilio + Whisper + GPT cost in cents over the trailing 24h. New
  // outbound calls are blocked once exceeded; resets at midnight CT.
  twilioDailyCostCapUsd: Number(readEnv("TWILIO_DAILY_COST_CAP_USD") ?? 20),

  // Replit Object Storage bucket — provisioned automatically by the
  // Replit storage tool pane. Set when audio recordings should be
  // persisted; when unset every audio-storage helper soft-fails so
  // missing storage doesn't break the rest of the voice pipeline.
  // DEPRECATED off Replit: integrations/audioStorage.ts now uses the S3
  // config below (works on any host, e.g. Cloudflare R2). Kept only so any
  // stray reference still type-checks.
  objectStorageBucketId: readEnv("DEFAULT_OBJECT_STORAGE_BUCKET_ID"),

  // S3-compatible object storage for call audio (Cloudflare R2 / AWS S3 /
  // Backblaze B2). Replaces the Replit-sidecar GCS path which only worked on
  // Replit. ALL optional: when any of bucket/endpoint/keys is missing, every
  // audio-storage helper soft-fails (returns null) so the voice pipeline
  // degrades gracefully instead of crashing. For R2: S3_REGION must be "auto"
  // and S3_ENDPOINT is https://<account-id>.r2.cloudflarestorage.com (NO
  // bucket suffix — the bucket is passed separately).
  s3Bucket: readEnv("S3_BUCKET"),
  s3Endpoint: readEnv("S3_ENDPOINT"),
  s3Region: readEnv("S3_REGION") ?? "auto",
  s3AccessKeyId: readEnv("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: readEnv("S3_SECRET_ACCESS_KEY"),

  resendApiKey: readEnv("RESEND_API_KEY"),
  resendWebhookSecret: readEnv("RESEND_WEBHOOK_SECRET"),
  resendFromEmail: readEnv("RESEND_FROM_EMAIL") ?? "hello@ashfordcreative.org",
  // We send replies back to the parent domain (NOT a `reply.` subdomain).
  // ImprovMX is configured on `ashfordcreative.org` with a wildcard alias
  // `*@ashfordcreative.org` → owner inbox, so `reply@ashfordcreative.org`
  // and tagged variants like `reply+rep42@ashfordcreative.org` both land.
  // Adding a `reply.` subdomain would have required separate MX records.
  resendReplyDomain: readEnv("RESEND_REPLY_DOMAIN") ?? "ashfordcreative.org",

  ownerNotificationEmail: readEnv("OWNER_NOTIFICATION_EMAIL"),
  ownerNotificationSms: readEnv("OWNER_NOTIFICATION_SMS"),
  ownerNotificationTypes: (readEnv("OWNER_NOTIFICATION_TYPES") ??
    "sale.won,subscription.past_due,client_onboarding.ready_to_build,custom_dev.quote_requested,approval.requested,escalation.opened,health.degraded,health.recovered,whatsapp.click")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  ownerDailyDigestEnabled:
    (readEnv("OWNER_DAILY_DIGEST_ENABLED") ?? "true").toLowerCase() !== "false",
  ownerDailyDigestHourUtc: Number(readEnv("OWNER_DAILY_DIGEST_HOUR_UTC") ?? 13),

  // Catalog 2.0 default feature: front-desk Daily Schedule Digest. Sent
  // every morning to the practice's front-desk inbox with the day's
  // booked callbacks/appointments. Defaults: 7am UTC, comma-separated
  // recipient list (one per practice in the typical demo deployment).
  frontDeskScheduleDigestEnabled:
    (readEnv("FRONT_DESK_SCHEDULE_DIGEST_ENABLED") ?? "true").toLowerCase() !==
    "false",
  frontDeskScheduleDigestHourUtc: Number(
    readEnv("FRONT_DESK_SCHEDULE_DIGEST_HOUR_UTC") ?? 12,
  ),
  frontDeskScheduleDigestRecipients: (
    readEnv("FRONT_DESK_SCHEDULE_DIGEST_RECIPIENTS") ?? ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // ---- Personalized portal V1: enrichment + AI integrations ---------------
  // All optional; every consumer must soft-fail if the corresponding key is
  // missing. We never throw at boot for a missing enrichment key — that would
  // mean a small config drift takes the whole API down.
  googlePlacesApiKey: readEnv("GOOGLE_PLACES_API_KEY"),
  openaiApiKey: readEnv("OPENAI_API_KEY"),
  anthropicApiKey: readEnv("ANTHROPIC_API_KEY"),
  // Replit AI Integrations proxy for Anthropic. When present we prefer this
  // over a raw ANTHROPIC_API_KEY because it routes through Replit's billing
  // (no per-key usage caps to manage). The base URL points at the proxy and
  // the API key is a dummy string the SDK requires.
  aiAnthropicBaseUrl: readEnv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL"),
  aiAnthropicApiKey: readEnv("AI_INTEGRATIONS_ANTHROPIC_API_KEY"),
  unsplashAccessKey: readEnv("UNSPLASH_ACCESS_KEY"),
  apifyApiToken: readEnv("APIFY_API_TOKEN"),
  scraperapiKey: readEnv("SCRAPERAPI_KEY"),
  yelpApiKey: readEnv("YELP_API_KEY"),
  elevenlabsApiKey: readEnv("ELEVENLABS_API_KEY"),
  twilioTollfreeNumber: readEnv("TWILIO_TOLLFREE_NUMBER"),
  hunterApiKey: readEnv("HUNTER_API_KEY"),
  similarwebApiKey: readEnv("SIMILARWEB_API_KEY"),

  // ---- DialPad (auto call-logging + Vi transcription/summary) -------------
  // Optional. When DIALPAD_API_KEY is unset the integration soft-fails — the
  // webhook endpoint stays mounted but rejects 503 so a misconfigured DialPad
  // workspace doesn't silently drop call history. The webhook secret is
  // generated by the operator (any random ≥32-char string) and supplied to
  // DialPad at subscription registration time so payloads can be HS256-verified.
  dialpadApiKey: readEnv("DIALPAD_API_KEY"),
  dialpadWebhookSecret: readEnv("DIALPAD_WEBHOOK_SECRET"),
  // Override only when self-hosting DialPad against a non-default region (EU).
  // Defaults to the global tenant.
  dialpadApiBaseUrl: readEnv("DIALPAD_API_BASE_URL") ?? "https://dialpad.com",
  // ---- DialPad SMS (added 2026-04-27 to retire Twilio outbound SMS) -------
  // DialPad's Send-SMS endpoint requires (a) the numeric DialPad user_id
  // that owns the line, and (b) the E.164 from-number to send from. Both
  // are optional at boot — when either is missing, integrations/twilio.ts
  // keeps using the legacy Twilio path. The cutover from Twilio to DialPad
  // for SMS is therefore a single env-var flip in production.
  dialpadUserId: readEnv("DIALPAD_USER_ID"),
  dialpadFromNumber: readEnv("DIALPAD_FROM_NUMBER"),
  // Separate secret for the SMS webhook subscription. DialPad lets you
  // register multiple webhooks each with its own secret; we keep call and
  // SMS secrets independent so rotating one doesn't disrupt the other.
  // Falls back to the call webhook secret to make first-time setup easier.
  dialpadSmsWebhookSecret:
    readEnv("DIALPAD_SMS_WEBHOOK_SECRET") ?? readEnv("DIALPAD_WEBHOOK_SECRET"),

  // ---- DialPad OAuth (per-rep credentials, task #226) ---------------------
  // 3-legged OAuth so each rep places calls / sends SMS from HER OWN
  // Dialpad number. The shared `DIALPAD_API_KEY` above is kept ONLY as a
  // system-level fallback (webhook subscription bootstrap, admin Candice's
  // own back-office actions). Out-of-band setup: Candice registers the
  // OAuth app on dialpad.com with redirect URI
  // `${PUBLIC_BASE_URL}/api/dashboard/integrations/dialpad/callback` and
  // requested scopes (at minimum `recordings_export` + the call/SMS
  // scopes the existing integration uses).
  //
  // When ANY of the three values is missing the per-rep flow soft-fails:
  // - The `Connect my Dialpad` button on the rep settings page is disabled
  //   with a tooltip explaining the integration isn't configured yet.
  // - All sends fall back to the shared key (legacy behavior).
  // This means a half-configured production env never breaks the rep app.
  dialpadOauthClientId: readEnv("DIALPAD_OAUTH_CLIENT_ID"),
  dialpadOauthClientSecret: readEnv("DIALPAD_OAUTH_CLIENT_SECRET"),
  // AES-256-GCM key for the rep_dialpad_credentials table. Accepts hex
  // (64 chars), base64 (44 chars), or any ≥32-char passphrase (SHA-256
  // expanded). Rotating this key invalidates all stored tokens — reps
  // simply re-Connect on next login.
  dialpadTokenEncKey: readEnv("DIALPAD_TOKEN_ENC_KEY"),

  // ---- SMS Mobile API (smsmobileapi.com) ----------------------------------
  // Legacy outbound-SMS provider added 2026-04-29 then deprecated the same
  // day in favor of TextBelt — the SMS Mobile API requires a paired phone
  // with the app open, which doesn't fit a "send 5 SMS/day from the
  // dashboard" workflow. Kept here so the integration module still
  // type-checks; sendSms() no longer routes through it.
  smsMobileApiToken: readEnv("SMS_MOBILE_API_TOKEN"),
  smsMobileApiBaseUrl:
    readEnv("SMS_MOBILE_API_BASE_URL") ?? "https://api.smsmobileapi.com",

  // ---- TextBelt (textbelt.com) --------------------------------------------
  // Primary outbound-SMS provider as of 2026-04-29. TextBelt is a managed
  // HTTP gateway: they hold the carrier-registered numbers and the 10DLC
  // brand registration, we POST a job and they deliver. Replies are
  // routed back via a signed webhook (HMAC-SHA256 over timestamp+body
  // using the API key as secret).
  //
  // When TEXTBELT_API_KEY is unset, sendSms() falls back to the literal
  // "textbelt" free-tier key inside the integration module, which is
  // capped at 1 send/IP/day and does NOT support replies — useful for
  // smoke-testing the wiring without buying credits. Set this to a paid
  // key (https://textbelt.com/purchase) to unlock replies + real volume.
  textbeltApiKey: readEnv("TEXTBELT_API_KEY"),
  textbeltApiBaseUrl:
    readEnv("TEXTBELT_API_BASE_URL") ?? "https://textbelt.com",

  // ---- Domain availability lookups (Domainr via RapidAPI) -----------------
  // Optional: when missing, the integration falls back to a deterministic
  // local generator so the "$0 / FREE domain" UX still works in dev / when
  // the upstream is down. Live availability data only flows when set.
  domainrApiKey: readEnv("DOMAINR_API_KEY"),

  // ---- Re-engagement drip send window -------------------------------------
  // Drip touches (J+3/J+7/J+14/J+30) are only fired when the prospect's
  // local hour is inside this half-open window [start, end). Default
  // 8am–11am Texas time — early morning is when healthcare-practice
  // owners check email before the day's appointments start. Touches that
  // come due outside the window are deferred to the next sweep tick;
  // the cadence "what gets sent and in what order" is unaffected, only
  // the time-of-day delivery shifts.
  //
  // Format: `<start>-<end>` where both are integer hours 0–23 and
  // `start < end`. Whitespace tolerated. Examples: `8-11`, `9-12`.
  // The hour gate uses `America/Chicago` (Texas time) — ~all leads are
  // in TX so a single timezone is good enough for v1; per-lead tz can
  // be layered in later when we expand to other states.
  reengagementSendWindow: parseSendWindow(
    readEnv("REENGAGEMENT_SEND_WINDOW_LOCAL_HOURS"),
  ),
} as const;

export const isProd = IS_PROD;
