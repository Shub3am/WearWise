import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { readPublicConfig } from "../config/public-config.ts";
import { getBackgroundSessionToken } from "./background-session-token.ts";
import {
  backgroundSyncTaskName,
  registerBackgroundSync,
  syncFromBackground,
} from "./background-sync-task.ts";
import { syncHealthData } from "./device-sync.ts";

jest.mock("expo-background-task", () => ({
  registerTaskAsync: jest.fn(),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));
jest.mock("../config/public-config.ts", () => ({
  readPublicConfig: jest.fn(),
}));
jest.mock("./background-session-token.ts", () => ({
  getBackgroundSessionToken: jest.fn(),
}));
jest.mock("./device-sync.ts", () => ({ syncHealthData: jest.fn() }));

// The task is defined once, when the module loads, so its call is read before any reset.
const definedTask = jest.mocked(TaskManager.defineTask).mock.calls[0];

const config = {
  clerkPublishableKey: "pk_test_x",
  apiUrl: "http://api.test",
  ingestUrl: "http://ingest.test",
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(readPublicConfig).mockReturnValue(config);
  jest.mocked(getBackgroundSessionToken).mockResolvedValue("background-token");
});

test("defines the task when the module loads, with the background sync as its handler", () => {
  expect(definedTask).toEqual(["wearwise-health-sync", syncFromBackground]);
  expect(backgroundSyncTaskName).toBe("wearwise-health-sync");
});

test("registers the task to run about once an hour", async () => {
  await registerBackgroundSync();

  expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
    "wearwise-health-sync",
    { minimumInterval: 60 },
  );
});

test("syncs to ingest with a session token read outside React", async () => {
  jest
    .mocked(syncHealthData)
    .mockResolvedValue({ outcome: "stored", storedBatchCount: 2 });

  await expect(syncFromBackground()).resolves.toBe(1);

  expect(syncHealthData).toHaveBeenCalledWith(
    "http://ingest.test",
    expect.any(Function),
  );
  const getSessionToken = jest.mocked(syncHealthData).mock.calls[0]?.[1];
  await expect(getSessionToken?.()).resolves.toBe("background-token");
  expect(getBackgroundSessionToken).toHaveBeenCalledWith("pk_test_x");
});

test.each(["signed_out", "consent_required", "rejected"] as const)(
  "reports a %s sync as failed",
  async (outcome) => {
    jest
      .mocked(syncHealthData)
      .mockResolvedValue({ outcome, storedBatchCount: 0 });

    await expect(syncFromBackground()).resolves.toBe(2);
  },
);

test("fails without syncing when the app has no configuration", async () => {
  jest.mocked(readPublicConfig).mockReturnValue(undefined);

  await expect(syncFromBackground()).resolves.toBe(2);

  expect(syncHealthData).not.toHaveBeenCalled();
});

test("reports a sync that throws as failed", async () => {
  jest
    .mocked(syncHealthData)
    .mockRejectedValue(new Error("network request failed"));

  await expect(syncFromBackground()).resolves.toBe(2);
});
