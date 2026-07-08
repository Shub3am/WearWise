// Why: ask once for read access to every record type the reader syncs, plus background reads and the history
// permission the 90 day backfill needs.
// Must not: read records.
import {
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import { syncedRecordTypes } from "./health-connect-records.ts";

// Resolves false when Health Connect is missing or needs an update; the screen tells the user what to install.
export async function requestHealthConnectAccess(): Promise<boolean> {
  if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE)
    return false;
  await initialize();
  await requestPermission([
    ...syncedRecordTypes.map((recordType) => ({
      accessType: "read" as const,
      recordType,
    })),
    { accessType: "read", recordType: "BackgroundAccessPermission" },
    // Without it Health Connect returns only the last 30 days. It never appears in getGrantedPermissions.
    { accessType: "read", recordType: "ReadHealthDataHistory" },
  ]);
  return true;
}
