import { z } from "zod";

export const CrisisResource = z.object({
  label: z.string(),
  number: z.string(),
  description: z.string(),
});

export const CRISIS_RESOURCES = [
  {
    label: "988 Suicide & Crisis Lifeline",
    number: "988",
    description: "Call or text 24/7 — free, confidential support.",
  },
  {
    label: "Crisis Text Line",
    number: "Text HOME to 741741",
    description: "Text-based support 24/7.",
  },
  {
    label: "SAMHSA National Helpline",
    number: "1-800-662-4357",
    description: "Treatment referral, 24/7, free, confidential.",
  },
  {
    label: "Trans Lifeline",
    number: "1-877-565-8860",
    description: "Peer support for trans people in crisis.",
  },
  {
    label: "Veterans Crisis Line",
    number: "988 then press 1",
    description: "For veterans and their families.",
  },
] as const;

export type CrisisResource = z.infer<typeof CrisisResource>;
