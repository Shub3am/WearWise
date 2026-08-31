import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { consentKinds, type MeResponse } from "@wearwise/contracts";
import { getCalendars } from "expo-localization";
import { useRouter } from "expo-router";
import { consentNoticeVersion } from "../onboarding/consent-notice.ts";
import { healthAccessRequestedKey } from "../onboarding/onboarding-step.ts";
import { fetchMe, updateTimeZone } from "../server-clients/api-client.ts";
import type { IngestOutcome } from "../server-clients/ingest-client.ts";
import { appKeyValueStore } from "../storage/key-value-store.ts";
import { syncHealthData } from "../sync/device-sync.ts";
import { HomeScreen } from "./home-screen.tsx";
import { useServerAccess } from "./use-server-access.ts";

jest.mock("expo-router", () => ({ useRouter: jest.fn() }));
jest.mock("expo-localization", () => ({ getCalendars: jest.fn() }));
jest.mock("./use-server-access.ts", () => ({ useServerAccess: jest.fn() }));
jest.mock("../server-clients/api-client.ts", () => ({
  fetchMe: jest.fn(),
  updateTimeZone: jest.fn(),
}));
jest.mock("../sync/device-sync.ts", () => ({ syncHealthData: jest.fn() }));
jest.mock("../storage/key-value-store.ts", () => {
  const { createInMemoryKeyValueStore } = jest.requireActual(
    "../storage/in-memory-key-value-store.ts",
  );
  return { appKeyValueStore: createInMemoryKeyValueStore() };
});

const replace = jest.fn();
const ingestUrl = "https://ingest.example.com";
const apiConnection = {
  baseUrl: "https://api.example.com",
  fetchFromServer: jest.fn(),
  getSessionToken: async () => "session-token",
};

function meWith({ consented }: { consented: boolean }): MeResponse {
  return {
    id: "0f8c6a52-6c1e-4a53-9d0a-6f1f6f3f2c11",
    timezone: "Asia/Kolkata",
    createdAt: "2026-09-20T08:00:00.000Z",
    consents: consented
      ? consentKinds.map((kind) => ({
          kind,
          version: consentNoticeVersion,
          acceptedAt: "2026-09-20T08:00:00.000Z",
        }))
      : [],
  };
}

function setDeviceTimeZone(timeZone: string | null) {
  jest.mocked(getCalendars).mockReturnValue([{ timeZone }] as never);
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useRouter).mockReturnValue({ replace } as never);
  jest.mocked(useServerAccess).mockReturnValue({ apiConnection, ingestUrl });
  jest.mocked(fetchMe).mockResolvedValue(meWith({ consented: true }));
  jest
    .mocked(syncHealthData)
    .mockResolvedValue({ outcome: "stored", storedBatchCount: 2 });
  setDeviceTimeZone("Asia/Kolkata");
  await appKeyValueStore.setItemAsync(healthAccessRequestedKey, "yes");
});

test("sends a user without current consents to the consent screen, before any sync", async () => {
  jest.mocked(fetchMe).mockResolvedValue(meWith({ consented: false }));
  render(<HomeScreen />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/consent"));
  expect(syncHealthData).not.toHaveBeenCalled();
});

test("sends a consented user who was never asked for health access to that screen", async () => {
  await appKeyValueStore.removeItemAsync(healthAccessRequestedKey);
  render(<HomeScreen />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/health-access"));
  expect(syncHealthData).not.toHaveBeenCalled();
});

test("saves the device time zone before syncing when it differs from the saved one", async () => {
  setDeviceTimeZone("Europe/Berlin");
  render(<HomeScreen />);
  expect(
    await screen.findByText("Up to date. New health data sent."),
  ).toBeTruthy();
  expect(updateTimeZone).toHaveBeenCalledWith(apiConnection, "Europe/Berlin");
});

test("syncs with the ingest url and the session token getter, leaving a matching time zone alone", async () => {
  render(<HomeScreen />);
  expect(
    await screen.findByText("Up to date. New health data sent."),
  ).toBeTruthy();
  expect(syncHealthData).toHaveBeenCalledWith(
    ingestUrl,
    apiConnection.getSessionToken,
  );
  expect(updateTimeZone).not.toHaveBeenCalled();
});

test.each<[IngestOutcome, number, string]>([
  ["stored", 0, "Up to date. Nothing new to send."],
  [
    "signed_out",
    0,
    "WearWise could not confirm your sign in. Try again in a moment.",
  ],
  [
    "consent_required",
    0,
    "WearWise cannot store health data until your consent is recorded. Try again in a moment.",
  ],
  [
    "rejected",
    1,
    "Some health data could not be sent. WearWise will try again on the next sync.",
  ],
])(
  "says what a %s sync with %i stored batches means",
  async (outcome, storedBatchCount, message) => {
    jest
      .mocked(syncHealthData)
      .mockResolvedValue({ outcome, storedBatchCount });
    render(<HomeScreen />);
    expect(await screen.findByText(message)).toBeTruthy();
  },
);

test("shows a retry when WearWise cannot be reached, and syncs when it is pressed", async () => {
  jest
    .mocked(fetchMe)
    .mockRejectedValueOnce(new TypeError("Network request failed"));
  render(<HomeScreen />);
  expect(
    await screen.findByText(
      "Could not finish syncing. Check your connection and try again.",
    ),
  ).toBeTruthy();
  fireEvent.press(screen.getByText("Try again"));
  expect(
    await screen.findByText("Up to date. New health data sent."),
  ).toBeTruthy();
});
