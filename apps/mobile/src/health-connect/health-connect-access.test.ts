import {
  getSdkStatus,
  initialize,
  requestPermission,
} from "react-native-health-connect";
import { requestHealthConnectAccess } from "./health-connect-access.ts";

jest.mock("react-native-health-connect", () => ({
  getSdkStatus: jest.fn(),
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(initialize).mockResolvedValue(true);
  jest.mocked(requestPermission).mockResolvedValue([]);
});

test("asks for read access to every synced type, background reads and history", async () => {
  jest.mocked(getSdkStatus).mockResolvedValue(3);

  await expect(requestHealthConnectAccess()).resolves.toBe(true);

  expect(initialize).toHaveBeenCalled();
  expect(requestPermission).toHaveBeenCalledWith([
    { accessType: "read", recordType: "Steps" },
    { accessType: "read", recordType: "Distance" },
    { accessType: "read", recordType: "FloorsClimbed" },
    { accessType: "read", recordType: "ActiveCaloriesBurned" },
    { accessType: "read", recordType: "HeartRate" },
    { accessType: "read", recordType: "RestingHeartRate" },
    { accessType: "read", recordType: "HeartRateVariabilityRmssd" },
    { accessType: "read", recordType: "RespiratoryRate" },
    { accessType: "read", recordType: "OxygenSaturation" },
    { accessType: "read", recordType: "SleepSession" },
    { accessType: "read", recordType: "BackgroundAccessPermission" },
    { accessType: "read", recordType: "ReadHealthDataHistory" },
  ]);
});

test.each([1, 2])(
  "asks for nothing when Health Connect status is %i",
  async (sdkStatus) => {
    jest.mocked(getSdkStatus).mockResolvedValue(sdkStatus);

    await expect(requestHealthConnectAccess()).resolves.toBe(false);

    expect(initialize).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  },
);
