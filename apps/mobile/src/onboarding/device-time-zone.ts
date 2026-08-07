// Why: decides whether the device's time zone should replace the saved one, so local days follow the user when they travel.
// Must not: read the device or call the API; the home screen passes the zones in and sends the update.
import { canonicalTimeZone } from "@wearwise/contracts";

export function timeZoneToSave(
  deviceTimeZone: string | null,
  savedTimeZone: string,
): string | undefined {
  if (deviceTimeZone === null) return undefined;
  const deviceZoneName = canonicalTimeZone(deviceTimeZone);
  if (deviceZoneName === undefined || deviceZoneName === savedTimeZone)
    return undefined;
  return deviceZoneName;
}
