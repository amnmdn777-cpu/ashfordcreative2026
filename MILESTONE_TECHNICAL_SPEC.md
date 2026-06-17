# Milestone — Technical Specification & Build Detail

**Project:** Ashford Health Creative
**Date:** 16 June 2026
**Scope:** Salesperson CRM wishlist (A1–A6) + prospect/client questions (B1–B3)
**Purpose:** Internal engineering detail behind the estimate — exact data model changes, endpoints, UI, dependencies, edge cases, and testing per feature.

> Grounding: every "current state" below was verified against the live schema and code (`packages/db/src/schema/*`, `routes/*`, `services/*`). This is an **extension** of the existing platform, not a rebuild.

---

## Architecture recap (what we're building on)

- **DB:** PostgreSQL + Drizzle ORM. Lead tables in `packages/db/src/schema/leads.ts`.
- **Backend:** Express + Zod. Rep routes under `/api/dashboard/*`, admin under `/api/admin/*`.
- **Frontend:** React + React Query + wouter. Rep app (`/sales`), admin app (`/admin`).
- **Storage:** S3/R2 object storage (`integrations/audioStorage.ts` → `uploadObject`) — already used for audio + portal hero images.
- **Notifications:** in-app (`notifications` table) + owner email fan-out (`services/notifications.ts`).
- **Audit:** `admin_audit_log` table + `writeAudit()` helper.

---

# PART A — Salesperson CRM / Lead Workspace

## A1 — Lead Scoring & Qualification Grid

### Current state
`leads` already has: `temperature` enum (`disqualifier|cold|lukewarm|hot`), AI `leadScore` + `scoreBreakdown`, and an append-only notes journal (`lead_rep_notes`). No structured qualification fields exist yet.

### Data model changes
Add to `leads` (one migration):
```ts
leadType:      pgEnum("lead_type", ["solo","practice","clinical_centre"])  // nullable
accredited:    boolean("accredited")        // nullable (unknown)
ownsWebsite:   boolean("owns_website")       // nullable; pre-fill from currentWebsite
offersOnline:  boolean("offers_online")      // nullable
```
- **Status/temperature:** reuse existing `temperature` column. Map UI labels → Warm = `lukewarm`, Medium = `cold`→ rename, Hot = `hot`. (Decision: relabel in UI only, keep DB enum stable; or add a 3-value `qual_status` enum if we want exact Warm/Medium/Hot persistence. Recommend UI relabel to avoid a data migration.)
- **Notes:** reuse `lead_rep_notes` (already there).

### Backend
- Extend the existing lead update endpoint (`PATCH /dashboard/leads/:id`) Zod schema with the 4 new fields (owned-by-rep + admin authorized).
- Add the fields to the lead read DTO (`services/leads.ts` sanitizer).

### Frontend
- New **"Qualification" panel** on the rep lead detail (`rep/pages/LeadDetail.tsx`) + admin lead detail: dropdown + 3 yes/no toggles + temperature picker (exists) + notes (exists).
- Optimistic update via React Query mutation.

### Edge cases
- `ownsWebsite` auto-suggested from `currentWebsite` but rep can override.
- Field locks: validated leads already lock some fields (`lead_field_locks`) — qualification fields stay editable.

### Effort: ~2 days (schema + endpoint + panel). **$130**

---

## A2 — Easy Editing of Contact Info (multiple phones & emails)

### Current state
`leads.phone` (single, notNull) + `leads.email` (single, nullable). Editing exists but limited; calling/SMS/email read `leads.phone`/`leads.email`.

### Data model
New table:
```ts
lead_contacts {
  id, leadId (fk cascade),
  kind: pgEnum("contact_kind", ["phone","email"]),
  value: varchar,
  label: varchar,            // "mobile", "office", "billing"...
  isPrimary: boolean,
  createdAt
}
```
- Backfill: copy existing `leads.phone`/`email` into `lead_contacts` as primary rows (one-shot script).
- Keep `leads.phone`/`email` as the **primary mirror** (updated when primary changes) so all existing call/SMS/email code keeps working with zero refactor.

### Backend
- CRUD: `GET/POST/PATCH/DELETE /dashboard/leads/:id/contacts`.
- Setting a new primary flips the mirror on `leads` + un-primaries the others (transaction).
- Validation: E.164 normalize for phones (reuse `normalizePhone`), email regex.

### Frontend
- Inline contacts editor on the lead page: list rows, add/edit/delete, "make primary" star.

### Edge cases
- Can't delete the last primary. Dedup on (leadId, kind, value).
- Opt-out (STOP) state is per-number — keep existing opt-out check on the primary.

### Effort: ~2 days. **$120**

---

## A3 — Filtering & Sorting

### Current state
List views exist; `leads` indexed on `status`, `claimed_by_rep_id`, `city`, `lead_score`. Available-leads already sorts by score. No filter UI / query params.

### Backend
- Extend the leads list endpoint with query params: `status`, `temperature`, `leadType`, `repId`, `createdFrom/To`, `sort` (date|temperature|score), `order`.
- Add index on `(lead_type)` and `(created_at)` if needed.

### Frontend
- Filter bar above the list (rep `AvailableLeads`/`MyLeads`, admin leads): chips/dropdowns for Status, Lead type, Rep, Date range; sort selector.
- Persist filter state in URL query (shareable, survives refresh).

### Dependency
Requires A1 (`leadType`) and the temperature labels.

### Effort: ~1.5 days. **$110**

---

## A4 — File Attachments per Lead

### Current state
Object storage already wired (`uploadObject(key, buffer, contentType)` in `audioStorage.ts`; serve via `streamAudioObject`). No attachments table.

### Part 1 — Native upload (recommended first)
**Data model:**
```ts
lead_attachments {
  id, leadId (fk cascade),
  storageKey: text,         // s3/r2 object key
  filename: varchar,
  contentType: varchar,
  sizeBytes: integer,
  uploadedByRepId: integer (fk),
  createdAt
}
```
**Backend:**
- `POST /dashboard/leads/:id/attachments` — multipart or base64; validate type (pdf/png/jpg/docx) + size cap (e.g. 25 MB); `uploadObject` → row.
- `GET /dashboard/leads/:id/attachments` — list.
- `GET /dashboard/attachments/:id` — streamed download (auth + ownership).
- `DELETE /dashboard/attachments/:id`.

**Frontend:** Files panel on the lead — drag/drop, list with icon/size/date, download, delete.

**Edge cases:** virus/type allowlist, size cap, orphan cleanup on lead delete (cascade + best-effort storage delete).

**Effort:** ~2 days. **$130**

### Part 2 — Google Drive (optional add-on)
**Approach:** Google OAuth (per rep or per workspace) → store token (reuse the encrypted-token pattern from `dialpadTokenCrypto.ts`) → Drive Picker to attach a file/Doc → store the Drive file id + link on `lead_attachments` (kind = "drive_link").
**Maintenance:** token refresh, scope consent, link permissions (the Drive file must be shared).
**Effort:** ~2 days. **$130**

> Recommendation: ship native first; Drive only if she needs live Drive links rather than uploaded copies.

---

## A5 — Internal Q&A / Notes Thread with History

### Current state
**Most of this exists.** `lead_rep_notes` is an append-only journal (timestamped, author, edit history via `originalBody`/`editedAt`). `admin_audit_log` records who-did-what per target. There's no tagging/threading or a unified per-lead history view.

### Data model
- Add `parentNoteId` (nullable fk to self) on `lead_rep_notes` for replies/threads.
- Add `mentions: jsonb` (array of rep ids) on the note.

### Backend
- Extend note create to parse @mentions → store + trigger `notify()` to each mentioned rep.
- New `GET /dashboard/leads/:id/activity` — merged timeline of notes + audit-log entries for that lead, newest first.

### Frontend
- Thread UI under notes: reply, @mention autocomplete (rep list), "you were tagged" notification.
- "History" tab rendering the merged activity timeline.

### Edge cases
- Append-only stays (no deletes — matches the #230 protection design). Mentions notify only active reps.

### Effort: ~2 days. **$120**

---

## A6 — Company Email Address for the Rep

### Current state
**Delivered in ASH-13.** `sales_reps.email` column exists. Candice = `candice@ashfordhealthcreative.com`; portal/lead emails already send From + Reply-To her company address (the From is derived from her display name).

### Work
Confirm `sales_reps.email` is set to the company address for each rep and surfaced in the "Talk to a human" portal panel. No new build.

### Effort: ~0.5 day (verify/wire). **Included / $0–40**

---

# PART B — Prospect / Client Questions

## B1 — Keep Her Current Domain / URL

### Technical picture
Pure DNS/config. She keeps her domain; we point it at the new hosting:
- **A / CNAME** record → the new site host.
- **Email DNS (MX/SPF/DKIM/DMARC)** left intact so her mail keeps working (we already manage Resend + Hostinger coexistence).
- TLS issued automatically by the host once DNS resolves.

No code. Per-client config, low risk.

### Effort: ~0.5–1 day per client. **~$30 / folded into onboarding**

---

## B2 — Final Approval on Copy Before Go-Live

### Current state
`prospect_portals` has a lifecycle (`draft → sent → expired`) and an internal QC/validation system (`qc_status`, `lead_field_locks`, `lead_qc_events`). There's a preview state — but no **client-facing** approval gate.

### Data model
Add to `prospect_portals`:
```ts
approvedAt: timestamp        // null until the client approves
approvedBy: varchar          // "client" | rep id (who recorded it)
```
Add `"approved"` (and optionally `"published"`) to `portal_lifecycle`.

### Backend
- `POST /public/portals/:slug/approve` (token-gated, client-facing) → sets `approvedAt`, transitions lifecycle, `notifyOwner` + rep notification.
- Publish path gated: a portal cannot be marked go-live until `approvedAt` is set.

### Frontend
- Client portal: an **"Approve this copy"** button + confirmation state ("Approved on <date>").
- Rep/admin: approval status badge on the lead; publish action disabled until approved.

### Edge cases
- Re-edit after approval → resets to pending (re-approval required).
- Audit each approval via `writeAudit`.

### Effort: ~3 days. **$200**

---

## B3 — Clean Cancel After the 3-Month Trial

### Technical picture
- Her **WordPress site is never touched** — we don't migrate, import, or decommission it. It stays live on its own host the entire trial.
- During the trial the new site is served so that **reverting = pointing her domain's DNS back to WordPress** (TTL-dependent, minutes–hours).
- **No data export** — her content never left WordPress.
- Nothing blocks a clean exit. The only safeguard is operational: **don't take her WP offline** during the trial.

### Work
Document the rollback runbook (DNS records to restore) + a checklist ensuring WP stays live.

### Effort: ~0.5–1 day (documentation). **~$30 / included**
*Business/contract side handled by the client.*

---

# Build Order & Dependencies

```
A1 (qualification fields) ──► A3 (filter/sort)      [A3 needs A1's fields]
A2 (contacts)              ── independent
A5 (notes thread)          ── extends existing notes/audit
A4 native (upload)         ── independent (storage ready)
─────────────────────────── Phase 1 ───────────────────────────
B2 (approve→publish)       ── extends portal lifecycle
A4 Drive (OAuth)           ── optional add-on
B1 / B3 / A6               ── config + answers
```

---

# Effort & Price Summary (minimum)

| Item | Effort | Price | Notes |
|------|--------|-------|-------|
| A1 — Qualification grid | ~2 d | $130 | reuses temperature + notes |
| A2 — Multiple phones/emails | ~2 d | $120 | new `lead_contacts` table |
| A3 — Filtering & sorting | ~1.5 d | $110 | depends on A1 |
| A4 — File upload (native) | ~2 d | $130 | storage already wired |
| A5 — Notes thread + history | ~2 d | $120 | mostly extends existing |
| A4 — Google Drive (optional) | ~2 d | $130 | Google OAuth |
| B2 — Approve → publish | ~3 d | $200 | new client-facing flow |
| A6 — Company email | ~0.5 d | incl. | ASH-13 done |
| B1 — Keep domain | ~0.5–1 d | ~$30 | config only |
| B3 — Clean cancel/rollback | ~0.5–1 d | ~$30 | documentation |

**Phase 1 (A1 + A3 + A2 + A5 + A4 native):** ~10 days → **$550**
**Phase 2 (B2 + A4 Drive + B1/B3):** ~6 days → **$350**
**Everything bundled:** **~$850**

---

# Testing & Delivery (applies to every item)
- Each feature: schema migration tested on a copy, endpoint tested with a real session, UI verified in the live app (same QA process used for the ASH-8…12 bug fixes).
- Ship per-feature to `staging` → verify → confirm with you before moving on.
- Deliverables: working feature on the live site + a short "how to use / how to verify" note per item.

---

## What's reused vs. net-new (why the cost is moderate)

| Already built (reused) | Net-new build |
|---|---|
| temperature, AI lead score, notes journal + edit history, audit log, object storage + serve, portal lifecycle + QC, notifications, encrypted-token pattern, rep email (ASH-13) | lead_type/accredited/owns_website/offers_online fields, `lead_contacts` table, filter/sort query layer + UI, `lead_attachments` + Drive OAuth, note threading/mentions, client approve→publish gate |
