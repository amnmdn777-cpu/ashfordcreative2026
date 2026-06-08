import { z } from "zod";

export const HealthCheckResponse = z.object({
  status: z.string(),
  time: z.string().optional(),
  /**
   * Per-component status. Each value is `"ok"`, `"skipped"`, or a
   * human-readable failure reason (e.g. `"db timeout after 800ms"`).
   * Optional so older clients tolerating only `{ status }` still validate.
   */
  checks: z.record(z.string()).optional(),
  /** Component keys that failed — empty when status === "ok". */
  failed: z.array(z.string()).optional(),
  /** Total wall-clock time for the probe, in ms. */
  latencyMs: z.number().int().nonnegative().optional(),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;

export const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;
