# Ashford Health Creative — Bug Fix Report

**Date:** 15 June 2026
**Prepared for:** Amine Madani
**Scope:** Linear tickets ASH-8 → ASH-12, plus the Dialpad call-routing fix and the AI call-summary feature.

All fixes are committed and deployed to the `staging` branch (live site).

---

## Summary

| # | Ticket | Issue | Status |
|---|--------|-------|--------|
| 1 | ASH-9 | Setting lead temperature returned a 500 error | ✅ Fixed |
| 2 | ASH-12 | "Add note" failed with a 500 (duplicate key) | ✅ Fixed |
| 3 | ASH-10 | Preview "open" tracking counted internal/rep views | ✅ Fixed |
| 4 | ASH-8 | Preview editor: image wouldn't upload/show + template didn't save | ✅ Fixed |
| 5 | ASH-11 | Direct Caller rang the handheld instead of the computer | ✅ Fixed (code) |
| 6 | — | Calls rang the owner's Dialpad, not the sales rep's | ⚙️ Needs 2 env vars |
| 7 | — | AI call summaries not shared with rep + owner | ✅ Fixed (code) — needs Dialpad config |

---

## 1. ASH-9 — Temperature change returned 500

**Problem:** Clicking a temperature (Cold / Lukewarm / Hot) on a lead failed with a server error.

**Root cause:** Two parts —
1. The backend handler referenced helpers that weren't wired up, so the request errored.
2. The frontend was calling the endpoint same-origin against the site host (which has no API), instead of the backend API.

**Fix:** Wired the backend ownership check + id parsing correctly, and routed the temperature call through the proper backend API.

**How to verify:** Open a lead → click a temperature → it saves with no error, and persists on reload.

---

## 2. ASH-12 — "Add note" failed with a 500

**Problem:** Reps couldn't add or edit a rep note; it returned a duplicate-key server error.

**Root cause:** A recent data sync inserted rows with explicit IDs without advancing the database's ID counters, so the next insert collided with an existing ID.

**Fix:** Reset the ID sequences on all affected tables so new inserts get fresh IDs.

**How to verify:** Open a lead → add a rep note → it saves and appears immediately.

---

## 3. ASH-10 — Preview opens counted internal views

**Problem:** The "lead opened the preview" signal fired even when the rep or team viewed the preview internally, inflating engagement/hot-lead signals.

**Root cause:** Internal previews used the same tracking path as the prospect-facing portal, with no way to distinguish them.

**Fix:** Internal/rep views now send a marker (`X-Ashford-Internal` header / `?internal=1`) that the backend recognizes and **excludes** from open tracking. Only genuine prospect opens count.

**How to verify:**
- Open the prospect link in a clean browser (no marker) → counts as an open.
- Open it from inside the app / rep preview → does **not** count.

---

## 4. ASH-8 — Preview editor: image + template not saving

**Problem:** In the portal/preview editor, the hero image wouldn't upload or display, and selecting a different template didn't save.

**Root cause:**
1. There was no real upload + serve path for the hero image.
2. The template selection was being blocked by a field lock meant for other fields.

**Fix:**
- Added a real hero-image **upload** endpoint and a **serve** route (stored in object storage, served from the API host).
- Added upload UI in the editor with a thumbnail preview.
- Removed the template lock so the selected template always saves.

**How to verify:** Open the portal editor → upload a hero image (it shows a preview) → change the template → save → reload → both persist and render in the prospect portal.

---

## 5. ASH-11 — Direct Caller rang the handheld, not the computer

**Problem (rep: Candice / Sarah):** The in-app Direct Caller asked the rep to pick up a **handheld** instead of letting them call from the **computer**, so reps worked around it with Dialpad Direct.

**Root cause:** Several layers —
1. The Call button opened a dead `dialpad.com/call?...` link instead of placing a call.
2. The backend told Dialpad to ring **all** devices, so the handheld grabbed the call.
3. After targeting a single device, it picked the **web** client only — which missed the rep when they had the **desktop app** open.
4. The owner/admin account couldn't place calls at all (403), and failures were silent (no error shown).

**Fix:**
- Call button now uses the **in-app dialer** → backend places the call via Dialpad's API.
- Backend rings the rep's **computer** (desktop/web app), not the handheld. When the rep has **no handheld**, it rings all their computer clients so whichever is open receives the call.
- **Admins/owners can now place calls** (no more 403).
- A clear **"Call failed"** banner now shows when a call can't be placed.

**How to verify:** Rep opens their **Dialpad app** (desktop or dialpad.com) on the computer → clicks **Call** on a lead → their **computer** rings → answer → it connects to the prospect.

---

## 6. Calls rang the owner, not the sales rep

**Problem:** Every Direct Caller call rang **Amine** (the owner), not the sales rep.

**Root cause:** `DIALPAD_USER_ID` pointed to the owner's Dialpad seat (Ashford H / amnmdn777), so all calls were placed from that seat.

**Fix (action required — 2 env vars on the `backend` service):**
```
DIALPAD_USER_ID=5456952820310016     # Candice Heyns
DIALPAD_FROM_NUMBER=+18323771924     # Candice's number
```
After redeploy, calls ring **Candice** and show **her** number to the prospect.

> If more reps are added later, switch on the per-rep "Connect Dialpad" flow (already built) so each rep calls from their own number.

---

## 7. AI call summaries shared with rep + owner

**Request:** After each call, the AI (Vi) transcript/summary should be shared with **both Candice and Amine**.

**What was built (code, deployed):**
- When Dialpad's AI produces a call summary, the app saves it to the lead, **notifies the rep in-app**, and **emails the summary + next steps to the owner address(es)**.
- The owner email now accepts **multiple recipients** (so it reaches both Candice and Amine).

**Already done (by us, via the Dialpad API):**
- ✅ Webhook registered → `https://backend-production-b774.up.railway.app/api/webhooks/dialpad`
- ✅ Call event subscription created (`hangup` + `postcall`, recording enabled)
- ✅ A 5-minute backfill added in the app to pull each call's transcript + Vi summary once it's ready (Vi processes a few minutes after the call ends)

**Action required from Amine (workspace settings we can't change via API):**
1. Enable **Call Recording + Vi (AI)** on the workspace / Candice's seat — without this, Dialpad produces no transcripts/summaries.
2. Ensure the seat has the **`recordings_export`** permission.
3. Set the env var so summaries email to both:
   ```
   OWNER_NOTIFICATION_EMAIL=candice@ashfordhealthcreative.com,<Amine's email>
   ```

Once **Vi + Recording** are on, every call auto-generates a transcript + summary, saved to the lead and emailed to both Candice and Amine.

---

## Bonus — Portal emails reply to Candice

Personalized portal emails Candice sends now go out **From** and **Reply-To** `candice@ashfordhealthcreative.com`, so a client's reply lands directly in her inbox.

---

## What's left on your side

1. **Set the 2 Dialpad env vars** (#6) → calls ring Candice.
2. **Enable Vi + Call Recording + the webhook** in Dialpad (#7) → AI summaries start flowing.
3. **Set `OWNER_NOTIFICATION_EMAIL`** to both addresses (#7).

Everything else is fixed and live.
