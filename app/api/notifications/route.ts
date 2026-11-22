import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { notificationReads, notifications } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { getOperationalPeriod } from "../../../lib/operational-period";

function cleanCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

async function visibleNotifications(role: string, email: string) {
  const db = getDb();
  const { officialStartDate } = await getOperationalPeriod();
  return role === "admin"
    ? db.select().from(notifications).where(gte(notifications.createdAt, officialStartDate)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(60)
    : db.select().from(notifications).where(and(gte(notifications.createdAt, officialStartDate), eq(notifications.recipientRole, role), or(eq(notifications.recipientEmail, ""), eq(notifications.recipientEmail, email)))).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(60);
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await visibleNotifications(user.role, user.email);
    const ids = rows.map((item) => item.id);
    const reads = ids.length
      ? await getDb().select({ notificationId: notificationReads.notificationId }).from(notificationReads).where(and(eq(notificationReads.userEmail, user.email), inArray(notificationReads.notificationId, ids)))
      : [];
    const readIds = new Set(reads.map((item) => item.notificationId));
    const items = rows.map((item) => ({ ...item, isRead: readIds.has(item.id) }));
    return Response.json({ notifications: items, unread: items.filter((item) => !item.isRead).length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification load failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const markAll = payload.all === true;
    const id = cleanCount(payload.id);
    const visible = await visibleNotifications(user.role, user.email);
    const ids = markAll ? visible.map((item) => item.id) : visible.some((item) => item.id === id) ? [id] : [];
    if (ids.length) {
      await getDb().insert(notificationReads).values(ids.map((notificationId) => ({ notificationId, userEmail: user.email, readAt: new Date().toISOString() }))).onConflictDoNothing();
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification update failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
