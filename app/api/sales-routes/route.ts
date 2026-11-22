import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { appUsers, customerLocations, notifications, orders, salesRoutePlans, salesRouteStops } from "../../../db/schema";
import { getAppUser } from "../../../lib/app-user";
import { recordAuditLog } from "../../../lib/audit-log";
import { getOperationalPeriod } from "../../../lib/operational-period";
import { getCustomerDirectory } from "../../../lib/customer-directory";
import { getListedSaleTeamAssignment } from "../../../data/sale-team-customers";

const PLAN_STATUSES = ["planned", "started", "in_progress", "completed", "partially_completed", "cancelled"];
const STOP_STATUSES = ["pending", "arrived", "order_received", "no_order", "customer_unavailable", "shop_closed", "payment_collected", "follow_up", "skipped", "not_visited", "completed"];
const PURPOSES = ["collect_order", "collect_payment", "customer_follow_up", "product_information", "complaint", "new_customer", "other"];
const RESULTS = ["", "order_received", "no_order", "customer_unavailable", "shop_closed", "payment_collected", "follow_up", "skipped", "other"];

function clean(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function allowed(role: string) {
  return role === "admin" || role === "sale";
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message.includes("no such table") || message.includes("no column named")
    ? "Sale Route Database ကို Update လုပ်နေပါသည်။ ခဏနေရင် Refresh လုပ်ပါ"
    : message;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function checkPlanAccess(user: NonNullable<Awaited<ReturnType<typeof getAppUser>>>, planId: number) {
  const [plan] = await getDb().select().from(salesRoutePlans).where(eq(salesRoutePlans.id, planId)).limit(1);
  if (!plan) return null;
  return user.role === "admin" || plan.salesperson === user.displayName ? plan : null;
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(user.role)) return Response.json({ error: "Admin နှင့် Sales Team သာ Sale Route Call ကိုကြည့်နိုင်ပါသည်" }, { status: 403 });
  try {
    const { officialStartDate } = await getOperationalPeriod();
    const allPlans = await getDb().select().from(salesRoutePlans).where(gte(salesRoutePlans.createdAt, officialStartDate)).orderBy(desc(salesRoutePlans.planDate), desc(salesRoutePlans.id)).limit(500);
    const plans = allPlans.filter((plan) => user.role === "admin" || plan.salesperson === user.displayName);
    const planIds = plans.map((plan) => plan.id);
    const stops = planIds.length ? await getDb().select().from(salesRouteStops).where(inArray(salesRouteStops.routePlanId, planIds)).orderBy(asc(salesRouteStops.routePlanId), asc(salesRouteStops.sequence)) : [];
    const keys = [...new Set(stops.map((stop) => stop.customerKey))];
    const locations = keys.length ? await getDb().select().from(customerLocations).where(inArray(customerLocations.customerKey, keys)) : [];
    const orderIds = [...new Set(stops.map((stop) => stop.confirmedOrderId).filter((id): id is number => Boolean(id)))];
    const orderRows = orderIds.length ? await getDb().select({ id: orders.id, voucherAmount: orders.voucherAmount, orderAmount: orders.orderAmount }).from(orders).where(inArray(orders.id, orderIds)) : [];
    const orderAmounts = new Map(orderRows.map((order) => [order.id, Math.max(0, order.voucherAmount || order.orderAmount)]));
    const locationMap = new Map(locations.map((location) => [location.customerKey, location]));
    return Response.json({
      plans,
      stops: stops.map((stop) => ({ ...stop, location: locationMap.get(stop.customerKey) || null, confirmedOrderAmount: stop.confirmedOrderId ? orderAmounts.get(stop.confirmedOrderId) || 0 : 0 })),
      currentUserName: user.displayName,
      role: user.role,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(user.role)) return Response.json({ error: "Admin နှင့် Sales Team သာ Sale Route Call ကိုအသုံးပြုနိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = clean(payload.action, 40);
    const now = new Date().toISOString();

    if (action === "create_plan") {
      const planDate = clean(payload.planDate, 10);
      const routeName = clean(payload.routeName, 100);
      const township = clean(payload.township, 120);
      const salesperson = user.role === "admin" ? clean(payload.salesperson, 100) : user.displayName;
      const plannedStartTime = clean(payload.plannedStartTime, 5);
      const remark = clean(payload.remark, 800);
      const isTemplate = Boolean(payload.isTemplate);
      const customerKeys = Array.isArray(payload.customerKeys) ? payload.customerKeys.map((item) => clean(item, 300)).filter(Boolean).slice(0, 60) : [];
      if (!validDate(planDate) || !routeName || !salesperson || customerKeys.length === 0) return Response.json({ error: "Date၊ Route၊ Salesman နှင့် Customer အနည်းဆုံးတစ်ယောက် ရွေးပါ" }, { status: 400 });
      const directory = await getCustomerDirectory();
      const selectedCustomers = directory.filter((customer) => customer.active && customerKeys.includes(customer.customerKey));
      if (selectedCustomers.length !== new Set(customerKeys).size) return Response.json({ error: "ရွေးထားသော Customer တချို့ မတွေ့ပါ" }, { status: 400 });
      const customerMap = new Map(selectedCustomers.map((customer) => [customer.customerKey, customer]));
      const [plan] = await getDb().insert(salesRoutePlans).values({
        planDate, routeName, township, salesperson, plannedStartTime, status: "planned", remark, isTemplate,
        createdByEmail: user.email, createdByName: user.displayName, updatedAt: now,
      }).returning();
      await getDb().insert(salesRouteStops).values(customerKeys.map((key, index) => {
        const customer = customerMap.get(key)!;
        return { routePlanId: plan.id, sequence: index + 1, customerKey: key, customerName: customer.name, township: customer.township, route: customer.route, salesperson };
      }));
      const [assignedUser] = await getDb().select({ email: appUsers.email }).from(appUsers).where(eq(appUsers.displayName, salesperson)).limit(1);
      await getDb().insert(notifications).values({ recipientRole: "sale", recipientEmail: assignedUser?.email || "", title: "Sale Route Call အသစ်", message: `${planDate} • ${routeName} • ${customerKeys.length} Customers`, targetTab: "modules", sourceId: 0, actor: user.displayName });
      await recordAuditLog(user, { action: "sale_route_plan_created", entityType: "sales_route_plan", entityId: plan.id, summary: `${routeName} • ${customerKeys.length} Customers Route Plan ဖန်တီးခဲ့သည်` });
      return Response.json({ plan }, { status: 201 });
    }

    if (action === "copy_plan") {
      const sourceId = positive(payload.sourceId);
      const source = await checkPlanAccess(user, sourceId);
      const planDate = clean(payload.planDate, 10);
      const salesperson = user.role === "admin" ? clean(payload.salesperson, 100) || source?.salesperson || "" : user.displayName;
      if (!source || !validDate(planDate) || !salesperson) return Response.json({ error: "Copy လုပ်မည့် Route၊ Date နှင့် Salesman ကိုစစ်ပါ" }, { status: 400 });
      const sourceStops = await getDb().select().from(salesRouteStops).where(eq(salesRouteStops.routePlanId, source.id)).orderBy(asc(salesRouteStops.sequence));
      const [plan] = await getDb().insert(salesRoutePlans).values({
        planDate, routeName: source.routeName, township: source.township, salesperson, plannedStartTime: source.plannedStartTime,
        status: "planned", remark: `Re-used from Route #${source.id}`, isTemplate: false, createdByEmail: user.email, createdByName: user.displayName, updatedAt: now,
      }).returning();
      if (sourceStops.length) await getDb().insert(salesRouteStops).values(sourceStops.map((stop) => ({
        routePlanId: plan.id, sequence: stop.sequence, customerKey: stop.customerKey, customerName: stop.customerName,
        township: stop.township, route: stop.route, salesperson,
      })));
      await recordAuditLog(user, { action: "sale_route_plan_reused", entityType: "sales_route_plan", entityId: plan.id, summary: `${source.routeName} Route ကို ${planDate} အတွက် ပြန်သုံးခဲ့သည်` });
      return Response.json({ plan }, { status: 201 });
    }

    if (action === "save_location") {
      const customerKey = clean(payload.customerKey, 300);
      const latitude = Number(payload.latitude);
      const longitude = Number(payload.longitude);
      if (!customerKey || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return Response.json({ error: "Customer Location ကိုစစ်ပါ" }, { status: 400 });
      const customer = (await getCustomerDirectory()).find((item) => item.customerKey === customerKey);
      const assignment = customer ? getListedSaleTeamAssignment(customer.name, customer.township) : null;
      if (!customer || (user.role !== "admin" && (assignment?.salesperson || customer.salesperson) !== user.displayName)) return Response.json({ error: "Customer Location ပြင်ခွင့်မရှိပါ" }, { status: 403 });
      const verified = user.role === "admin" && Boolean(payload.verified);
      const [location] = await getDb().insert(customerLocations).values({
        customerKey, latitude: String(latitude), longitude: String(longitude), landmark: clean(payload.landmark, 300), directionsNote: clean(payload.directionsNote, 800),
        shopPhotoUrl: clean(payload.shopPhotoUrl, 1000), verified, updatedBy: user.displayName, updatedAt: now,
      }).onConflictDoUpdate({ target: customerLocations.customerKey, set: {
        latitude: String(latitude), longitude: String(longitude), landmark: clean(payload.landmark, 300), directionsNote: clean(payload.directionsNote, 800),
        shopPhotoUrl: clean(payload.shopPhotoUrl, 1000), verified, updatedBy: user.displayName, updatedAt: now,
      } }).returning();
      await recordAuditLog(user, { action: "customer_location_saved", entityType: "customer_location", entityId: location.id, summary: `${customer.name} • Google Map Location သိမ်းခဲ့သည်` });
      return Response.json({ location });
    }

    return Response.json({ error: "လုပ်ဆောင်ချက်ကို စစ်ပါ" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(user.role)) return Response.json({ error: "Admin နှင့် Sales Team သာ Sale Route Call ကိုပြင်နိုင်ပါသည်" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = clean(payload.action, 40);
    const now = new Date().toISOString();

    if (action === "plan_status") {
      const id = positive(payload.id);
      const status = clean(payload.status, 40);
      const plan = await checkPlanAccess(user, id);
      if (!plan || !PLAN_STATUSES.includes(status)) return Response.json({ error: "Route Plan သို့မဟုတ် Status ကိုစစ်ပါ" }, { status: 400 });
      const [saved] = await getDb().update(salesRoutePlans).set({ status, updatedAt: now }).where(eq(salesRoutePlans.id, id)).returning();
      return Response.json({ plan: saved });
    }

    if (action === "verify_location") {
      if (user.role !== "admin") return Response.json({ error: "Admin သာ Customer Location ကို Verify လုပ်နိုင်ပါသည်" }, { status: 403 });
      const customerKey = clean(payload.customerKey, 300);
      const [saved] = await getDb().update(customerLocations).set({ verified: true, updatedBy: user.displayName, updatedAt: now }).where(eq(customerLocations.customerKey, customerKey)).returning();
      if (!saved) return Response.json({ error: "Customer Location မရှိသေးပါ" }, { status: 404 });
      await recordAuditLog(user, { action: "customer_location_verified", entityType: "customer_location", entityId: saved.id, summary: `${customerKey} • Location Verified` });
      return Response.json({ location: saved });
    }

    const id = positive(payload.id);
    const [stop] = await getDb().select().from(salesRouteStops).where(eq(salesRouteStops.id, id)).limit(1);
    if (!stop || !(await checkPlanAccess(user, stop.routePlanId))) return Response.json({ error: "Route Customer မတွေ့ပါ သို့မဟုတ် ပြင်ခွင့်မရှိပါ" }, { status: 404 });

    if (action === "check_in") {
      const latitude = Number(payload.latitude);
      const longitude = Number(payload.longitude);
      const reason = clean(payload.reason, 300);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return Response.json({ error: "GPS Location မရရှိပါ" }, { status: 400 });
      let [location] = await getDb().select().from(customerLocations).where(eq(customerLocations.customerKey, stop.customerKey)).limit(1);
      if (!location) {
        [location] = await getDb().insert(customerLocations).values({ customerKey: stop.customerKey, latitude: String(latitude), longitude: String(longitude), verified: false, updatedBy: user.displayName, updatedAt: now }).returning();
      }
      const targetLat = Number(location.latitude);
      const targetLng = Number(location.longitude);
      const distance = Number.isFinite(targetLat) && Number.isFinite(targetLng) ? distanceMeters(latitude, longitude, targetLat, targetLng) : 0;
      const verified = Boolean(location.verified && distance <= 200);
      if (location.verified && distance > 200 && !reason) return Response.json({ error: `Customer Pin မှ ${distance} မီတာဝေးနေပါသည်။ Manual Check-in Reason ထည့်ပါ` }, { status: 400 });
      const [saved] = await getDb().update(salesRouteStops).set({
        status: "arrived", checkInLatitude: String(latitude), checkInLongitude: String(longitude), checkInDistanceMeters: distance,
        checkInVerified: verified, checkInReason: reason, checkInAt: now, updatedAt: now,
      }).where(eq(salesRouteStops.id, id)).returning();
      await getDb().update(salesRoutePlans).set({ status: "in_progress", updatedAt: now }).where(eq(salesRoutePlans.id, stop.routePlanId));
      await recordAuditLog(user, { action: "sale_route_check_in", entityType: "sales_route_stop", entityId: saved.id, summary: `${saved.customerName} • ${verified ? "Verified" : "Unverified"} Check-in` });
      return Response.json({ stop: saved, location });
    }

    if (action === "visit_result") {
      const status = clean(payload.status, 40);
      const visitPurpose = clean(payload.visitPurpose, 40);
      const visitResult = clean(payload.visitResult, 40);
      if (!STOP_STATUSES.includes(status) || !PURPOSES.includes(visitPurpose) || !RESULTS.includes(visitResult)) return Response.json({ error: "Visit Purpose၊ Result နှင့် Status ကိုစစ်ပါ" }, { status: 400 });
      const nextFollowUpDate = clean(payload.nextFollowUpDate, 10);
      const nextVisitDate = clean(payload.nextVisitDate, 10);
      if ((nextFollowUpDate && !validDate(nextFollowUpDate)) || (nextVisitDate && !validDate(nextVisitDate))) return Response.json({ error: "Follow-up/Visit Date ကိုစစ်ပါ" }, { status: 400 });
      const [saved] = await getDb().update(salesRouteStops).set({
        status, visitPurpose, visitResult, noOrderReason: clean(payload.noOrderReason, 300), orderReceived: Boolean(payload.orderReceived || visitResult === "order_received"),
        estimatedOrderAmount: positive(payload.estimatedOrderAmount), paymentCollected: Boolean(payload.paymentCollected), collectedAmount: positive(payload.collectedAmount),
        customerRequest: clean(payload.customerRequest, 1000), nextFollowUpDate, nextVisitDate, remark: clean(payload.remark, 1200), updatedAt: now,
      }).where(eq(salesRouteStops.id, id)).returning();
      await recordAuditLog(user, { action: "sale_route_visit_result", entityType: "sales_route_stop", entityId: saved.id, summary: `${saved.customerName} • ${visitResult || status}` });
      return Response.json({ stop: saved });
    }

    if (action === "check_out") {
      const [saved] = await getDb().update(salesRouteStops).set({ checkOutAt: now, status: stop.status === "arrived" ? "completed" : stop.status, updatedAt: now }).where(eq(salesRouteStops.id, id)).returning();
      return Response.json({ stop: saved });
    }

    if (action === "link_order") {
      const confirmedOrderId = positive(payload.confirmedOrderId);
      const [order] = await getDb().select({ id: orders.id, customerKey: orders.customerKey }).from(orders).where(eq(orders.id, confirmedOrderId)).limit(1);
      if (!order || order.customerKey !== stop.customerKey) return Response.json({ error: "Customer နှင့် Sale Order မကိုက်ညီပါ" }, { status: 400 });
      const [saved] = await getDb().update(salesRouteStops).set({ confirmedOrderId, orderReceived: true, status: "order_received", visitResult: "order_received", updatedAt: now }).where(eq(salesRouteStops.id, id)).returning();
      return Response.json({ stop: saved });
    }

    return Response.json({ error: "လုပ်ဆောင်ချက်ကို စစ်ပါ" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
