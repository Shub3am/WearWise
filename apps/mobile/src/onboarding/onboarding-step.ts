// Why: decides which onboarding screen a signed in user needs next, so the order lives in one function.
// Must not: call the API or read storage; the home screen passes in what it fetched and read.
import { consentKinds, type MeResponse } from "@wearwise/contracts";
import { consentNoticeVersion } from "./consent-notice.ts";

export const healthAccessRequestedKey = "health-access-requested";

export type OnboardingStep = "consent" | "health-access" | "home";

export function nextOnboardingStep({
  me,
  healthAccessRequested,
}: {
  me: MeResponse;
  healthAccessRequested: boolean;
}): OnboardingStep {
  const hasCurrentConsents = consentKinds.every((kind) =>
    me.consents.some(
      (consent) =>
        consent.kind === kind && consent.version === consentNoticeVersion,
    ),
  );
  if (!hasCurrentConsents) return "consent";
  if (!healthAccessRequested) return "health-access";
  return "home";
}
