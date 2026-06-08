import { z } from "zod";

export const CustomDevFeatureKey = z.enum([
  "intake_form",
  "patient_portal_link",
  "online_courses",
  "ecommerce",
  "video_library",
  "podcast_hosting",
  "appointment_booking_advanced",
  "multi_location",
  "directory_advanced",
  "blog_pro",
  "analytics_pro",
  "custom_other",
]);
export type CustomDevFeatureKey = z.infer<typeof CustomDevFeatureKey>;

export const CustomDevStatus = z.enum([
  "requested",
  "quoted",
  "sent",
  "paid",
  "declined",
]);
export type CustomDevStatus = z.infer<typeof CustomDevStatus>;

export const CreateCustomDevRequest = z.object({
  leadId: z.number().int().optional(),
  saleId: z.number().int().optional(),
  featureKeys: z.array(CustomDevFeatureKey).default([]),
  customDescription: z.string().max(4000).optional(),
});
export type CreateCustomDevRequest = z.infer<typeof CreateCustomDevRequest>;

export const QuoteCustomDevRequest = z.object({
  quotedAmountCents: z.number().int().min(5000).max(50000000),
  adminNote: z.string().max(4000).optional(),
});
export type QuoteCustomDevRequest = z.infer<typeof QuoteCustomDevRequest>;

export const CustomDevQuoteDto = z.object({
  id: z.number().int(),
  leadId: z.number().int().nullable(),
  saleId: z.number().int().nullable(),
  repId: z.number().int(),
  featureKeys: z.array(z.string()),
  customDescription: z.string().nullable(),
  status: CustomDevStatus,
  quotedAmountCents: z.number().int().nullable(),
  adminNote: z.string().nullable(),
  stripePaymentLinkUrl: z.string().nullable(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
  paidAt: z.string().nullable(),
});
export type CustomDevQuoteDto = z.infer<typeof CustomDevQuoteDto>;
