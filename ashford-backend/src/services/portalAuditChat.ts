// 2026-05-21 — Stub. See portalAudit.ts note: chat-driven audit assistant
// was lost during Sprint 2 cleanup. Routes are kept wired so the UI
// doesn't 404, but every call returns a no-op shape.

type ChatTurn = { id: number; role: "user" | "assistant"; content: string };
type ChatResult = { turns: ChatTurn[]; proposals: unknown[]; status: "stub" };

export async function sendAuditChatMessage(_args: {
  leadId: number;
  auditId: number;
  content: string;
  adminId?: number;
}): Promise<ChatResult> {
  return { turns: [], proposals: [], status: "stub" };
}

export async function listAuditChat(_auditId: number): Promise<ChatTurn[]> {
  return [];
}

export async function applyAuditChatProposal(
  _proposalId: number,
  _adminId: number,
): Promise<{ ok: boolean; status: "stub" }> {
  return { ok: false, status: "stub" };
}

export async function rejectAuditChatProposal(
  _proposalId: number,
  _adminId: number,
): Promise<{ ok: boolean; status: "stub" }> {
  return { ok: false, status: "stub" };
}
