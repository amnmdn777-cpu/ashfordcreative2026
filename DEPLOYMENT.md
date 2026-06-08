# Deploying to Railway

This repo deploys as **three Railway services** inside one project:

| Service          | Source dir         | Builder            | Public? |
| ---------------- | ------------------ | ------------------ | ------- |
| Postgres         | (Railway plugin)   | —                  | no      |
| `ashford-backend`| `ashford-backend/` | Dockerfile         | yes     |
| `frontend`       | `frontend/`        | Dockerfile (nginx) | yes     |

Each service has its own `Dockerfile` + `railway.json`. In the Railway UI set
each service's **Root Directory** to the matching folder so Railway builds the
right Dockerfile.

---

## 1. Database

Add a **PostgreSQL** plugin to the project. Railway exposes `DATABASE_URL` on the
plugin; reference it from the backend service variable:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Schema is pushed automatically on each deploy by the backend's
`preDeployCommand` (`npm run db:push`, see `ashford-backend/railway.json`). If you
prefer versioned migrations over push, change it to `npm run db:migrate`.

---

## 2. Backend service (`ashford-backend`)

Builds the Express API and bundles to `dist/index.mjs`. The image ships a system
**Chromium** because the template-screenshot feature uses puppeteer at runtime.

### Required variables

```
NODE_ENV=production
PORT=8080                       # Railway sets this automatically; 8080 is the image default
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=<long random string>     # generate: openssl rand -hex 32
ALLOWED_ORIGINS=https://<your-frontend-domain>   # comma-separated, no trailing slash
```

> `ALLOWED_ORIGINS` is **required in production** — the server fails to boot
> without it (see `src/lib/env.ts`). List every browser origin that will call the
> API (the frontend's Railway domain and/or custom domains).

### Common optional integrations (set the ones you use)

```
SITE_BASE_URL=https://<your-frontend-domain>
PUBLIC_BASE_URL=https://<your-frontend-domain>
STRIPE_SECRET_KEY=...
RESEND_API_KEY=...           RESEND_FROM_EMAIL=...
ANTHROPIC_API_KEY=...
GOOGLE_PLACES_API_KEY=...
SENTRY_DSN=...
```

(Full list lives in `ashford-backend/src/lib/env.ts`.) The values that were in the
old local `ashford-backend/.env` need to be re-entered here — that file is now
git-ignored and was never pushed.

---

## 3. Frontend service (`frontend`)

Vite build served by nginx with SPA fallback (so client-side routes `/admin`,
`/sales`, `/template/...` all resolve to `index.html`).

Vite inlines env vars **at build time**, so these are set as Railway service
variables and the Dockerfile reads them as build ARGs:

```
VITE_API_BASE=https://<your-backend-domain>     # absolute backend URL
VITE_MOCK_AUTH=false
VITE_SENTRY_DSN=...                              # optional
```

nginx listens on `${PORT}` (Railway-assigned) via the envsubst template.

---

## ⚠️ Cross-origin auth caveat (read this)

The session cookie is currently set with **`SameSite=Lax`**
(`ashford-backend/src/lib/auth.ts:52`). Browsers do **not** send `Lax` cookies on
cross-site requests, so if the frontend (`frontend.up.railway.app`) and backend
(`api.up.railway.app`) are on **different domains**, login will appear to succeed
but every authenticated request afterward will be treated as logged-out.

Pick one:

- **Option A — same parent domain (recommended).** Put both services on
  subdomains of one domain you own, e.g. `app.example.com` (frontend) and
  `api.example.com` (backend). `SameSite=Lax` works across subdomains of the same
  registrable domain, so no code change is needed. Set `VITE_API_BASE` and
  `ALLOWED_ORIGINS` accordingly.

- **Option B — truly different domains.** Change the cookie to
  `sameSite: "none"` + `secure: true` in production. This is a one-line change I
  can make for you; it also needs CORS `credentials: true` (already set).

If you'd rather avoid the cookie question entirely, the frontend nginx can
reverse-proxy `/api` to the backend over Railway's private network so the browser
only ever sees one origin — ask and I'll wire that variant.

---

## 4. Deploy

1. Push this branch to GitHub (`origin` is already
   `amnmdn777-cpu/ashfordcreative2026`).
2. In Railway: **New Project → Deploy from GitHub repo**, pick the repo.
3. Add the **Postgres** plugin.
4. Create the **backend** service → Root Directory `ashford-backend` → add the
   variables above.
5. Create the **frontend** service → Root Directory `frontend` → add
   `VITE_API_BASE` etc.
6. Generate a public domain for each service (Settings → Networking), then update
   `ALLOWED_ORIGINS` (backend) and `VITE_API_BASE` (frontend) with the real URLs
   and redeploy.

### Local Docker smoke test

```bash
# backend
docker build -t ashford-backend ./ashford-backend
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=... -e SESSION_SECRET=dev -e ALLOWED_ORIGINS=http://localhost:8081 \
  ashford-backend

# frontend
docker build -t ashford-frontend --build-arg VITE_API_BASE=http://localhost:8080 ./frontend
docker run --rm -p 8081:8080 ashford-frontend
```
