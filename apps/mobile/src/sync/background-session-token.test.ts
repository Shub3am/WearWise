import { getClerkInstance } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { getBackgroundSessionToken } from "./background-session-token.ts";

jest.mock("@clerk/expo", () => ({ getClerkInstance: jest.fn() }));
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: {} }));

beforeEach(() => {
  jest.resetAllMocks();
});

test("reuses an existing Clerk instance without passing a token cache", async () => {
  const clerk = {
    loaded: true,
    session: { getToken: jest.fn().mockResolvedValue("session-token") },
  };
  jest.mocked(getClerkInstance).mockReturnValue(clerk as never);

  await expect(getBackgroundSessionToken("pk_test_x")).resolves.toBe(
    "session-token",
  );

  expect(getClerkInstance).toHaveBeenCalledTimes(1);
  expect(getClerkInstance).toHaveBeenCalledWith();
});

test("creates a Clerk instance with the token cache when none exists yet", async () => {
  const clerk = {
    loaded: false,
    load: jest.fn().mockResolvedValue(undefined),
    session: { getToken: jest.fn().mockResolvedValue("session-token") },
  };
  jest
    .mocked(getClerkInstance)
    .mockImplementationOnce(() => {
      throw new Error("Missing publishableKey");
    })
    .mockImplementationOnce(() => clerk as never);

  await expect(getBackgroundSessionToken("pk_test_x")).resolves.toBe(
    "session-token",
  );

  expect(getClerkInstance).toHaveBeenNthCalledWith(2, {
    publishableKey: "pk_test_x",
    tokenCache,
  });
  expect(clerk.load).toHaveBeenCalledWith({ standardBrowser: false });
});
