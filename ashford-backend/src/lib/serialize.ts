// Convert Date fields recursively to ISO strings for JSON output.
export const dateToIso = <T,>(value: T): T => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map(dateToIso) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = dateToIso(v);
    }
    return out as unknown as T;
  }
  return value;
};
