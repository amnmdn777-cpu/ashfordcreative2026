import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

/**
 * Anthropic client factory that works both on Replit and anywhere else.
 *
 * Historically the enrichment AI (aiSynthesis / aiDesignAudit) required the
 * Replit AI proxy (`AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + key), which only
 * resolves inside Replit. Off Replit (e.g. Railway) that left these features
 * permanently disabled even with a valid `ANTHROPIC_API_KEY`.
 *
 * Resolution order:
 *   1. Replit AI proxy when both proxy vars are set (routes through Replit
 *      billing — preferred on Replit).
 *   2. Direct Anthropic API with a raw `ANTHROPIC_API_KEY` (works anywhere).
 *   3. null — caller soft-disables the feature.
 */
export const isAnthropicConfigured = (): boolean =>
  (!!env.aiAnthropicBaseUrl && !!env.aiAnthropicApiKey) || !!env.anthropicApiKey;

export const getAnthropicClient = (): Anthropic | null => {
  if (env.aiAnthropicBaseUrl && env.aiAnthropicApiKey) {
    return new Anthropic({
      baseURL: env.aiAnthropicBaseUrl,
      apiKey: env.aiAnthropicApiKey,
    });
  }
  if (env.anthropicApiKey) {
    return new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return null;
};
