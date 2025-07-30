// Why: every stored time zone must be a name both JavaScript Intl and Go time.LoadLocation understand.
// Must not: accept UTC offsets; Go cannot load them and local day boundaries would break on DST.
import { z } from "zod";

export function canonicalTimeZone(candidate: string): string | undefined {
  try {
    const resolved = new Intl.DateTimeFormat("en", {
      timeZone: candidate,
    }).resolvedOptions().timeZone;
    // Intl accepts offset zones like "+05:30" (ECMA-402 2024); they are not IANA names.
    return /^[+-]/.test(resolved) ? undefined : resolved;
  } catch {
    return undefined;
  }
}

export const timeZoneSchema = z.string().transform((candidate, context) => {
  const canonical = canonicalTimeZone(candidate);
  if (canonical === undefined) {
    context.addIssue({ code: "custom", message: "Unknown IANA time zone" });
    return z.NEVER;
  }
  return canonical;
});
