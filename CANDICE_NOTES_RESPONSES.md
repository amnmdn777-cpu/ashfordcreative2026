# Candice Notes — Response to Every Item

**For:** Amine
**From:** Maaz
**Date:** 17 June 2026

One row per note from `Candice_Notes_Tracker.xlsx`, with **Resolution / Fix**, **Why it happened**, and **Status / Owner**. Paste the last three columns back into your sheet.

**Status key:** ✅ FIXED (retest) · 📝 DATA UPDATED · 📤 SELF-SERVE (Candice can do it now) · 🔎 INVESTIGATE · ❓ NEEDS INFO · 🧭 DECISION (Amine) · 💡 NEW FEATURE · ➖ NO ACTION

---

## Bugs / features (most already fixed)

| Lead | Note | Resolution / Fix | Why it happened | Status |
|---|---|---|---|---|
| 251 | Can't upload images | **Fixed** (ASH-8). Upload now works on the lead page; reps can also upload from "Prepare preview". | The upload endpoint mishandled the base64 data URL, so saves silently failed. | ✅ FIXED |
| 251 | Preview-opened fires on internal/tech view | **Fixed** (ASH-10). Internal/rep views now send a marker the backend excludes from open-tracking. | Internal previews used the same tracking path as real client opens — no way to tell them apart. | ✅ FIXED |
| 522 | Can I edit a note after leaving it? | **Fixed** (ASH-12). Reps can edit their own notes (original is preserved in history). | Notes were append-only with no edit path. | ✅ FIXED |
| 555 | Direct Caller asks to pick up handheld | **Fixed** (ASH-11). Calls now ring the **computer** app; also corrected which Dialpad account places the call. | The dialer rang all devices (handheld grabbed it) + `DIALPAD_USER_ID` pointed at the owner, not the rep. | ✅ FIXED |
| 559 | Image vanishes + template reverts to Constellation | **Fixed** (ASH-8). Hero image persists and the chosen template is locked, including on the emailed copy. | Hero URL pointed at the wrong host and the template wasn't saved before send. | ✅ FIXED |
| 573 | Temperature update → Error 500 | **Fixed** (ASH-9). | Backend handler referenced un-wired helpers + the frontend called a no-API host. | ✅ FIXED |
| 573 | Will I be able to filter by temperature? | **Done** (Bundle 2). Filter bar now includes temperature/status. | New feature — now built. | ✅ FIXED |
| 573 | Can't upload a screenshot / Share won't work | **Fixed** (ASH-8) — same upload fix. | Same data-URL handling bug as the image upload. | ✅ FIXED |
| 559 | Can rep notes be pinned? | Not built yet — small **new feature** (pin a note to the top). | Feature request. | 💡 NEW FEATURE |

## Images (now self-serve — Candice uploads the correct one)

| Lead | Note | Resolution / Fix | Why it happened | Status |
|---|---|---|---|---|
| 251 | Generic image for Kevin | Candice uploads Kevin's real photo from **Prepare preview → Hero photo** (just shipped). | No first-party photo found, so it fell back to a generic image. | 📤 SELF-SERVE |
| 474 | Katie Grace's image missing | Same — upload her image from the rep page. | No allowed-source photo for this lead. | 📤 SELF-SERVE |
| 480 | Image not appearing on her side | Hero serve/persistence **fixed** (ASH-8); re-upload + retest. | Hero URL was built from the wrong host, so it 404'd on the client side. | ✅ FIXED → re-upload |
| 488 | Pixelated image | Upload fixed; Candice replaces with a better image. | Low-res source image; couldn't replace until upload was fixed. | 📤 SELF-SERVE |
| 524 | Image isn't him (a site picture) | Replace via rep upload. | Enrichment pulled a generic site image, not the practitioner. | 📤 SELF-SERVE |
| 559 | Will email once preview has her image | Upload Jocelyn's image, then send. | Image was missing pre-fix. | 📤 SELF-SERVE |
| 335 | Image not showing (purple is her colour) | Upload image (self-serve); palette can be set to purple in the preview. | Missing photo + default palette. | 📤 SELF-SERVE |

## Data mismatch — portal pulled the wrong identity (needs investigation)

| Lead | Note | Resolution / Fix | Why it happened (likely) | Status |
|---|---|---|---|---|
| 252 | Phone doesn't match Googled profile (Jaylen Bowman) | Needs Jaylen's **direct** contact — the data is her group's, not hers (see root cause). | Group-practice: import pulled **Sensible Care** (the parent company), not the individual. | 🔎 ROOT-CAUSE FOUND / ❓ |
| 322 | Briefing says Kandice Ewing runs '1 Therapy' but site shows Teri Johnson | Correct/clear the wrong website, then re-enrich. | Her `currentWebsite` was set to **1therapy.org (Teri Johnson's site)** — portal scraped the wrong person's content. | 🔎 ROOT-CAUSE FOUND |
| 474 | Portal mixes Katie Grace with 'Amazing Grace' + wrong state | **state OR→TX fixed** ✅. Practice name still needs her correct value. | Two import errors: practice mis-attributed + state wrong (TX area code/license). | ✅ PARTIAL FIX |
| 560 | Heading says 'Headway'/'Headlight' but her name is Judy | **Fixed** ✅ — name → "Judy Harun", junk URL practice cleared. Portal will refresh on re-prepare. | Import set the lead's **name to the directory/company ("Headlight")**, practice to a raw URL. | ✅ FIXED |

### Root-cause investigation (the "why" Amine asked for)

I pulled each lead's record + enrichment from the live DB. **All four share one root cause:** they're practitioners listed under a **group practice / directory**, and the **lead import attributed the wrong entity** (the parent company, a co-located practice, or the directory itself) to the individual. The portal then faithfully renders that bad source data — **so these are import/enrichment data errors, not portal-rendering bugs.**

- **252 (Jaylen Bowman):** practice = "Sensiblecare", email = referrals@**sensiblecare**.com → the **company's** referral contact, not Jaylen's. That's why the phone didn't match her Googled profile.
- **322 (Kandice Ewing):** `currentWebsite` = **1therapy.org**, which belongs to **Teri Johnson** — the portal scraped Teri's faith-based bio/lotus image under Kandice's name.
- **474 (Katie Grace):** practice mis-attributed to "Amazing Grace" (not in her bio) **and** state was **OR** despite a TX area code + TX license. → state fixed to TX.
- **560 (Judy Harun):** the lead's **name** was the company **"Headlight"** and practice was a **raw URL** → fixed to her name.

**Systemic conclusion:** the importer is grabbing **directory/parent-company names or co-located sites** for practitioners listed under groups. The durable fix is **import/enrichment validation** (reject company names/URLs in the name/practice fields, and verify website ownership) — part of the enrichment milestone. 252 & 322 are also the **multi-practitioner policy** question Amine still needs to decide.

**Fixed in the DB now:** 474 (state) and 560 (name + practice). 252 & 322 need either the correct individual data or the group-practice decision.

## Phone / email — need the correct value (can't fix in code)

| Lead | Note | Resolution / Fix | Status |
|---|---|---|---|
| 498 | Correct: (832) 422-6744 | **Updated** ✅ | 📝 DATA UPDATED |
| 524 | Correct: 713.529.6555 | **Updated** ✅ | 📝 DATA UPDATED |
| 531 | Update to 832-585-3561 | **Updated** ✅ | 📝 DATA UPDATED |
| 538 | Correct: (832) 408-1581 | **Updated** ✅ | 📝 DATA UPDATED |
| 244, 300, 469, 476, 503, 504, 516, 520, 522, 555, 566 | "Number cannot be reached" | Needs the correct number from Candice/research — nothing to fix in code; the listed number is wrong/disconnected. | ❓ NEEDS INFO |
| 527 | Email is incorrect | Needs the correct email. | ❓ NEEDS INFO |
| 252 | "Site" is just a Psychology Today listing | Confirmed — no real website (good prospect, not a bug). | ➖ NO ACTION |
| 541 | Opened preview but rep can't call her | Verify phone — **high priority** (lead is engaged). | ❓ NEEDS INFO (priority) |
| 566 | Number + email both look wrong (great lead) | Verify phone + email — prioritize. | ❓ NEEDS INFO (priority) |

## Decisions for Amine (business/policy — not tech)

| Lead | Note | What's needed | Status |
|---|---|---|---|
| 229, 322, 574 | Banked — multi-practitioner / group practice | A **policy**: do we sell group practices, and how? (blocks several leads) | 🧭 DECISION |
| 291 | Group positioning (Therapy Works Well / Rachelle Liao) | Written guidance + sales angle for linked bookings | 🧭 DECISION |
| 508 | Charge more to connect two Calendlys? | **Pricing decision** for multi-Calendly | 🧭 DECISION |
| 508 | More templates (animal / kids therapy)? | **Roadmap decision** to expand the template library | 🧭 DECISION |
| 335 | Add virtual-tour video to preview? | **Feature decision** (video-in-preview) | 🧭 DECISION |

## Quick answers / easy

| Lead | Note | Answer | Status |
|---|---|---|---|
| 508 | Is the playful kids-like template available? | I'll confirm against the live template list (we ship 7). | ❓ → ANSWER |
| 516 | Asks for a better domain than 'journeytopeace' | The app already has a domain-suggestion helper — I can generate options for her. | 📤 EASY |

## Status / check-ins (no code action)

| Leads | Note | Status |
|---|---|---|
| 251, 474, 539, 545, 547, 552, 573, 574 | "Is the lead ready?" / "tagging you" / voicemail left | Status notes — confirm portal readiness; no fix needed. | ➖ NO ACTION |

---

## Summary for Amine
- **✅ ~10 issues already FIXED** (ASH-8/9/10/11/12 + Bundle 2 filter) — Candice just refreshes & retests.
- **📝 4 phone numbers UPDATED** in the database.
- **📤 Image issues now SELF-SERVE** — Candice can change preview photos herself (just shipped).
- **🔎 4 data-mismatch leads** need per-lead investigation (portal/enrichment) — I can dig into each.
- **❓ ~13 phone/email items** need the correct value from Candice — not fixable in code.
- **🧭 ~7 items are decisions for you** (multi-practitioner policy, pricing, templates, video).

**The only remaining *technical* work** is: the 4 data-mismatch leads (252, 322, 474, 560), the "pin notes" feature, the template-availability answer, and domain suggestions for 516. Everything else is fixed, self-serve, needs-info, or a decision.
