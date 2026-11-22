import { getDb } from "../db";
import { notifications } from "../db/schema";

type DepartmentRole = "admin" | "sale" | "warehouse" | "purchase" | "delivery" | "finance";

export async function notifyDepartments(input: {
  roles: DepartmentRole[];
  title: string;
  message: string;
  targetTab: "dashboard" | "orders" | "sale" | "warehouse" | "purchase" | "finance";
  sourceId?: number;
  actor: string;
  recipientEmail?: string;
}) {
  const roles = [...new Set(input.roles)];
  if (roles.length === 0) return;
  await getDb().insert(notifications).values(roles.map((recipientRole) => ({
    recipientRole,
    recipientEmail: input.recipientEmail || "",
    title: input.title,
    message: input.message,
    targetTab: input.targetTab,
    sourceId: input.sourceId || 0,
    actor: input.actor,
  })));
}
