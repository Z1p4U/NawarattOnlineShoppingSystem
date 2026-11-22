import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { appUsers } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { hashPassword } from "../../../lib/password";
import { recordAuditLog } from "../../../lib/audit-log";

const ASSIGNABLE_ROLES = ["admin", "sale", "delivery", "warehouse", "purchase", "finance"] as const;

function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requireAdmin() {
  const user = await getAppUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") return { error: Response.json({ error: "Admin သာ User Role ပြင်နိုင်ပါသည်" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const users = await getDb().select().from(appUsers).orderBy(asc(appUsers.role), asc(appUsers.email));
  return Response.json({ users: users.map(({ passwordHash, ...user }) => ({ ...user, hasPassword: Boolean(passwordHash) })) });
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const payload = (await request.json()) as Record<string, unknown>;
  const email = cleanText(payload.email).toLocaleLowerCase();
  const displayName = cleanText(payload.displayName, 120);
  const role = cleanText(payload.role, 30);
  const password = cleanText(payload.password, 200);
  if (!validEmail(email)) return Response.json({ error: "မှန်ကန်သော Staff Email ထည့်ပါ" }, { status: 400 });
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) return Response.json({ error: "မှန်ကန်သော Role ရွေးပါ" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password အနည်းဆုံး 8 လုံးထားပါ" }, { status: 400 });

  const passwordHash = await hashPassword(password);
  const [user] = await getDb().insert(appUsers).values({ email, displayName, role, passwordHash }).onConflictDoUpdate({
    target: appUsers.email,
    set: { displayName, role, passwordHash, updatedAt: new Date().toISOString() },
  }).returning();
  await recordAuditLog(access.user, { action: "user_saved", entityType: "user", entityId: email, summary: `${displayName || email} • ${role} • Password သတ်မှတ်ခဲ့သည်` });
  return Response.json({ user: { email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt, hasPassword: true } });
}

export async function PATCH(request: Request) {
  try {
    const access = await requireAdmin();
    if (access.error) return access.error;
    const payload = (await request.json()) as Record<string, unknown>;
    const email = cleanText(payload.email).toLocaleLowerCase();
    const role = cleanText(payload.role, 30);
    const password = cleanText(payload.password, 200);
    if (!validEmail(email)) return Response.json({ error: "မှန်ကန်သော Staff Email မဟုတ်ပါ" }, { status: 400 });
    if (role && !ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) return Response.json({ error: "မှန်ကန်သော Role ရွေးပါ" }, { status: 400 });
    if (password && password.length < 8) return Response.json({ error: "Password အနည်းဆုံး 8 လုံးထားပါ" }, { status: 400 });
    if (!role && !password) return Response.json({ error: "Role သို့မဟုတ် Password ထည့်ပါ" }, { status: 400 });
    if (email === access.user.email.toLocaleLowerCase() && role && role !== "admin") {
      return Response.json({ error: "လက်ရှိ Admin Account ကို Role ပြောင်း၍မရပါ" }, { status: 409 });
    }
    const update: { role?: string; passwordHash?: string; updatedAt: string } = { updatedAt: new Date().toISOString() };
    if (role) update.role = role;
    if (password) update.passwordHash = await hashPassword(password);
    const [user] = await getDb().update(appUsers).set(update).where(eq(appUsers.email, email)).returning();
    if (!user) return Response.json({ error: "User မတွေ့ပါ။ Current Users ကို Refresh လုပ်ပြီး ပြန်စမ်းပါ" }, { status: 404 });
    await recordAuditLog(access.user, { action: password ? "password_reset" : "role_changed", entityType: "user", entityId: email, summary: password ? `${email} Password ပြန်သတ်မှတ်ခဲ့သည်` : `${email} Role ကို ${role} သို့ ပြောင်းခဲ့သည်` });
    return Response.json({ user: { email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt, hasPassword: Boolean(user.passwordHash) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password update failed";
    return Response.json({ error: `Password update မအောင်မြင်ပါ — ${message}` }, { status: 500 });
  }
}
