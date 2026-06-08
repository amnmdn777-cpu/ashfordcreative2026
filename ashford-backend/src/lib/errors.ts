export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "Unauthorized") =>
  new HttpError(401, "unauthorized", message);
export const forbidden = (message = "Forbidden", details?: unknown) =>
  new HttpError(403, "forbidden", message, details);
export const notFound = (message = "Not found") =>
  new HttpError(404, "not_found", message);
export const conflict = (message: string) =>
  new HttpError(409, "conflict", message);
export const tooMany = (message: string, details?: unknown) =>
  new HttpError(429, "too_many_requests", message, details);
export const serviceUnavailable = (message: string, details?: unknown) =>
  new HttpError(503, "service_unavailable", message, details);
