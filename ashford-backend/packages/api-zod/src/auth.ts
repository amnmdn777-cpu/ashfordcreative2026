import { z } from "zod";

export const LoginRequest = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

// 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
export const SessionUser = z.object({
  id: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(["rep", "admin"]),
  promoCode: z.string(),
  hourlyRateCents: z.number().int(),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const AuthResponse = z.object({
  user: SessionUser,
});
export type AuthResponse = z.infer<typeof AuthResponse>;

// 2026-05-21 — `OnboardingAckRequest` removed along with the rep training gate.
