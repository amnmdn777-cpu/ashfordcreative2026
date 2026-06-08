import { db, calls, callTranscripts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { presignedAudioUrl, streamAudioObject } from "../integrations/audioStorage";
import { summarizeCall } from "./callSummary";

/**
 * Async pipeline kicked off by the recording-complete + voicemail-complete
 * webhooks. The webhook returns 200 immediately (Twilio retries on 5xx) and
 * `void transcribeCall(id)` runs in the background. Failures are logged
 * with retryable backoff but never bubble back to Twilio.
 *
 * Cost: Whisper is billed at $0.006 per minute. We round up to integer
 * cents at write time so the daily-cap accounting can sum without
 * touching floats.
 */

const OPENAI_TRANSCRIPTION_URL =
  "https://api.openai.com/v1/audio/transcriptions";
const MAX_ATTEMPTS = 3;

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const computeWhisperCostCents = (durationSec: number): number => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const cents = (durationSec / 60) * 0.6; // $0.006/min = 0.6¢/min
  return Math.max(1, Math.ceil(cents));
};

/**
 * Resolve the audio bytes for a call to a Blob the multipart form can
 * carry. We prefer streaming through our object-storage backend (so the
 * Twilio recording URL never leaks beyond our server), and fall back to
 * the presigned URL just in case the object hasn't materialized yet.
 */
const loadAudioBlob = async (
  objectKey: string,
): Promise<{ blob: Blob; filename: string } | null> => {
  const direct = await streamAudioObject(objectKey);
  if (direct) {
    return {
      blob: new Blob([new Uint8Array(direct.buffer)], { type: direct.contentType }),
      filename: objectKey.split("/").pop() ?? "audio.mp3",
    };
  }
  const url = await presignedAudioUrl(objectKey, 600);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return {
    blob: await res.blob(),
    filename: objectKey.split("/").pop() ?? "audio.mp3",
  };
};

export const transcribeCall = async (callId: number): Promise<void> => {
  const [row] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!row) {
    logger.warn({ callId }, "transcribeCall: call row not found");
    return;
  }
  const objectKey = row.recordingObjectKey ?? row.voicemailObjectKey;
  if (!objectKey) {
    logger.info({ callId }, "transcribeCall: no audio object key — nothing to transcribe");
    return;
  }
  if (!env.openaiApiKey) {
    logger.warn({ callId }, "transcribeCall: OPENAI_API_KEY missing — skipping (will leave transcript blank)");
    return;
  }

  const audio = await loadAudioBlob(objectKey);
  if (!audio) {
    logger.warn({ callId, objectKey }, "transcribeCall: audio unavailable");
    return;
  }

  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      const form = new FormData();
      form.append("file", audio.blob, audio.filename);
      form.append("model", "whisper-1");
      form.append("response_format", "verbose_json");

      const res = await fetch(OPENAI_TRANSCRIPTION_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${env.openaiApiKey}` },
        body: form,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // 5xx = retry; 4xx = give up (likely invalid file or auth).
        if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
          throw new Error(`whisper ${res.status}: ${text.slice(0, 200)}`);
        }
        logger.error(
          { callId, attempt, status: res.status, body: text.slice(0, 200) },
          "transcribeCall: whisper non-retriable error",
        );
        return;
      }
      const json = (await res.json()) as {
        text?: string;
        language?: string;
        duration?: number;
      };
      const text = (json.text ?? "").trim();
      const lang = (json.language ?? "").slice(0, 8) || null;
      const durationSec =
        Number.isFinite(json.duration) && json.duration! > 0
          ? Math.round(json.duration!)
          : (row.recordingDurationSec ?? row.durationSec ?? 0);
      const whisperCostCents = computeWhisperCostCents(durationSec);

      // Upsert on the unique callId — webhooks can fire twice (Twilio
      // retry, our own re-transcribe) and we don't want duplicate rows.
      await db
        .insert(callTranscripts)
        .values({
          callId,
          transcriptText: text || "(no speech detected)",
          transcriptLang: lang,
          whisperCostCents,
        })
        .onConflictDoUpdate({
          target: callTranscripts.callId,
          set: {
            transcriptText: text || "(no speech detected)",
            transcriptLang: lang,
            whisperCostCents,
            generatedAt: new Date(),
          },
        });

      logger.info(
        { callId, attempt, lang, durationSec, whisperCostCents },
        "transcribeCall: succeeded",
      );

      // Chain the summary asynchronously — failures are isolated.
      void summarizeCall(callId).catch((err) =>
        logger.warn({ err, callId }, "summarizeCall failed"),
      );
      return;
    } catch (err) {
      lastErr = err;
      logger.warn(
        { err, callId, attempt },
        "transcribeCall: transient failure, will retry",
      );
      // Exponential backoff: 1s, 2s, 4s.
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  logger.error({ err: lastErr, callId }, "transcribeCall: gave up after retries");
};
