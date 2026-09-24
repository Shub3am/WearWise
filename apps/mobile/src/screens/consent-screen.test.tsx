import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { useRouter } from "expo-router";
import {
  consentNoticeParagraphs,
  consentNoticeVersion,
} from "../onboarding/consent-notice.ts";
import { recordConsent } from "../server-clients/api-client.ts";
import { ConsentScreen } from "./consent-screen.tsx";
import { useServerAccess } from "./use-server-access.ts";

jest.mock("expo-router", () => ({ useRouter: jest.fn() }));
jest.mock("./use-server-access.ts", () => ({ useServerAccess: jest.fn() }));
jest.mock("../server-clients/api-client.ts", () => ({
  recordConsent: jest.fn(),
}));

const replace = jest.fn();
const apiConnection = {
  baseUrl: "https://api.example.com",
  fetchFromServer: jest.fn(),
  getSessionToken: async () => "session-token",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useRouter).mockReturnValue({ replace } as never);
  jest.mocked(useServerAccess).mockReturnValue({
    apiConnection,
    ingestUrl: "https://ingest.example.com",
  });
  jest.mocked(recordConsent).mockResolvedValue(undefined);
});

test("shows every paragraph of the notice", () => {
  render(<ConsentScreen />);
  for (const paragraph of consentNoticeParagraphs)
    expect(screen.getByText(paragraph)).toBeTruthy();
});

test("records both consents at the notice version, then goes home", async () => {
  render(<ConsentScreen />);
  fireEvent.press(screen.getByText("Agree and continue"));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(recordConsent).toHaveBeenCalledWith(
    apiConnection,
    "privacy_notice",
    consentNoticeVersion,
  );
  expect(recordConsent).toHaveBeenCalledWith(
    apiConnection,
    "health_data_processing",
    consentNoticeVersion,
  );
});

test("stays on the notice and says so when the API cannot be reached", async () => {
  jest
    .mocked(recordConsent)
    .mockRejectedValue(new TypeError("Network request failed"));
  render(<ConsentScreen />);
  fireEvent.press(screen.getByText("Agree and continue"));
  expect(
    await screen.findByText("Could not reach WearWise. Try again."),
  ).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});
