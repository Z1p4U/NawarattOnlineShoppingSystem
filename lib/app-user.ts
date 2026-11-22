import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { appUsers } from "../db/schema";
import { readSessionEmail } from "./app-session";

export const APP_ROLES = ["admin", "sale", "warehouse", "purchase", "delivery", "finance", "viewer"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export async function getAppUser() {
  const email = await readSessionEmail();
  if (!email) return null;
  const db = getDb();
  const [existing] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
  if (!existing) return null;
  return {
    userId: `app:${existing.email}`,
    displayName: existing.displayName || existing.email.split("@")[0],
    email: existing.email,
    fullName: existing.displayName || null,
    role: existing.role as AppRole,
  };
}

export function roleAllowed(role: AppRole, allowed: AppRole[]) {
  return role === "admin" || allowed.includes(role);
}
