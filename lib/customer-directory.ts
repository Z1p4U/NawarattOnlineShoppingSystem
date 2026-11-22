import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { customers } from "../db/schema";
import { CUSTOMERS } from "../data/customers";

export function normalizeCustomerKey(name: string, township: string) {
  return `${normalizeCustomerValue(name)}|||${normalizeCustomerValue(township)}`;
}

export function normalizeCustomerValue(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export async function resolveCustomerSelection(name: string, township: string) {
  const key = normalizeCustomerKey(name, township);
  const db = getDb();
  const [exact] = await db.select().from(customers).where(eq(customers.customerKey, key)).limit(1);
  if (exact?.active) return exact;

  const activeRows = await db.select().from(customers).where(eq(customers.active, true));
  const nameMatches = activeRows.filter((row) => normalizeCustomerValue(row.customerName) === normalizeCustomerValue(name));
  if (nameMatches.length === 1) return nameMatches[0];

  const builtIn = CUSTOMERS.find((customer) => normalizeCustomerKey(customer.name, customer.township) === key);
  return builtIn ? {
    id: 0, customerName: builtIn.name, township: builtIn.township, customerKey: key,
    phone: "", address: "", route: "HTY Ways", salesperson: "Admin", active: true,
    createdBy: "built_in", createdAt: "", updatedAt: "",
  } : null;
}

export async function customerExists(name: string, township: string) {
  return Boolean(await resolveCustomerSelection(name, township));
}

export async function getCustomerDirectory() {
  const custom = await getDb().select().from(customers)
    .where(eq(customers.active, true))
    .orderBy(asc(customers.customerName), asc(customers.township));
  const customKeys = new Set(custom.map((item) => item.customerKey));
  return [
    ...custom.map((item) => ({
      id: item.id,
      customerKey: item.customerKey,
      name: item.customerName,
      township: item.township,
      phone: item.phone,
      address: item.address,
      route: item.route,
      salesperson: item.salesperson,
      active: item.active,
      source: "custom" as const,
    })),
    ...CUSTOMERS.filter((item) => !customKeys.has(normalizeCustomerKey(item.name, item.township))).map((item) => ({
      id: 0,
      customerKey: normalizeCustomerKey(item.name, item.township),
      name: item.name,
      township: item.township,
      phone: "",
      address: "",
      route: "HTY Ways",
      salesperson: "Admin",
      active: true,
      source: "built_in" as const,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.township.localeCompare(b.township));
}
