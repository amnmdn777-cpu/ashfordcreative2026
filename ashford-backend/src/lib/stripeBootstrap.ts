/**
 * Replit Stripe connector → process.env hydration.
 *
 * The api-server has 12 modules that import a synchronous `stripe` singleton
 * from `integrations/stripe.ts`, which itself reads `env.stripeSecretKey`
 * (= `process.env.STRIPE_SECRET_KEY`) at module-load time. To avoid an
 * invasive refactor of every call site to `await getStripeClient()`, we
 * fetch the connector-managed Stripe credentials BEFORE any module that
 * depends on `env.ts` is imported, and stuff the values into
 * `process.env`. From there the existing code path takes over unchanged.
 *
 * This must be invoked from `index.ts` BEFORE the dynamic `import("./app")`
 * so the singleton in `integrations/stripe.ts` resolves with the real
 * secret key on first read. See `index.ts` for the boot sequence.
 *
 * If the connector is not reachable or returns no settings (e.g. the user
 * hasn't connected Stripe yet, or this is a non-Replit environment), we
 * log a warning and leave `process.env` untouched. Callers that need
 * Stripe will gracefully degrade via the existing `if (!stripe)` guards.
 */

const STRIPE_CONNECTOR_NAME = "stripe";

const readReplitToken = (): string | null => {
  if (process.env.REPL_IDENTITY) return `repl ${process.env.REPL_IDENTITY}`;
  if (process.env.WEB_REPL_RENEWAL)
    return `depl ${process.env.WEB_REPL_RENEWAL}`;
  return null;
};

type StripeConnectorSettings = {
  publishable?: string;
  secret?: string;
};

type ConnectionItem = {
  settings?: StripeConnectorSettings;
};

type ConnectionResponse = {
  items?: ConnectionItem[];
};

/**
 * Fetch Stripe credentials from the Replit connector and copy them into
 * `process.env.STRIPE_SECRET_KEY` and `process.env.STRIPE_PUBLISHABLE_KEY`
 * unless those env vars are already set (manual override wins).
 *
 * Returns silently on any failure — the caller must NOT block boot on
 * Stripe being unavailable, since most of the app does not touch payments.
 */
export async function hydrateStripeFromConnector(): Promise<{
  hydrated: boolean;
  reason?: string;
}> {
  // Operator override — if STRIPE_SECRET_KEY is already set in the
  // environment (e.g. a deployed prod env where the operator pasted a
  // restricted key), do nothing. Same for the publishable key.
  if (
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PUBLISHABLE_KEY
  ) {
    return { hydrated: false, reason: "already_set" };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    return { hydrated: false, reason: "no_connector_hostname" };
  }

  const xReplitToken = readReplitToken();
  if (!xReplitToken) {
    return { hydrated: false, reason: "no_replit_token" };
  }

  // The connector returns environment-scoped credentials. In dev/REPL
  // we want sandbox keys; in a deployed prod environment we want live
  // keys. REPLIT_DEPLOYMENT === "1" is set only in the deployed runtime.
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", STRIPE_CONNECTOR_NAME);
  url.searchParams.set("environment", targetEnvironment);

  let data: ConnectionResponse;
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
        signal: ac.signal,
      });
      if (!res.ok) {
        return {
          hydrated: false,
          reason: `connector_http_${res.status}`,
        };
      }
      data = (await res.json()) as ConnectionResponse;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return {
      hydrated: false,
      reason: `connector_fetch_failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const settings = data.items?.[0]?.settings;
  if (!settings || !settings.secret || !settings.publishable) {
    return {
      hydrated: false,
      reason: `no_${targetEnvironment}_settings`,
    };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    process.env.STRIPE_SECRET_KEY = settings.secret;
  }
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    process.env.STRIPE_PUBLISHABLE_KEY = settings.publishable;
  }

  return { hydrated: true };
}
