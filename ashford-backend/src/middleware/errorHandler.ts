import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid request payload",
        details: err.flatten(),
      },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }
  // Body-parser rejects an oversized request with a PayloadTooLargeError
  // (`type: 'entity.too.large'`, statusCode 413). Without this branch it
  // fell through to the generic 500 "Something went wrong" — exactly what
  // Candice saw when uploading a large file/photo (Bug#2 / EB#1). Return a
  // clear, actionable 413 instead so the UI can tell the rep the file is
  // too big rather than implying the server is broken.
  const maybe = err as { type?: string; statusCode?: number; status?: number };
  if (maybe?.type === "entity.too.large" || maybe?.statusCode === 413 || maybe?.status === 413) {
    return res.status(413).json({
      error: {
        code: "payload_too_large",
        message: "That file is too large to upload. Please use a file under 10 MB.",
      },
    });
  }
  logger.error({ err }, "unhandled error");
  return res.status(500).json({
    error: { code: "internal_error", message: "Something went wrong" },
  });
};
