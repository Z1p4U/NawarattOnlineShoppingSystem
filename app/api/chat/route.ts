import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { departmentMessageReads, departmentMessages } from "../../../db/schema";
import { APP_ROLES, getAppUser } from "../../../lib/app-user";

const CHAT_ROLES = APP_ROLES.filter((role) => role !== "viewer");

async function visibleMessages(role: string) {
  const db = getDb();
  return role === "admin"
    ? db.select().from(departmentMessages).orderBy(desc(departmentMessages.createdAt), desc(departmentMessages.id)).limit(200)
    : db.select().from(departmentMessages).where(or(eq(departmentMessages.senderRole, role), eq(departmentMessages.recipientRole, role))).orderBy(desc(departmentMessages.createdAt), desc(departmentMessages.id)).limit(200);
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await visibleMessages(user.role);
    const ids = rows.map((item) => item.id);
    const reads = ids.length
      ? await getDb().select({ messageId: departmentMessageReads.messageId }).from(departmentMessageReads).where(and(eq(departmentMessageReads.userEmail, user.email), inArray(departmentMessageReads.messageId, ids)))
      : [];
    const readIds = new Set(reads.map((item) => item.messageId));
    const messages = rows.reverse().map((item) => ({ ...item, isOwn: item.senderEmail === user.email, isRead: item.senderEmail === user.email || readIds.has(item.id) }));
    const unread = messages.filter((item) => !item.isOwn && item.recipientRole === user.role && !item.isRead).length;
    return Response.json({ messages, unread });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Chat load failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "viewer") return Response.json({ error: "Chat access မရသေးပါ" }, { status: 403 });
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const recipientRole = String(payload.recipientRole || "").trim();
    const message = String(payload.message || "").trim().slice(0, 1000);
    if (!CHAT_ROLES.includes(recipientRole as (typeof CHAT_ROLES)[number])) return Response.json({ error: "Department ရွေးပါ" }, { status: 400 });
    if (!message) return Response.json({ error: "Message ရိုက်ပါ" }, { status: 400 });
    const [created] = await getDb().insert(departmentMessages).values({
      senderEmail: user.email,
      senderName: user.displayName,
      senderRole: user.role,
      recipientRole,
      message,
      createdAt: new Date().toISOString(),
    }).returning();
    return Response.json({ message: { ...created, isOwn: true, isRead: true } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Message send failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const peerRole = String(payload.peerRole || "");
    const visible = await visibleMessages(user.role);
    const ids = visible.filter((item) => item.senderEmail !== user.email && item.recipientRole === user.role && (!peerRole || item.senderRole === peerRole)).map((item) => item.id);
    if (ids.length) await getDb().insert(departmentMessageReads).values(ids.map((messageId) => ({ messageId, userEmail: user.email, readAt: new Date().toISOString() }))).onConflictDoNothing();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Chat read update failed" }, { status: 500 });
  }
}
