import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { customers } from "../../../db/schema";
import { getAppUser, roleAllowed } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";
import { getCustomerDirectory, normalizeCustomerKey } from "../../../lib/customer-directory";

const ROUTES = ["HTY Ways", "Pick Up", "Aung Mingalar", "BayinNaung"];
const SALE_PEOPLE = ["Zaw Tun Kyaw", "Zin Mg Mg Lin", "Myo Min", "Htin Lin Kyaw Swar", "Aung Kyaw Zaw", "Admin"];

function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function message(error: unknown) {
  const value = error instanceof Error ? error.message : "Unexpected error";
  return value.includes("no such table") ? "Database is preparing. Please refresh in a moment." : value;
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ customers: await getCustomerDirectory() });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, [])) return Response.json({ error: "Admin သာ Customer အသစ်ထည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const customerName = cleanText(payload.customerName);
    const township = cleanText(payload.township, 120);
    const phone = cleanText(payload.phone, 60);
    const address = cleanText(payload.address, 300);
    const route = cleanText(payload.route, 40);
    const salesperson = cleanText(payload.salesperson, 80);
    if (!customerName || !township) return Response.json({ error: "Customer Name နှင့် Township ထည့်ပါ" }, { status: 400 });
    if (!ROUTES.includes(route)) return Response.json({ error: "Route ကို ရွေးပါ" }, { status: 400 });
    if (!SALE_PEOPLE.includes(salesperson)) return Response.json({ error: "Sale Man ကို ရွေးပါ" }, { status: 400 });
    const customerKey = normalizeCustomerKey(customerName, township);
    const [saved] = await getDb().insert(customers).values({
      customerName, township, customerKey, phone, address, route, salesperson, active: true,
      createdBy: user.displayName, updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: customers.customerKey,
      set: { customerName, township, phone, address, route, salesperson, active: true, updatedAt: new Date().toISOString() },
    }).returning();
    await recordAuditLog(user, { action: "customer_created", entityType: "customer", entityId: saved.id, summary: `${customerName} • ${township} Customer ထည့်ခဲ့သည်` });
    return Response.json({ customer: saved }, { status: 201 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAllowed(user.role, [])) return Response.json({ error: "Admin သာ Customer ပြင်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    const customerName = cleanText(payload.customerName);
    const township = cleanText(payload.township, 120);
    const phone = cleanText(payload.phone, 60);
    const address = cleanText(payload.address, 300);
    const route = cleanText(payload.route, 40);
    const salesperson = cleanText(payload.salesperson, 80);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "ပြင်မည့် Customer မတွေ့ပါ" }, { status: 400 });
    if (!customerName || !township) return Response.json({ error: "Customer Name နှင့် Township ထည့်ပါ" }, { status: 400 });
    if (!ROUTES.includes(route) || !SALE_PEOPLE.includes(salesperson)) return Response.json({ error: "Route နှင့် Sale Man ကို စစ်ပါ" }, { status: 400 });
    const [saved] = await getDb().update(customers).set({
      customerName, township, customerKey: normalizeCustomerKey(customerName, township), phone, address, route, salesperson,
      updatedAt: new Date().toISOString(),
    }).where(eq(customers.id, id)).returning();
    if (!saved) return Response.json({ error: "Customer မတွေ့ပါ" }, { status: 404 });
    await recordAuditLog(user, { action: "customer_updated", entityType: "customer", entityId: saved.id, summary: `${customerName} • ${township} Customer ပြင်ခဲ့သည်` });
    return Response.json({ customer: saved });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }
}
