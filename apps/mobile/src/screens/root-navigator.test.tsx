import { useAuth } from "@clerk/expo";
import { renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";
import { readPublicConfig } from "../config/public-config.ts";
import { RootNavigator } from "./root-navigator.tsx";

jest.mock("@clerk/expo", () => ({
  ClerkProvider: ({ children }: { children: unknown }) => children,
  useAuth: jest.fn(),
}));
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: {} }));
jest.mock("../config/public-config.ts", () => ({
  readPublicConfig: jest.fn(),
}));

const publicConfig = {
  clerkPublishableKey: "pk_test_example",
  apiUrl: "https://api.example.com",
  ingestUrl: "https://ingest.example.com",
};

function renderApp(initialUrl: string) {
  renderRouter(
    {
      _layout: RootNavigator,
      index: () => <Text>Home</Text>,
      consent: () => <Text>Consent</Text>,
      "health-access": () => <Text>Health access</Text>,
      "sign-in": () => <Text>Sign in</Text>,
    },
    { initialUrl },
  );
}

function setClerkState(clerkState: {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
}) {
  jest.mocked(useAuth).mockReturnValue(clerkState as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(readPublicConfig).mockReturnValue(publicConfig);
});

test("shows the missing configuration message when the public config is incomplete", () => {
  jest.mocked(readPublicConfig).mockReturnValue(undefined);
  renderApp("/");
  expect(
    screen.getByText("WearWise is missing its configuration"),
  ).toBeTruthy();
});

test("sends a signed out user to sign in", () => {
  setClerkState({ isLoaded: true, isSignedIn: false });
  renderApp("/");
  expect(screen).toHavePathname("/sign-in");
  expect(screen.getByText("Sign in")).toBeTruthy();
});

test("shows home to a signed in user", () => {
  setClerkState({ isLoaded: true, isSignedIn: true });
  renderApp("/");
  expect(screen).toHavePathname("/");
  expect(screen.getByText("Home")).toBeTruthy();
});

test("sends a signed in user away from sign in to home", () => {
  setClerkState({ isLoaded: true, isSignedIn: true });
  renderApp("/sign-in");
  expect(screen).toHavePathname("/");
  expect(screen.getByText("Home")).toBeTruthy();
});

test("shows no screen until Clerk has loaded", () => {
  setClerkState({ isLoaded: false, isSignedIn: undefined });
  renderApp("/");
  expect(screen.queryByText("Home")).toBeNull();
  expect(screen.queryByText("Sign in")).toBeNull();
});
