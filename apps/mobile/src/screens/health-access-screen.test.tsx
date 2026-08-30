import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import { requestHealthConnectAccess } from "../health-connect/health-connect-access.ts";
import { requestHealthKitAccess } from "../healthkit/healthkit-access.ts";
import { healthAccessRequestedKey } from "../onboarding/onboarding-step.ts";
import { appKeyValueStore } from "../storage/key-value-store.ts";
import { HealthAccessScreen } from "./health-access-screen.tsx";

jest.mock("expo-router", () => ({ useRouter: jest.fn() }));
jest.mock("../healthkit/healthkit-access.ts", () => ({
  requestHealthKitAccess: jest.fn(),
}));
jest.mock("../health-connect/health-connect-access.ts", () => ({
  requestHealthConnectAccess: jest.fn(),
}));
jest.mock("../storage/key-value-store.ts", () => {
  const { createInMemoryKeyValueStore } = jest.requireActual(
    "../storage/in-memory-key-value-store.ts",
  );
  return { appKeyValueStore: createInMemoryKeyValueStore() };
});

const replace = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useRouter).mockReturnValue({ replace } as never);
  await appKeyValueStore.removeItemAsync(healthAccessRequestedKey);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("asks Health Connect on Android, remembers it asked, then goes home", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  jest.mocked(requestHealthConnectAccess).mockResolvedValue(true);
  render(<HealthAccessScreen />);
  fireEvent.press(screen.getByRole("button", { name: /continue/i }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(await appKeyValueStore.getItemAsync(healthAccessRequestedKey)).toBe(
    "yes",
  );
  expect(requestHealthKitAccess).not.toHaveBeenCalled();
});

test("asks HealthKit on iOS, then goes home", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  jest.mocked(requestHealthKitAccess).mockResolvedValue(true);
  render(<HealthAccessScreen />);
  fireEvent.press(screen.getByRole("button", { name: /continue/i }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(requestHealthConnectAccess).not.toHaveBeenCalled();
});

test("tells the user when the Health Connect permission request fails", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  jest
    .mocked(requestHealthConnectAccess)
    .mockRejectedValue(new Error("activity not found"));
  render(<HealthAccessScreen />);
  fireEvent.press(screen.getByRole("button", { name: /continue/i }));
  expect(
    await screen.findByText(
      "WearWise could not open the Health Connect permission screen. Try again.",
    ),
  ).toBeTruthy();
  expect(
    await appKeyValueStore.getItemAsync(healthAccessRequestedKey),
  ).toBeNull();
  expect(replace).not.toHaveBeenCalled();
});

test("stays and explains when Health Connect is not available", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  jest.mocked(requestHealthConnectAccess).mockResolvedValue(false);
  render(<HealthAccessScreen />);
  fireEvent.press(screen.getByRole("button", { name: /continue/i }));
  expect(
    await screen.findByText(
      "Health Connect is not available on this phone. Install or update it from Google Play, then try again.",
    ),
  ).toBeTruthy();
  expect(
    await appKeyValueStore.getItemAsync(healthAccessRequestedKey),
  ).toBeNull();
  expect(replace).not.toHaveBeenCalled();
});
