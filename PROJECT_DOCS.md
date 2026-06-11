# Ashford Creative 2026 — Comprehensive Project Architecture & Technical Documentation

This document provides a deep-dive architectural specification of the Ashford Creative platform. It details both the Frontend and Backend systems, database schemas, data enrichment pipelines, and external integrations.

---

## 1. System Architecture Diagram

```
                              ┌──────────────────────────────────────────────┐
                              │               Vite Client App                │
                              │  (Admin, Rep, & Prospect Portal Frontends)   │
                              └──────────────────────┬───────────────────────┘
                                                     │
                                            HTTPS API Requests
                                                     │
                                                     ▼
                              ┌──────────────────────────────────────────────┐
                              │             Express API Gateway              │
                              │           (TypeScript Backend App)           │
                              └──────┬───────────────┬───────────────┬───────┘
                                     │               │               │
                               Drizzle ORM       REST API       S3 Protocol
                                     │               │               │
                                     ▼               ▼               ▼
                              ┌────────────┐   ┌───────────┐   ┌─────────────┐
                              │ PostgreSQL │   │ External  │   │ Cloudflare  │
                              │  Database  │   │ Services  │   │ R2 Storage  │
                              └────────────┘   └───────────┘   └─────────────┘
                                               (Stripe, Resend,
                                               Dialpad, Apify)
```

---

## 2. Frontend Architecture Deep-Dive (`frontend/`)

The frontend is a single monorepo client application built with **React**, **TypeScript**, and **Vite 7**.

### Directory Structure & Module Separation
*   `src/admin/`: Admin dashboard. Used by super-users to configure default templates, view system-wide audits, approve custom-dev quotes, and trigger refunds.
*   `src/rep/`: Sales Representative dashboard. Used by reps to manage leads, trigger Dialpad calls, update branding options, customize headlines, and generate proposal links.
*   `src/site/`: The public-facing site and **Prospect Portal template engine**.
    *   `src/site/components/sections/`: Modular layout elements (e.g., `Hero`, `About`, `Services`, `Faq`, `Reviews`) shared across all client website designs.
    *   `src/site/templates/`: Individual clinician site templates (e.g., `Garden.tsx`, `Sunrise.tsx`, `Polaroid.tsx`, `Constellation.tsx`, `PlayfulModern.tsx`).
    *   `src/site/data/`: Data resolution models.
        *   `personas.ts`: Hardcoded fallback stubs for each design (for showcase pages).
        *   `resolvePersona.ts`: **The Core Templating Brain**. Resolves the data cascade (Real Lead Data ➔ Crawled Data ➔ Persona Fallback).
*   `src/site/preview/portal/ProspectPortal.tsx`: The primary interface the therapist views. Loads customizations dynamically, coordinates add-on purchases, and handles checkouts.

### The Template Resolution Engine (`resolvePersona.ts`)
When a therapist views their preview, `resolvePersona` dynamically maps the scraped dataset onto the active template:
1.  **Lead Detection:** Checks if the client is looking at a real scraped lead or a static demo (`isReal`).
2.  **Name Recovery:** Sanitizes scraped names. If the crawler accidentally captures aggregator titles (e.g. "Psychology Today" or "Care.com"), it filters them out using a blocklist and extracts the clinician's real first name from their bio using regex opening greetings (e.g. "Hi, I'm...").
3.  **Content Synthesis:** If the clinician has no pre-written biography, the engine dynamically synthesizes a professional biography in their target language (English or Spanish) using their location, practice name, and primary therapeutic specialty.
4.  **CTA Routing:** Overrides fallback links. If the user does not have a scheduling page, the button routes cleanly to `#` or their contact number instead of displaying a broken demo calendar.

### Customization & Branding Overlay (`ThemeProvider.tsx`)
Therapist sites display custom colors, fonts, and assets based on the rep's customizations:
*   `ThemeProvider` maps selected brand colors (`--color-primary`, `--p-primary`, etc.) onto the DOM.
*   It validates the color contrast of custom accent colors against the background to guarantee readability.

---

## 3. Backend Architecture Deep-Dive (`ashford-backend/`)

The backend is a high-throughput Express REST API written in TypeScript.

### Core Pipelines

#### 1. Data Enrichment Pipeline (`previewContent.ts`)
When a new lead is created, the system triggers parallel crawlers and data syndicators:
*   **Apify Scrapers:** Extracts full HTML pages and text hierarchies from the clinician's existing website.
*   **Google Places API:** Resolves their physical office location coordinates, verified phone numbers, and crawls their latest public reviews.
*   **Psychology Today & Headway API Syndicators:** Pulls official verified insurance profiles, accepted modalities (e.g., CBT, EMDR), age groups served, and standard session fees.
*   **Identity Guard (`verifyEnrichedIdentity.ts`):** Cross-references search results. To prevent matching therapists with identical names in different states, it mandates city and name similarity token overlaps before merging database records.

#### 2. The AI Synthesis Engine (`draftJournalEntriesWithLlm`)
Uses **Anthropic's Claude 3.5 Sonnet** to automatically draft bespoke content:
*   **Bio translation:** Translates bio descriptions between English and Spanish.
*   **Insights Journal:** Composes 3 custom-written, highly specialized articles matching the therapist's target niche (e.g., anxiety, burnout, relationship counseling) to demonstrate authority.

#### 3. Voicemail & Callback Webhooks
Integrates with **Dialpad** to process rep dialer activities:
*   Registers webhooks to catch outbound call outcomes.
*   If a client drops a voicemail, the audio stream is caught, uploaded securely to Cloudflare R2, and routed to the Rep Dashboard for follow-ups.

#### 4. Headless PDF & Image Generator (`leadPreviewPdf.ts`)
*   Launches an in-process headless **Chromium (Puppeteer)** browser.
*   Navigates to the portal mockup page, waits for animation renders, and captures screenshots.
*   Generates a print-ready, high-resolution PDF proposal summarizing their custom website layout to email to the prospect.

---

## 4. Database Schema Specification (Drizzle ORM)

Below is an overview of the core database tables defined in `packages/db/src/schema/`:

### `leads` Table
Stores primary sales leads scraped from directories or input manually.
*   `id`: serial primary key.
*   `name`: varchar. Clinician's full name.
*   `practice`: varchar. Practice name.
*   `phone`, `email`: varchar. Contact details.
*   `currentWebsite`: varchar. URL of their existing website.
*   `city`, `state`, `postalCode`: varchar. Primary location attributes.
*   `qcStatus`: status enum. Manages quality control lifecycle (`pending`, `passed`, `failed`).

### `prospect_portals` Table
Stores public-facing configuration states for the generated preview portals.
*   `id`: serial primary key.
*   `leadId`: integer. Foreign key referencing `leads.id`.
*   `slug`: unique varchar. Secure random identifier in portal URLs.
*   `accessToken`: varchar. Auth token for secure client actions.
*   `customizations`: jsonb. Stores active colors, font families, active template keys, and chosen custom domain name.
*   `selectedAddons`: jsonb. List of subscribed add-ons (e.g., booking, blog, white-glove setup).

### `change_requests` Table
Tracks changes requested directly by the client inside the portal (e.g., "Change background to blue").
*   `id`: serial primary key.
*   `portalId`: integer. Foreign key referencing `prospect_portals.id`.
*   `notes`: text. Description of the requested changes.
*   `status`: enum (`pending`, `completed`, `ignored`).

### `stripe_customers` & `stripe_sales` Tables
Tracks payment statuses and subscription references.
*   `customerId`: unique Stripe customer ID.
*   `subscriptionId`: Stripe subscription reference.
*   `saleStatus`: status of their plan (`active`, `past_due`, `canceled`).

---

## 5. Integration Protocols

### 1. Stripe Payment Gateway
*   **Checkout:** Uses Stripe Checkout sessions running in `subscription` mode.
*   **Billing Address & Taxes:** The system sets `billing_address_collection: "required"` and `automatic_tax: { enabled: true }`. This enables Stripe Tax to compute regional tax rates.
*   **Refund System (`refundInvoice`):** Administrators can trigger credit card refunds directly from the admin dashboard using an idempotency key to prevent double charge backs.

### 2. Resend Email Flows
*   Triggers transactional notifications using the `resend` SDK.
*   Outbound templates are fully localized. If a lead's preferred locale is Spanish, the onboarding, proposals, and system notices are dispatched using the corresponding Spanish translations.

### 3. Cloudflare R2 Audio Pipeline
*   Voices and audio clips are streamed using HMAC S3 signatures.
*   Assets are generated with unique pre-signed URLs that expire after 1 hour to prevent unauthorized access.
