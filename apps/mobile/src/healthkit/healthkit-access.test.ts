import {
  configureBackgroundTypes,
  isHealthDataAvailable,
  requestAuthorization,
} from "@kingstinct/react-native-healthkit";
import {
  healthKitReadTypes,
  requestHealthKitAccess,
} from "./healthkit-access.ts";

jest.mock("@kingstinct/react-native-healthkit", () => ({
  isHealthDataAvailable: jest.fn(),
  requestAuthorization: jest.fn(),
  configureBackgroundTypes: jest.fn(),
  UpdateFrequency: { immediate: 1, hourly: 2, daily: 3, weekly: 4 },
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requestAuthorization).mockResolvedValue(true);
  jest.mocked(configureBackgroundTypes).mockResolvedValue(true);
});

test("reads 21 types: 19 quantities, stand hours and sleep", () => {
  expect(healthKitReadTypes).toHaveLength(21);
  expect(healthKitReadTypes).toEqual(
    expect.arrayContaining([
      "HKCategoryTypeIdentifierAppleStandHour",
      "HKCategoryTypeIdentifierSleepAnalysis",
      "HKQuantityTypeIdentifierStepCount",
    ]),
  );
});

test("asks for read access and sets up hourly background delivery", async () => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(true);

  await expect(requestHealthKitAccess()).resolves.toBe(true);

  expect(requestAuthorization).toHaveBeenCalledWith({
    toRead: healthKitReadTypes,
  });
  expect(configureBackgroundTypes).toHaveBeenCalledWith(healthKitReadTypes, 2);
});

test("asks for nothing on a device without HealthKit", async () => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);

  await expect(requestHealthKitAccess()).resolves.toBe(false);

  expect(requestAuthorization).not.toHaveBeenCalled();
});
