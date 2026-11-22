import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { purchaseArrivalUnmatched } from "../../../../db/schema";
import { getAppUser } from "../../../../lib/app-user";

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

  try {
    const unmatched = await getDb().select().from(purchaseArrivalUnmatched)
      .where(eq(purchaseArrivalUnmatched.status, "unmatched"))
      .orderBy(desc(purchaseArrivalUnmatched.importedAt), desc(purchaseArrivalUnmatched.id))
      .limit(300);
    return Response.json({ unmatched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unmatched Products Report ရယူမရပါ";
    return Response.json({ error: message.includes("no such table") ? "Database is preparing. Please refresh in a moment." : message }, { status: 500 });
  }
}
