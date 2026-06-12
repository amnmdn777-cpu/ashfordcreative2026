# Ashford Creative 2026 — Project Handover & Ownership Documentation

This document serves as the operational guide for the production cutover, ownership transfer, local development environment setup, and long-term maintenance of the Ashford Creative application stack.

> [!NOTE]
> For a deep-dive technical explanation of the codebase architecture, folder structure, database schema, AI prompting engine, and system integration details, please refer to the comprehensive **[PROJECT_DOCS.md](file:///d:/Client/newclient/PROJECT_DOCS.md)** guide.

---

## 1. System Architecture Overview

```mermaid
graph TD
    User([Browser / Client]) -->|HTTPS| Frontend[Railway Frontend Service]
    User -->|HTTPS / REST API| Backend[Railway Backend Service]
    Backend -->|Drizzle ORM| Postgres[(Railway PostgreSQL)]
    Backend -->|API Requests| Stripe[Stripe API]
    Backend -->|Email Delivery| Resend[Resend API]
    Backend -->|Telephony / VoIP| Dialpad[Dialpad API]
    Backend -->|Object Storage| CF_R2[Cloudflare R2]
    Backend -->|Scrapers| Apify[Apify / ScraperAPI]
```

### Stack Breakdown
1. **Frontend (Vite / React):** A Single Page Application (SPA) built using React, TypeScript, and styled with vanilla CSS. The client builds into a highly optimized static bundle served on Railway via Nixpacks.
2. **Backend (Express / Node.js):** A TypeScript-based REST API compiled to ES modules using `esbuild`. The server uses:
   * **Drizzle ORM** for type-safe database queries.
   * **Puppeteer (Chromium)** running headlessly inside the Docker container to capture webpage screenshots and render PDF briefs dynamically.
3. **Database (PostgreSQL):** Relational database storage hosted on Railway's Postgres engine.
4. **Storage (Cloudflare R2):** S3-compatible object storage used for archiving voicemail recordings, audio clips, and clinician profile images.

---

## 2. Environment Variables Specification

To ensure successful deployments, ensure the following environment variables are correctly defined on your hosting platform:

### Backend Service (`ashford-backend`)

| Variable Name | Required? | Purpose & Source | Example Value |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Controls runtime optimization and logger formats. Set to `production` or `development`. | `production` |
| `PORT` | **Yes** | The port the Express server binds to. Provided automatically by Railway. | `8080` |
| `DATABASE_URL` | **Yes** | Connection string for PostgreSQL. Reference the Railway plugin variable. | `postgres://user:pass@host:port/db` |
| `SESSION_SECRET` | **Yes** | High-entropy random key to encrypt user session cookies. | *Generate via: `openssl rand -hex 32`* |
| `ALLOWED_ORIGINS` | **Yes** | Comma-separated list of browser origins permitted to contact the API (CORS). | `https://ashfordhealthcreative.com` |
| `STRIPE_SECRET_KEY` | **Yes** | Live API Secret key from Stripe. Used to handle checkout sessions and subscription lifecycle. | `rk_live_...` or `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY`| **Yes** | Public-facing API key used in checkout sessions. | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | Key to verify that requests hitting the webhook route originate from Stripe. | `whsec_...` |
| `RESEND_API_KEY` | **Yes** | Transactional email sender API key from Resend. | `re_...` |
| `RESEND_FROM_EMAIL` | **Yes** | The outbound email address representing the application sender. | `hello@ashfordhealthcreative.com` |
| `RESEND_REPLY_DOMAIN` | **Yes** | Domain configured for incoming email routing. | `ashfordhealthcreative.com` |
| `DIALPAD_API_KEY` | **Yes** | Telephony API key to trigger VoIP calls and callbacks for sales reps. | `PLsVny...` |
| `DIALPAD_FROM_NUMBER` | **Yes** | Caller ID associated with outgoing rep dialer triggers. | `+18323176889` |
| `DIALPAD_USER_ID` | **Yes** | Primary user ID associated with the Dialpad corporate account. | `5812523812069376` |
| `ANTHROPIC_API_KEY` | **Yes** | API key to leverage Claude models for bio translation, summarization, and briefing writing. | `sk-ant-api03-...` |
| `S3_BUCKET` | **Yes** | The name of the Cloudflare R2 bucket. | `ashford-audio` |
| `S3_ENDPOINT` | **Yes** | The API endpoint URL pointing to your Cloudflare R2 account. | `https://<account_id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | **Yes** | HMAC credential access key for R2 storage bucket. | `8d9a2ef8...` |
| `S3_SECRET_ACCESS_KEY`| **Yes** | HMAC credential secret key for R2 storage bucket. | `c8feb6b...` |
| `ADMIN_TOKEN` | **Yes** | Secret static auth token used to bypass dashboard logins for administrators. | `WnLdvdl...` |
| `INTERNAL_API_TOKEN` | **Yes** | Auth token used by cron servers and webhooks to trigger backend processes. | `8c09445...` |

### Frontend Service (`frontend`)

| Variable Name | Required? | Purpose & Source | Example Value |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE` | **Yes** | The absolute URL pointing to your live backend API gateway. | `https://api.ashfordhealthcreative.com` |
| `VITE_MOCK_AUTH` | **Yes** | Decides if login bypass is active. **Must be `false` in production** to enforce authentication. | `false` |

---

## 3. Third-Party Setup Guides

### 1. Stripe Setup (Production)
To handle user onboarding, subscription pricing, and billing, Stripe must be configured correctly:
*   **Webhooks:** Point your Stripe live webhook listener to the absolute endpoint URL:
    `https://api.ashfordhealthcreative.com/api/stripe/webhook`
*   **Webhook Events:** Enable the following event triggers in Stripe:
    *   `checkout.session.completed`
    *   `customer.subscription.deleted`
    *   `invoice.payment_succeeded`
*   **Stripe Tax:** Enable Stripe Tax in your Stripe Dashboard. In your environment variables:
    *   Set `STRIPE_AUTOMATIC_TAX_ENABLED=true`
    *   Configure a physical business head-office address in Stripe Dashboard (this is legally required by Stripe to compute sales tax).
*   **Terms of Service:** If `STRIPE_REQUIRE_TOS_CONSENT=true` is enabled, ensure your Terms of Service URL is saved in your Stripe Dashboard Settings.

### 2. Resend Setup (Email Deliverability)
*   **Domain Verification:** Add `ashfordhealthcreative.com` to Resend. Copy the provided MX, TXT (SPF/DKIM), and CNAME records into your DNS registrar (e.g. GoDaddy/Cloudflare).
*   Ensure the domain shows as **Active/Verified** before launching production emails.

### 3. Cloudflare R2 Setup (Object Storage)
*   **Bucket Configuration:** Create a private bucket named `ashford-audio` (or update `S3_BUCKET`).
*   **CORS Policy:** To let client browsers read R2 assets, set the bucket CORS policy to allow your frontend origin:
    ```json
    [
      {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["https://ashfordhealthcreative.com"],
        "ExposeHeaders": [],
        "MaxAgeSeconds": 3000
      }
    ]
    ```

---

## 4. Production Cutover Checklist

Follow these checklist items sequentially when launching production:

```
[ ] Step 1: Clone staging git branch into the primary 'production' branch.
[ ] Step 2: Configure production Postgres Database in Railway.
[ ] Step 3: Input all live Production Secrets into Railway service variables (Backend & Frontend).
[ ] Step 4: Verify the backend boots and Drizzle auto-runs `npm run db:push` to sync database tables.
[ ] Step 5: Restore production database tables if seeding or using a dump file (backup.sql):
            psql -d "postgres://user:pass@host:port/db" -f backup.sql
[ ] Step 6: Map your production domains to the Railway services:
            - https://ashfordhealthcreative.com -> points to frontend service
            - https://api.ashfordhealthcreative.com -> points to backend service
[ ] Step 7: Complete a live E2E check (e.g., click "Book Consult", verify Stripe checkout redirect, verify email receipt).
```

---

## 5. Local Development & Code Maintenance

### Getting Started Locally
Ensure you have Node.js (version 20+) installed. Follow these terminal commands to launch the workspace:

```bash
# 1. Clone the repository and install root dependencies
npm install

# 2. Add local configuration keys into `.env` (refer to ashford-backend/.env.example)
# Ensure you specify a valid PostgreSQL DATABASE_URL

# 3. Synchronize database tables
npm run db:push --workspace=ashford-backend

# 4. (Optional) Run the seed script to populate test leads
npm run seed --workspace=ashford-backend

# 5. Boot the development services
# Starts backend watch engine on port 3001
npm run dev --workspace=ashford-backend

# Starts Vite client server on port 5173
npm run dev --workspace=frontend
```

### Performing Project Audits & Health Verification
Run these commands locally or in CI pipelines to verify code health before committing changes:
```bash
# Typecheck backend typescript code
npm run typecheck --workspace=ashford-backend

# Validate frontend bundle compiler
npm run build --workspace=frontend

# Compile production backend build assets
npm run build --workspace=ashford-backend
```

### Database Updates
Ashford Creative uses Drizzle ORM to sync schemas. If you modify any file inside `ashford-backend/packages/db/src/schema/`:
*   Run the schema push utility:
    ```bash
    npm run db:push --workspace=ashford-backend
```
*   Drizzle will verify the database schema against the TypeScript model definitions and safely apply migrations.

### Health Check Monitoring
The application health status is monitored at the `/api/healthz` endpoint on the backend.
*   **Stripe Resilience:** The health check queries `stripe.balance.retrieve()`. If the credential configured is a **Restricted API Key** without general balance permissions, the health check gracefully falls back to `"ok"` status (provided the connection test returns a valid `403 Forbidden` response confirming authentic credentials).
