import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { employeeReports } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";

const REPORT_TYPES = ["daily", "issue", "achievement"];

function clean(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message.includes("no such table") ? "Reporting Database ပြင်ဆင်နေပါသည်။ ခဏနေရင် Refresh လုပ်ပါ" : message;
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const query = getDb().select().from(employeeReports);
    const rows = user.role === "admin"
      ? await query.orderBy(desc(employeeReports.reportDate), desc(employeeReports.id)).limit(500)
      : await query.where(eq(employeeReports.submittedByEmail, user.email)).orderBy(desc(employeeReports.reportDate), desc(employeeReports.id)).limit(250);
    return Response.json({ reports: rows, scope: user.role === "admin" ? "all" : "own" });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const reportDate = clean(payload.reportDate, 10);
    const reportType = clean(payload.reportType, 30);
    const title = clean(payload.title, 180);
    const completedWork = clean(payload.completedWork, 2500);
    const challenges = clean(payload.challenges, 1800);
    const nextPlan = clean(payload.nextPlan, 1800);
    const supportNeeded = clean(payload.supportNeeded, 1200);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return Response.json({ error: "Report Date မှန်ကန်စွာရွေးပါ" }, { status: 400 });
    if (!REPORT_TYPES.includes(reportType)) return Response.json({ error: "Report Type ကို ရွေးပါ" }, { status: 400 });
    if (!title || !completedWork) return Response.json({ error: "Report Title နှင့် Completed Work ဖြည့်ပါ" }, { status: 400 });
    const [saved] = await getDb().insert(employeeReports).values({
      reportDate, reportType, title, completedWork, challenges, nextPlan, supportNeeded,
      submittedByEmail: user.email, submittedByName: user.displayName, submittedByRole: user.role,
      updatedAt: new Date().toISOString(),
    }).returning();
    await recordAuditLog(user, { action: "employee_report_submitted", entityType: "employee_report", entityId: saved.id, summary: `${reportDate} • ${title} Report တင်ခဲ့သည်` });
    return Response.json({ report: saved }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Report မတွေ့ပါ" }, { status: 400 });
    const [existing] = await getDb().select().from(employeeReports).where(eq(employeeReports.id, id)).limit(1);
    if (!existing) return Response.json({ error: "Report မတွေ့ပါ" }, { status: 404 });
    if (user.role !== "admin" && existing.submittedByEmail !== user.email) return Response.json({ error: "ကိုယ်တင်ထားသော Report ကိုသာ ပြင်နိုင်ပါသည်" }, { status: 403 });
    const reportDate = clean(payload.reportDate, 10);
    const reportType = clean(payload.reportType, 30);
    const title = clean(payload.title, 180);
    const completedWork = clean(payload.completedWork, 2500);
    const challenges = clean(payload.challenges, 1800);
    const nextPlan = clean(payload.nextPlan, 1800);
    const supportNeeded = clean(payload.supportNeeded, 1200);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !REPORT_TYPES.includes(reportType) || !title || !completedWork) {
      return Response.json({ error: "မဖြစ်မနေဖြည့်ရမည့် Report အချက်အလက်များကို စစ်ပါ" }, { status: 400 });
    }
    const ownerCondition = user.role === "admin"
      ? eq(employeeReports.id, id)
      : and(eq(employeeReports.id, id), eq(employeeReports.submittedByEmail, user.email));
    const [saved] = await getDb().update(employeeReports).set({
      reportDate, reportType, title, completedWork, challenges, nextPlan, supportNeeded, updatedAt: new Date().toISOString(),
    }).where(ownerCondition).returning();
    await recordAuditLog(user, { action: "employee_report_updated", entityType: "employee_report", entityId: saved.id, summary: `${reportDate} • ${title} Report ပြင်ခဲ့သည်` });
    return Response.json({ report: saved });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
