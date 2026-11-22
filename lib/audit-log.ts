import { getDb } from "../db";
import { auditLogs } from "../db/schema";

type AuditActor = { email: string; displayName: string; role: string };

export async function recordAuditLog(actor: AuditActor, input: { action: string; entityType?: string; entityId?: string | number; summary: string }) {
  try {
    await getDb().insert(auditLogs).values({
      action: input.action,
      entityType: input.entityType || "system",
      entityId: String(input.entityId || ""),
      summary: input.summary.slice(0, 500),
      actorEmail: actor.email,
      actorName: actor.displayName,
      actorRole: actor.role,
    });
  } catch {
    // Auditing must never block the operational update itself.
  }
}
