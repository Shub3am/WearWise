// Why: every stored time zone must be a current IANA name that JavaScript Intl, Go time.LoadLocation and Postgres all understand.
// Must not: accept UTC offsets or SystemV zones; Go and Postgres cannot load them and local day boundaries would break on DST.
import { z } from "zod";

// ICU canonicalizes to the oldest IANA link name, and Debian's tzdata (which Postgres reads) no longer ships these links.
const currentNameByIcuLegacyName: Record<string, string> = {
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
};

export function canonicalTimeZone(candidate: string): string | undefined {
  try {
    const resolved = new Intl.DateTimeFormat("en", {
      timeZone: candidate,
    }).resolvedOptions().timeZone;
    // Intl accepts offset zones like "+05:30" (ECMA-402 2024); they are not IANA names.
    if (/^[+-]/.test(resolved) || resolved.startsWith("SystemV/")) {
      return undefined;
    }
    return currentNameByIcuLegacyName[resolved] ?? resolved;
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
