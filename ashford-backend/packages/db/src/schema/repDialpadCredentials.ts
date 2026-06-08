import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { salesReps } from "./reps";

/**
 * Per-rep Dialpad OAuth credentials.
 *
 * Tokens are stored AES-GCM-encrypted under `DIALPAD_TOKEN_ENC_KEY`
 * (server-only env). Plaintext NEVER appears in this table or in logs —
 * the on-disk format is `iv.ciphertext.authTag`, all base64.
 *
 * One row per rep (unique salesRepId). When a rep disconnects we DELETE
 * the row outright so re-connecting starts a fresh OAuth round-trip.
 *
 * `dialpadUserId` is mirrored as a separate plaintext column so the
 * webhook handler can match an inbound call (`internal_number` /
 * `target.id`) to the owning rep WITHOUT touching the encrypted blob.
 */
export const repDialpadCredentials = pgTable(
  "rep_dialpad_credentials",
  {
    id: serial("id").primaryKey(),
    salesRepId: integer("sales_rep_id")
      .notNull()
      .unique()
      .references(() => salesReps.id, { onDelete: "cascade" }),
    // Encrypted "iv.cipher.tag" base64 strings — see dialpadTokenCrypto.ts
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Plaintext: the rep's Dialpad numeric user_id. Needed by the webhook
    // ingest path to match an inbound call to the owning rep before
    // decrypting any tokens. Indexed for that lookup.
    dialpadUserId: varchar("dialpad_user_id", { length: 64 }).notNull(),
    dialpadEmail: varchar("dialpad_email", { length: 200 }),
    // Granted scopes as a JSON array — used to surface "Vi enabled" badge
    // in the rep settings UI without hitting Dialpad each load.
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    dialpadUserIdx: index("rep_dialpad_user_idx").on(t.dialpadUserId),
  }),
);

export type RepDialpadCredential = typeof repDialpadCredentials.$inferSelect;
export type InsertRepDialpadCredential =
  typeof repDialpadCredentials.$inferInsert;
