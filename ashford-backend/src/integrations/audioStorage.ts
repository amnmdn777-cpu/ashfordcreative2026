import { Storage, type Bucket } from "@google-cloud/storage";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

// Object Storage helpers for call audio. Soft-fails (returns null) when
// DEFAULT_OBJECT_STORAGE_BUCKET_ID is unset so dev runs without storage.

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

let cachedStorage: Storage | null = null;
let cachedBucket: Bucket | null = null;

const getBucketId = (): string | null => env.objectStorageBucketId ?? null;

// Storage client wired to the Replit sidecar (external_account credentials).
const getStorage = async (): Promise<Storage | null> => {
  if (cachedStorage) return cachedStorage;
  cachedStorage = new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: "json",
          subject_token_field_name: "access_token",
        },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
  return cachedStorage;
};

const getBucket = async (): Promise<Bucket | null> => {
  if (cachedBucket) return cachedBucket;
  const id = getBucketId();
  if (!id) return null;
  const storage = await getStorage();
  if (!storage) return null;
  cachedBucket = storage.bucket(id);
  return cachedBucket;
};

// Fetch a Twilio recording (basic-auth) and upload to the audio bucket.
export const uploadAudioFromTwilioUrl = async (
  twilioRecordingUrl: string,
  objectKey: string,
): Promise<string | null> => {
  const bucket = await getBucket();
  if (!bucket) {
    logger.warn(
      { objectKey },
      "audioStorage: bucket unavailable — skipping upload (dev fallback)",
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

  const file = bucket.file(objectKey);
  await file.save(buffer, {
    contentType: "audio/mpeg",
    resumable: false,
  });
  return objectKey;
};

// Short-lived signed READ URL for inline <audio src=...>. Default 24h TTL.
export const presignedAudioUrl = async (
  objectKey: string,
  ttlSec = 86_400,
): Promise<string | null> => {
  const bucket = await getBucket();
  if (!bucket) return null;
  try {
    const [url] = await bucket.file(objectKey).getSignedUrl({
      action: "read",
      expires: Date.now() + ttlSec * 1000,
      version: "v4",
    });
    return url;
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
  const bucket = await getBucket();
  if (!bucket) return null;
  try {
    const [buf] = await bucket.file(objectKey).download();
    return { buffer: buf, contentType: "audio/mpeg" };
  } catch (err) {
    logger.warn({ err, objectKey }, "audioStorage: download failed");
    return null;
  }
};

export const isAudioStorageConfigured = (): boolean => !!getBucketId();
