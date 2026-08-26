import {
  type ConsentKind,
  consentKinds,
  type MeResponse,
} from "@wearwise/contracts";
import { consentNoticeVersion } from "./consent-notice.ts";
import { nextOnboardingStep } from "./onboarding-step.ts";

function meWithConsents(
  consents: { kind: ConsentKind; version: string }[],
): MeResponse {
  return {
    id: "0f8c6a52-6c1e-4a53-9d0a-6f1f6f3f2c11",
    timezone: "Asia/Kolkata",
    createdAt: "2026-09-20T08:00:00.000Z",
    consents: consents.map((consent) => ({
      ...consent,
      acceptedAt: "2026-09-20T08:00:00.000Z",
    })),
  };
}

const currentConsents = consentKinds.map((kind) => ({
  kind,
  version: consentNoticeVersion,
}));

test("asks for consent when none is recorded", () => {
  expect(
    nextOnboardingStep({ me: meWithConsents([]), healthAccessRequested: true }),
  ).toBe("consent");
});

test("asks for consent when only the privacy notice is recorded", () => {
  const me = meWithConsents([
    { kind: "privacy_notice", version: consentNoticeVersion },
  ]);
  expect(nextOnboardingStep({ me, healthAccessRequested: true })).toBe(
    "consent",
  );
});

test("asks for consent again when both were given to an older notice", () => {
  const me = meWithConsents(
    consentKinds.map((kind) => ({ kind, version: "2026-01-01" })),
  );
  expect(nextOnboardingStep({ me, healthAccessRequested: true })).toBe(
    "consent",
  );
});

test("asks for health access once both consents are current", () => {
  expect(
    nextOnboardingStep({
      me: meWithConsents(currentConsents),
      healthAccessRequested: false,
    }),
  ).toBe("health-access");
});

test("goes home once consents are current and health access was requested", () => {
  expect(
    nextOnboardingStep({
      me: meWithConsents(currentConsents),
      healthAccessRequested: true,
    }),
  ).toBe("home");
});

test("counts a current consent even when an older one of the same kind is also recorded", () => {
  const me = meWithConsents([
    ...consentKinds.map((kind) => ({ kind, version: "2026-01-01" })),
    ...currentConsents,
  ]);
  expect(nextOnboardingStep({ me, healthAccessRequested: true })).toBe("home");
});
