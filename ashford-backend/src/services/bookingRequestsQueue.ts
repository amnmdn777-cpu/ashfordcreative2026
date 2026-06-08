import { logger } from "../lib/logger";

/**
 * LOT 3.2 — online_booking SKELETON.
 *
 * In-memory booking-request queue. No DB table is created yet; when the
 * first paid Pro subscription comes in we'll migrate this to a real
 * `booking_requests` table and wire the one-tap-approve email + SMS flow.
 *
 * TODO(online-booking):
 *   - Create DB table `booking_requests` (prospect_name, phone, requested_slot, sub_id, status)
 *   - POST /api/booking/request public endpoint
 *   - Email + SMS to therapist with one-tap-approve link
 *   - Approval webhook -> sync slot to Google/Outlook/iCal
 *   - 24h reminder + self-reschedule link
 */

export type BookingRequest = {
  id: string;
  subscriptionId: number;
  prospectName: string;
  prospectPhone: string;
  prospectEmail: string | null;
  requestedSlotIso: string;
  status: "pending" | "approved" | "declined";
  createdAtIso: string;
};

const inMemoryRequests: BookingRequest[] = [];

export function enqueueBookingRequest(
  req: Omit<BookingRequest, "id" | "status" | "createdAtIso">,
): BookingRequest {
  const row: BookingRequest = {
    ...req,
    id: `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: "pending",
    createdAtIso: new Date().toISOString(),
  };
  inMemoryRequests.push(row);
  logger.info(
    { id: row.id, sub: row.subscriptionId },
    "[online-booking] booking request enqueued (no-op stub)",
  );
  // TODO(online-booking): fire approval email + SMS to therapist
  return row;
}

export function listBookingRequests(subId?: number): BookingRequest[] {
  if (subId == null) return [...inMemoryRequests];
  return inMemoryRequests.filter((r) => r.subscriptionId === subId);
}

export function approveBookingRequest(id: string): BookingRequest | null {
  const r = inMemoryRequests.find((x) => x.id === id);
  if (!r) return null;
  r.status = "approved";
  logger.info({ id }, "[online-booking] approved (no-op stub)");
  // TODO(online-booking): create calendar event, confirm SMS+email to prospect
  return r;
}
