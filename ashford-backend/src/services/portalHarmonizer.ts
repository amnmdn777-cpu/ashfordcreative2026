// 2026-05-21 — Stub. The holistic harmonizer (design + copy + marketing
// review) was lost during Sprint 2 cleanup. The route in admin/prepQueue.ts
// keeps responding so the admin UI doesn't break, but the response is
// empty until the engine is rebuilt.

export async function runHarmonization(_leadId: number): Promise<{
  suggestions: unknown[];
  status: "stub";
}> {
  return { suggestions: [], status: "stub" };
}
