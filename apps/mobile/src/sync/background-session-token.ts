// Why: a Clerk session token for a sync that starts with no React tree (an Android background task or a HealthKit
// wake), where useAuth is not available.
// Must not: sign in or out; it only reads the session the app already stored.
import { getClerkInstance } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";

export async function getBackgroundSessionToken(
  publishableKey: string,
): Promise<string | null> {
  const clerk = getClerkInstance({ publishableKey, tokenCache });
  // In a background launch nothing has loaded Clerk yet; load restores the stored client through the token cache.
  // A later ClerkProvider with the same key reuses this instance and skips its own load.
  if (!clerk.loaded) await clerk.load({ standardBrowser: false });
  return (await clerk.session?.getToken()) ?? null;
}
