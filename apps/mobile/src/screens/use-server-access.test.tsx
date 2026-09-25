import { useAuth } from "@clerk/expo";
import { renderHook } from "@testing-library/react-native";
import { readPublicConfig } from "../config/public-config.ts";
import { useServerAccess } from "./use-server-access.ts";

jest.mock("@clerk/expo", () => ({ useAuth: jest.fn() }));
jest.mock("../config/public-config.ts", () => ({
  readPublicConfig: jest.fn(),
}));

const publicConfig = {
  clerkPublishableKey: "pk_test_example",
  apiUrl: "https://api.example.com",
  ingestUrl: "https://ingest.example.com",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(readPublicConfig).mockReturnValue(publicConfig);
  // @clerk/expo's useAuth wraps @clerk/react's memoized getToken in a new closure on every render
  // (dist/hooks/useAuth.js), so each render must hand back a distinct jest.fn().
  jest
    .mocked(useAuth)
    .mockImplementation(() => ({ getToken: jest.fn() }) as never);
});

test("returns the same ServerAccess reference across renders", () => {
  const { result, rerender } = renderHook(() => useServerAccess());
  const first = result.current;
  rerender({});
  expect(result.current).toBe(first);
});

test("calls the getToken from the latest render, not the first", async () => {
  const { result, rerender } = renderHook(() => useServerAccess());
  rerender({});
  const latestGetToken = jest.mocked(useAuth).mock.results.at(-1)
    ?.value.getToken;
  await result.current.apiConnection.getSessionToken();
  expect(latestGetToken).toHaveBeenCalled();
});
