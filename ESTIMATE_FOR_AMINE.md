# Estimate — CRM Wishlist & Prospect Questions

**Prepared for:** Amine Madani
**From:** Maaz
**Date:** 16 June 2026

I went through the actual system for each item. A lot of this already has the groundwork built, so I've kept the pricing lean. Below is my technical take, the **flow** (how it works), the **effort**, and a **minimum price** per feature — plus a suggested order and phased totals.

> Note on scope: **this is not a rebuild.** Every item below adds to the existing platform — the dashboard, leads, portals, calling, and email are already live. We're extending, not building from scratch, which is why the numbers are moderate.

---

## A) Salesperson CRM Wishlist

### A1 — Lead Scoring & Qualification Grid
**Take:** Very doable. Leads already have a temperature field, an AI lead score, and a notes journal — so we mostly add structured fields.

**Flow:**
1. Add 4 structured fields to each lead:
   - **Lead type** — dropdown: Solo Practitioner / Practice / Clinical Centre
   - **Accredited** — Yes/No
   - **Owns a website** — Yes/No (can pre-fill from the website we already store)
   - **Offers online sessions** — Yes/No
2. Add a **"Qualification" panel** on the lead page she fills during research / live on a call
3. **Status/temperature** relabeled to **Warm / Medium / Hot**, editable any time
4. **Research & call notes** reuse the existing notes journal

**Effort:** ~2 days   **Price:** **$130**

---

### A2 — Easy Editing of Contact Info (multiple phones & emails)
**Take:** Today each lead has one phone + one email. We add a contacts table so she can keep several.

**Flow:**
1. New `lead_contacts` table — type (phone/email), value, label ("mobile / office"), primary flag
2. **Inline add / edit / delete** of phones and emails directly on the lead record
3. The **primary** phone/email still drives calling and emailing

**Effort:** ~2 days   **Price:** **$120**

---

### A3 — Filtering & Sorting
**Take:** The list view and the database indexes already exist — this just needs the filter UI and query params. Depends on A1 (the fields must exist first).

**Flow:**
1. Filter bar on the lead list: **Status, Date, Lead type, Rep (owner)**
2. Sort so the **hottest / freshest** opportunities surface at the top

**Effort:** ~1.5 days   **Price:** **$110**
*Ships with or right after A1.*

---

### A4 — File Attachments per Lead
**Take:** We already have cloud storage wired up (used for audio + portal images), so native upload is easy. Google Drive is the heavier part (Google OAuth) — recommend it as an optional add-on.

**Flow — Part 1 (native upload, do first):**
1. New `lead_attachments` table + upload endpoint (reuse existing storage)
2. Upload **PDFs / images / docs** directly onto the lead
3. Files stay **bound to that lead** — download / delete, available for research & handovers
   **Effort:** ~2 days   **Price:** **$130**

**Flow — Part 2 (Google Drive, optional add-on):**
1. Google OAuth connection
2. **Link / attach Drive files or Docs** to a lead
   **Effort:** ~2 days   **Price:** **$130**

**Recommendation:** native upload first (covers most of the need); add Drive only if she needs live Drive links.

---

### A5 — Internal Q&A / Notes Thread with History
**Take:** Largely built already — we have an append-only notes journal (timestamped, with edit history) and a full audit log per lead.

**Flow:**
1. Add **@mention / tag** a teammate and **reply** to a tag
2. **Notify** the tagged person (reuse the existing notifications)
3. Show the **who-did-what-when** history inline on the lead

**Effort:** ~2 days   **Price:** **$120**

---

### A6 — Company Email Address for the Rep
**Take:** **Already delivered** in ASH-13 — Candice has `candice@ashfordhealthcreative.com`, and portal emails send From/Reply-To that address.

**No extra charge** — already covered, no double-billing.

---

## B) Prospect / Client Questions (technical answers)

### B1 — Keep Her Current Domain / URL
**Answer: Yes — it's just configuration.** She keeps her domain; we point its DNS at the new site and keep her email records intact. No rebuild, low risk.

**Effort:** ~0.5–1 day (config)   **Price:** folded into onboarding (~$30 or included)

---

### B2 — Final Approval on All Copy Before Go-Live
**Take:** We already have a preview state + internal quality check, but not a *client-facing* sign-off yet.

**Flow:**
1. Add a client-facing **"Approve copy"** action on the portal
2. An **`approvedAt`** state that **gates publishing** — nothing goes live until she approves
3. Rep/owner **notified** on approval
   → clean **Preview → Approve → Publish**

**Effort:** ~3 days   **Price:** **$200**

---

### B3 — What Happens If She Cancels After the 3-Month Trial
**Answer (technical): a clean exit is straightforward.**
- Her **existing WordPress site stays untouched** the whole time — we never migrate or delete it.
- Going back = **point her domain's DNS back to WordPress** (propagates in minutes–hours).
- **No data export needed** (her WP content never left WP). Nothing blocks a clean exit.

**Effort:** ~0.5–1 day (documentation + keep WP live during trial)   **Price:** ~$30 or included
*Business/contract side: handled by you.*

---

## Suggested Build Order

**Phase 1 — CRM core (daily-use, unlocks the rest):**
1. **A1** Qualification grid (foundational)
2. **A3** Filtering & sorting (right after A1)
3. **A2** Multiple phones/emails
4. **A5** Notes thread + history
5. **A4** Native file upload

**Phase 2 — Extras:**
6. **B2** Client approve → publish
7. **A4** Google Drive add-on (only if needed)
8. **B1 / B3 / A6** — config + answers (fold into onboarding)

---

## Price Summary (minimum / bundled)

| Item | Effort | Price |
|------|--------|-------|
| A1 — Qualification grid | ~2 d | $130 |
| A2 — Multiple phones/emails | ~2 d | $120 |
| A3 — Filtering & sorting | ~1.5 d | $110 |
| A4 — File upload (native) | ~2 d | $130 |
| A5 — Notes thread + history | ~2 d | $120 |
| A4 — Google Drive (optional) | ~2 d | $130 |
| B2 — Approve → publish | ~3 d | $200 |
| A6 — Company email | done | — |
| B1 — Keep domain | ~0.5–1 d | ~$30 / incl. |
| B3 — Clean cancel/rollback | ~0.5–1 d | ~$30 / incl. |

**Phase 1 (A1 + A3 + A2 + A5 + A4 native):** **$550**
**Phase 2 (B2 + A4 Drive + B1/B3):** **$350**
**Everything bundled:** **~$850**

> Recommendation: start with **Phase 1** — it's the daily CRM work the rep needs and it unlocks the filtering/qualification. Phase 2 (the client approval flow + Drive) can follow.

---

## Why the price is reasonable, not a full-build cost
Several pieces already exist and lower the cost:

| Already built (reused) | Net-new build |
|---|---|
| Temperature, AI lead score, notes journal + edit history, audit log, cloud storage, portal lifecycle + QC, company email (ASH-13) | Lead-type/accredited/website/online fields, multi-contact table, filter/sort UI, attachments + Drive OAuth, tagging/threads, client approve→publish step |
