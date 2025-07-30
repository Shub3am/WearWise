// Why: the wire shapes of the signed in user's profile and consents, shared by the API and its clients.
// Must not: import database types or anything server only; mobile and web bundle this file.
import { z } from "zod";
import { timeZoneSchema } from "./time-zone.ts";

export const consentKinds = [
  "privacy_notice",
  "health_data_processing",
] as const;
export type ConsentKind = (typeof consentKinds)[number];

export const consentSchema = z.object({
  kind: z.enum(consentKinds),
  version: z.string(),
  acceptedAt: z.iso.datetime(),
});

export const meResponseSchema = z.object({
  id: z.uuid(),
  timezone: z.string(),
  createdAt: z.iso.datetime(),
  consents: z.array(consentSchema),
});
export type MeResponse = z.output<typeof meResponseSchema>;

export const updateMeRequestSchema = z.object({ timezone: timeZoneSchema });

export const recordConsentRequestSchema = z.object({
  kind: z.enum(consentKinds),
  version: z.string().min(1).max(32),
});
