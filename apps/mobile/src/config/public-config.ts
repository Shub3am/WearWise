// Why: the three build time settings as one typed value, so the app can show a missing configuration screen instead
// of failing inside Clerk or fetch.
// Must not: hold secrets; everything EXPO_PUBLIC_ ships inside the app bundle.

export type PublicConfig = {
  clerkPublishableKey: string;
  apiUrl: string;
  ingestUrl: string;
};

type PublicEnv = {
  clerkPublishableKey: string | undefined;
  apiUrl: string | undefined;
  ingestUrl: string | undefined;
};

export function publicConfigFrom(env: PublicEnv): PublicConfig | undefined {
  const { clerkPublishableKey, apiUrl, ingestUrl } = env;
  if (!clerkPublishableKey || !apiUrl || !ingestUrl) return undefined;
  return { clerkPublishableKey, apiUrl, ingestUrl };
}

export function readPublicConfig(): PublicConfig | undefined {
  // Expo inlines EXPO_PUBLIC_* at build time only for literal process.env.NAME reads, so each one is spelled out.
  return publicConfigFrom({
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    ingestUrl: process.env.EXPO_PUBLIC_INGEST_URL,
  });
}
