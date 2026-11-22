import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const logs = await getDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(120);
  return Response.json({ logs });
}
