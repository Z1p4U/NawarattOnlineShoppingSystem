import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { purchaseOperationalSettings } from "../db/schema";

export const DEFAULT_PURCHASE_TRIAL_START_DATE = "2026-10-26";
export const DEFAULT_PURCHASE_OFFICIAL_START_DATE = "2026-10-26";

export type PurchaseOperationalPeriod = {
  trialStartDate: string;
  officialStartDate: string;
};

export async function getPurchaseOperationalPeriod(): Promise<PurchaseOperationalPeriod> {
  try {
    const [settings] = await getDb().select().from(purchaseOperationalSettings)
      .where(eq(purchaseOperationalSettings.id, 1)).limit(1);
    return {
      trialStartDate: settings?.trialStartDate || DEFAULT_PURCHASE_TRIAL_START_DATE,
      officialStartDate: settings?.officialStartDate || DEFAULT_PURCHASE_OFFICIAL_START_DATE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("no such table")) {
      return { trialStartDate: DEFAULT_PURCHASE_TRIAL_START_DATE, officialStartDate: DEFAULT_PURCHASE_OFFICIAL_START_DATE };
    }
    throw error;
  }
}
