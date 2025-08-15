// Why: reads the consents a user has accepted.
// Must not: know about HTTP or decide which consents are required.
import { consents, type Database } from "@wearwise/db";
import { asc, eq } from "drizzle-orm";

export type ConsentRow = typeof consents.$inferSelect;

export async function listConsents(
  database: Database,
  userId: string,
): Promise<ConsentRow[]> {
  return database
    .select()
    .from(consents)
    .where(eq(consents.userId, userId))
    .orderBy(asc(consents.acceptedAt));
}
