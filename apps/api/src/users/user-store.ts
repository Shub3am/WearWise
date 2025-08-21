// Why: resolves a Clerk user id to its users row, creating it when missing, and removes it on Clerk deletion.
// Must not: know about HTTP, Fastify or Clerk payload shapes.
import { type Database, users } from "@wearwise/db";
import { eq, sql } from "drizzle-orm";

export type UserRow = typeof users.$inferSelect;

export async function ensureUser(
  database: Database,
  clerkUserId: string,
): Promise<UserRow> {
  const [existingUser] = await database
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));
  if (existingUser) return existingUser;
  // Concurrent first requests and the Clerk webhook race here; the unique clerk_user_id makes the losers no-ops.
  await database
    .insert(users)
    .values({ clerkUserId })
    .onConflictDoNothing({ target: users.clerkUserId });
  const [createdUser] = await database
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));
  if (!createdUser)
    throw new Error(
      `users row for ${clerkUserId} was deleted while being created`,
    );
  return createdUser;
}

export async function updateUserTimezone(
  database: Database,
  userId: string,
  timezone: string,
): Promise<UserRow> {
  const [updatedUser] = await database
    .update(users)
    // The database clock, not Node's: created_at came from it, and a Docker VM clock can lag the host.
    .set({ timezone, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
    .returning();
  if (!updatedUser)
    throw new Error(`users row ${userId} disappeared during update`);
  return updatedUser;
}
