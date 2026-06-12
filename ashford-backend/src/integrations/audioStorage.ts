import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

// Object Storage helpers for call audio, backed by S3-compatible storage
// (Cloudflare R2 / AWS S3 / Backblaze B2). Soft-fails (returns null) when the
// S3 config is incomplete so dev/voice-disabled runs work without storage.
//
// Migrated off the Replit Object Storage sidecar (GCS via 127.0.0.1:1106),
// which only existed inside Replit and silently failed everywhere else.

let cachedClient: S3Client | null = null;

const isConfigured = (): boolean =>
  !!(
    env.s3Bucket &&
    env.s3Endpoint &&
    env.s3AccessKeyId &&
    env.s3SecretAccessKey
  );

const getClient = (): S3Client | null => {
  if (cachedClient) return cachedClient;
  if (!isConfigured()) return null;
  cachedClient = new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint,
    // R2 (and most S3-compatibles) require path-style addressing.
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.s3AccessKeyId as string,
      secretAccessKey: env.s3SecretAccessKey as string,
    },
  });
  return cachedClient;
};

// Fetch a Twilio recording (basic-auth) and upload to the audio bucket.
export const uploadAudioFromTwilioUrl = async (
  twilioRecordingUrl: string,
  objectKey: string,
): Promise<string | null> => {
  const client = getClient();
  if (!client) {
    logger.warn(
      { objectKey },
      "audioStorage: S3 not configured — skipping upload (dev fallback)",
    );
    return null;
  }
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    logger.warn(
      { objectKey },
      "audioStorage: Twilio credentials missing — cannot fetch recording",
    );
    return null;
  }

  // .mp3 suffix forces audio (vs JSON metadata).
  const audioUrl = twilioRecordingUrl.endsWith(".mp3")
    ? twilioRecordingUrl
    : `${twilioRecordingUrl}.mp3`;

  const basicAuth = Buffer.from(
    `${env.twilioAccountSid}:${env.twilioAuthToken}`,
  ).toString("base64");

  const res = await fetch(audioUrl, {
    headers: { authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) {
    logger.error(
      { status: res.status, audioUrl },
      "audioStorage: Twilio recording fetch failed",
    );
    return null;
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.s3Bucket as string,
        Key: objectKey,
        Body: buffer,
        ContentType: "audio/mpeg",
      }),
    );
    return objectKey;
  } catch (err) {
    logger.error({ err, objectKey }, "audioStorage: S3 upload failed");
    return null;
  }
};

// Upload an arbitrary object (e.g. a rep-uploaded lead hero image) to the
// bucket. Returns true on success, false when storage isn't configured or the
// put fails. Reuses the same S3-compatible client as call audio.
export const uploadObject = async (
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<boolean> => {
  const client = getClient();
  if (!client) {
    logger.warn({ objectKey }, "storage: S3 not configured — skipping upload");
    return false;
  }
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.s3Bucket as string,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
    return true;
  } catch (err) {
    logger.error({ err, objectKey }, "storage: object upload failed");
    return false;
  }
};

// Short-lived signed READ URL for inline <audio src=...>. Default 24h TTL.
export const presignedAudioUrl = async (
  objectKey: string,
  ttlSec = 86_400,
): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: env.s3Bucket as string,
        Key: objectKey,
      }),
      { expiresIn: ttlSec },
    );
  } catch (err) {
    logger.warn(
      { err, objectKey },
      "audioStorage: failed to mint presigned URL",
    );
    return null;
  }
};

// Server-side fallback when presigned URLs aren't available.
export const streamAudioObject = async (
  objectKey: string,
): Promise<{ buffer: Buffer; contentType: string } | null> => {
  const client = getClient();
  if (!client) return null;
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: env.s3Bucket as string,
        Key: objectKey,
      }),
    );
    if (!out.Body) return null;
    const bytes = await out.Body.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: out.ContentType ?? "audio/mpeg",
    };
  } catch (err) {
    logger.warn({ err, objectKey }, "audioStorage: download failed");
    return null;
  }
};

export const isAudioStorageConfigured = (): boolean => isConfigured();
