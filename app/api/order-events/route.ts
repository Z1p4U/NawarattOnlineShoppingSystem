import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderEvents, orders } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const orderId = Number(new URL(request.url).searchParams.get("orderId"));
  if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ error: "Valid Order ID လိုအပ်ပါသည်" }, { status: 400 });
  const db = getDb();
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return Response.json({ error: "Sale Order မတွေ့ပါ" }, { status: 404 });
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(desc(orderEvents.createdAt), desc(orderEvents.id));
  return Response.json({ events });
}
