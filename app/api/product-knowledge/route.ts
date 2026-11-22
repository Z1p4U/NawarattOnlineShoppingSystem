import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { productKnowledge } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message.includes("no such table") ? "Product Knowledge Database ပြင်ဆင်နေပါသည်။ ခဏနေရင် Refresh လုပ်ပါ" : message;
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await getDb().select().from(productKnowledge).orderBy(desc(productKnowledge.updatedAt), desc(productKnowledge.id)).limit(500);
    return Response.json({ products: user.role === "admin" ? rows : rows.filter((item) => item.active), canManage: user.role === "admin" });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Product Knowledge ထည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const productName = clean(payload.productName, 180);
    const genericName = clean(payload.genericName, 180);
    const category = clean(payload.category, 100) || "General";
    const keyBenefits = clean(payload.keyBenefits, 1800);
    const talkingPoints = clean(payload.talkingPoints, 1800);
    const usageNote = clean(payload.usageNote, 1200);
    const caution = clean(payload.caution, 1200);
    const tags = clean(payload.tags, 400);
    if (!productName || !keyBenefits) return Response.json({ error: "Product Name နှင့် Key Benefits ဖြည့်ပါ" }, { status: 400 });
    const [saved] = await getDb().insert(productKnowledge).values({
      productName, genericName, category, keyBenefits, talkingPoints, usageNote, caution, tags,
      active: true, createdBy: user.displayName, updatedBy: user.displayName, updatedAt: new Date().toISOString(),
    }).returning();
    await recordAuditLog(user, { action: "product_knowledge_created", entityType: "product_knowledge", entityId: saved.id, summary: `${productName} Product Knowledge ထည့်ခဲ့သည်` });
    return Response.json({ product: saved }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin သာ Product Knowledge ပြင်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Product မတွေ့ပါ" }, { status: 400 });
    const productName = clean(payload.productName, 180);
    const genericName = clean(payload.genericName, 180);
    const category = clean(payload.category, 100) || "General";
    const keyBenefits = clean(payload.keyBenefits, 1800);
    const talkingPoints = clean(payload.talkingPoints, 1800);
    const usageNote = clean(payload.usageNote, 1200);
    const caution = clean(payload.caution, 1200);
    const tags = clean(payload.tags, 400);
    if (!productName || !keyBenefits) return Response.json({ error: "Product Name နှင့် Key Benefits ဖြည့်ပါ" }, { status: 400 });
    const [saved] = await getDb().update(productKnowledge).set({
      productName, genericName, category, keyBenefits, talkingPoints, usageNote, caution, tags,
      active: payload.active !== false, updatedBy: user.displayName, updatedAt: new Date().toISOString(),
    }).where(eq(productKnowledge.id, id)).returning();
    if (!saved) return Response.json({ error: "Product မတွေ့ပါ" }, { status: 404 });
    await recordAuditLog(user, { action: "product_knowledge_updated", entityType: "product_knowledge", entityId: saved.id, summary: `${productName} Product Knowledge ပြင်ခဲ့သည်` });
    return Response.json({ product: saved });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
