# Next Milestone — Estimate & Technical Plan

**Prepared for:** Amine Madani
**Date:** 16 June 2026
**Scope:** Salesperson CRM wishlist (A1–A6) + prospect/client questions (B1–B3)

Each item below has: **current state** (what already exists), **approach** (how we'd build it), **effort**, and **price**. A suggested build order and a phased quote are at the end.

> Key context: I checked the actual data model. Several of these are **partly built already**, which keeps cost down — noted per item.

---

# PART A — Salesperson CRM / Lead Workspace

## A1. Lead Scoring & Qualification Grid

**What's already there:**
- Leads already have a **`temperature`** field (currently Cold / Lukewarm / Hot) and an **AI `leadScore`** (0–100 with a "why it's hot" breakdown).
- Free-text **research/call notes** already exist as a timestamped journal per lead.

**What's new:** structured qualification fields on each lead —
- `leadType` — dropdown: **Solo Practitioner / Practice / Clinical Centre** (new enum column, filterable)
- `accredited` — Yes/No (new)
- `ownsWebsite` — Yes/No (new — note we already store the lead's `currentWebsite`, so this can pre-fill)
- `offersOnline` — Yes/No (new)
- **Status/temperature** — relabel the existing field to **Warm / Medium / Hot** in the UI (reuse the existing column)
- **Research & call notes** — reuse the existing notes journal

**Approach:** Add 4 columns to the lead table + a dedicated **"Qualification" panel** on the lead detail page (rep + admin) that reads/writes them. Reuse temperature + notes.

**Effort:** 2–3 days  **Price:** $150–220

---

## A2. Easy Editing of Contact Info (multiple phones & emails)

**What's already there:** Each lead has a single `phone` + single `email`. Editing exists but is limited.

**What's new:** Support **multiple phones and emails per lead**, editable inline on the record.

**Approach:** Add a **`lead_contacts`** table (type = phone/email, value, label like "mobile/office", `isPrimary`). The primary still drives calling/emailing; the rest are stored alongside. Inline add/edit/delete UI on the lead page. (We keep the existing `phone`/`email` as the "primary" for backward compatibility.)

**Effort:** 2–3 days  **Price:** $150–220

---

## A3. Filtering & Sorting of the Lead List

**What's already there:** The list views exist and the DB is **already indexed** on status, owner (rep), city, and score. Sorting by score already happens.

**What's new:** Filter + sort UI by **Status (Hot/Warm/Cold)**, **Date**, **Lead type**, and **Rep (owner)**.

**Approach:** Add filter/sort query params to the leads API + a filter bar on the list view. **Depends on A1** (lead type + status must exist before we can filter on them).

**Effort:** 2–3 days  **Price:** $130–200
**Dependency:** ships with or after A1.

---

## A4. File Attachments per Lead

**What's already there:** We already have **cloud object storage** wired up (used for audio + the portal hero images), so native file upload is straightforward.

**What's new (two parts — recommend phasing):**

**Part 1 — Native upload (do first):** Upload PDFs/images/docs directly onto the lead. New **`lead_attachments`** table + upload endpoint (reuse existing storage) + a Files panel on the lead with download/delete. Each file stays bound to that lead.
- **Effort:** 2–3 days  **Price:** $150–220

**Part 2 — Google Drive integration (optional add-on):** Attach/link a Drive file or Doc to a lead. This needs Google OAuth + the Drive API — heavier and has ongoing auth maintenance.
- **Effort:** 2–3 days  **Price:** $150–220

**Recommendation:** Ship **native upload first** (covers 80% of the need); add Drive only if she actually needs live Drive links.

---

## A5. Internal Q&A / Notes Thread with History

**What's already there:** This is **largely built**. We already have an **append-only notes journal** (timestamped, with edit history) and a full **audit log** (who did what, when) per lead.

**What's new:** Turn the notes into a **collaboration thread** — @mention/tag a teammate, reply to a tag, and surface the existing per-lead history/audit trail in one timeline.

**Approach:** Extend the notes journal with tagging/replies + a notification when you're tagged (reuse the existing notification system), and render the audit history inline on the lead.

**Effort:** 2–3 days  **Price:** $150–220

---

## A6. Company Email Address for the Rep

**What's already there:** **Already delivered** in ASH-13 — Candice has `candice@ashfordhealthcreative.com`, and portal emails send From/Reply-To that address. The rep table already has an `email` field.

**What's new:** Essentially nothing — just confirm the rep's record uses the company address everywhere. **No double-charge.**

**Effort:** ~0.5 day (wire-up/confirm)  **Price:** included / $0–40

---

# PART B — Prospect / Client Questions (technical answers + light work)

## B1. Keep Her Current Domain / URL

**Answer: Yes — easy, it's just configuration.** She keeps her domain; we point its DNS at the new site. We already manage DNS coexistence with email (Resend/Hostinger), so this is a known, low-risk process per client.

**Approach:** Update her domain's DNS records to point at the new hosting; keep email records intact.

**Effort:** ~0.5–1 day per client (config)  **Price:** $40–80 (or folded into onboarding)

---

## B2. Final Approval on All Copy Before Go-Live

**What's already there:** Portals already have a **lifecycle** (draft → sent → expired) and an internal **QC/validation** system with field locks. So a preview state exists — but today it's an *internal* check, not a *client* sign-off.

**What's new:** A clean **Preview → Client Approves → Publish** flow: the prospect reviews the copy, hits **Approve**, and only then is it marked go-live (publish gated on approval).

**Approach:** Add a client-facing "Approve copy" action on the portal + an `approvedAt` state that gates publishing, with a notification to the rep/owner on approval.

**Effort:** 3–4 days  **Price:** $220–320

---

## B3. What Happens If She Cancels After the 3-Month Trial

**Answer (technical):** A **clean exit is straightforward** if we do it right:
- Her **existing WordPress site stays untouched** the whole time — we don't migrate or delete it.
- During the trial we serve the new site so that **going back = pointing her domain's DNS back** to WordPress. Propagates in minutes–hours.
- **No data export needed** (her WP content never left WP). Nothing blocks a clean exit.

**Light work:** Document the exact rollback steps + make sure our process keeps her WP live (not decommissioned) during the trial.

**Effort:** ~0.5–1 day (process + documentation)  **Price:** $40–80
**Business/contract side:** handled by you.

---

# Suggested Build Order

**Quick wins first (unlock the rest):**
1. **A1 Qualification grid** — foundational; A3 depends on it
2. **A3 Filtering & sorting** — ships right after A1
3. **A2 Multiple contacts** — high daily value, low risk
4. **A5 Notes thread + history** — mostly extending what exists
5. **A4 Native file upload** — storage already there

**Heavier / phase 2:**
6. **B2 Client approve → publish** — real new flow
7. **A4 Google Drive add-on** — only if needed
8. **B1 / B3 / A6** — mostly config + answers (fold into onboarding)

---

# Price Summary

| Item | Effort | Price |
|------|--------|-------|
| A1 — Qualification grid | 2–3 d | $150–220 |
| A2 — Multiple phones/emails | 2–3 d | $150–220 |
| A3 — Filtering & sorting | 2–3 d | $130–200 |
| A4 — File upload (native) | 2–3 d | $150–220 |
| A4 — Google Drive add-on (optional) | 2–3 d | $150–220 |
| A5 — Notes thread + history | 2–3 d | $150–220 |
| A6 — Company email | ~0.5 d | included / $0–40 |
| B1 — Keep domain | ~0.5–1 d | $40–80 |
| B2 — Approve → publish | 3–4 d | $220–320 |
| B3 — Clean cancel/rollback | ~0.5–1 d | $40–80 |

**Phase 1 (CRM core: A1 + A3 + A2 + A5 + A4 native):** ~10–15 days → **$730–1,080**
**Phase 2 (B2 approval flow + A4 Drive + B1/B3/A6):** ~6–8 days → **$450–740**

> Numbers are estimates and can be adjusted. **A6 is already covered** (ASH-13) and **B1/B3 are mostly answers**, so the real cost drivers are the CRM features (A1–A5) and the approval flow (B2).

---

## What's genuinely new vs. already built

| Already exists (lowers cost) | Net-new build |
|---|---|
| temperature, AI lead score, notes journal + edit history, audit log, object storage, portal lifecycle + QC, rep email (ASH-13) | leadType/accredited/ownsWebsite/offersOnline fields, multi-contact table, filter/sort UI, attachments table + Drive OAuth, tagging/threads, client approve→publish step |
