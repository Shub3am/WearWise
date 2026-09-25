// Why: the one sync that runs without a screen, used by Android's periodic task and by iOS HealthKit wakes, with the
// session token read outside React.
// Must not: register the periodic task on iOS; index.ts only calls registerBackgroundSync on Android.
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { readPublicConfig } from "../config/public-config.ts";
import { getBackgroundSessionToken } from "./background-session-token.ts";
import { syncHealthData } from "./device-sync.ts";

export const backgroundSyncTaskName = "wearwise-health-sync";

export async function syncFromBackground(): Promise<BackgroundTask.BackgroundTaskResult> {
  const config = readPublicConfig();
  if (config === undefined) return BackgroundTask.BackgroundTaskResult.Failed;
  try {
    const result = await syncHealthData(config.ingestUrl, () =>
      getBackgroundSessionToken(config.clerkPublishableKey),
    );
    return result.outcome === "stored"
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    // A background wake with no network makes fetch throw, which is normal, not a bug to surface.
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

// expo-task-manager finds a task's handler only if it was defined at module scope during the launch that runs it.
TaskManager.defineTask(backgroundSyncTaskName, syncFromBackground);

// The OS decides when the task runs; 60 minutes is the shortest gap it will honour, not a schedule.
export function registerBackgroundSync(): Promise<void> {
  return BackgroundTask.registerTaskAsync(backgroundSyncTaskName, {
    minimumInterval: 60,
  });
}
