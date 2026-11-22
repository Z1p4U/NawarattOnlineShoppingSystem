import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { customerOpeningBalances, operationalSettings, trialOpeningBalances } from "../db/schema";

export const DEFAULT_TRIAL_START_DATE = "2026-10-18";
export const DEFAULT_OFFICIAL_START_DATE = "2026-10-26";

export type OperationalPeriod = {
  trialStartDate: string;
  officialStartDate: string;
};

export async function getOperationalPeriod(): Promise<OperationalPeriod> {
  try {
    const [settings] = await getDb().select().from(operationalSettings)
      .where(eq(operationalSettings.id, 1)).limit(1);
    return {
      trialStartDate: settings?.trialStartDate || DEFAULT_TRIAL_START_DATE,
      officialStartDate: settings?.officialStartDate || DEFAULT_OFFICIAL_START_DATE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("no such table")) {
      return { trialStartDate: DEFAULT_TRIAL_START_DATE, officialStartDate: DEFAULT_OFFICIAL_START_DATE };
    }
    throw error;
  }
}

export function isLiveDate(value: string, officialStartDate: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= officialStartDate;
}

export function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function preserveTrialOpening(customerKey: string, officialStartDate: string, archivedBy: string) {
  const db = getDb();
  const [current] = await db.select().from(customerOpeningBalances)
    .where(eq(customerOpeningBalances.customerKey, customerKey)).limit(1);
  if (!current || current.asOfDate >= officialStartDate) return;
  await db.insert(trialOpeningBalances).values({
    originalId: current.id,
    asOfDate: current.asOfDate,
    customerName: current.customerName,
    township: current.township,
    customerKey: current.customerKey,
    openingPackages: current.openingPackages,
    deliveredPackages: current.deliveredPackages,
    openingOutstanding: current.openingOutstanding,
    paidAmount: current.paidAmount,
    note: current.note,
    enteredBy: current.enteredBy,
    originalCreatedAt: current.createdAt,
    originalUpdatedAt: current.updatedAt,
    archivedBy,
    archivedAt: new Date().toISOString(),
  }).onConflictDoNothing();
}
