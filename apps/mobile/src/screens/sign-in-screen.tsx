// Why: sign in and sign up in one screen, drawn by Clerk's native AuthView.
// Must not: navigate after sign in; the root navigator's guards move the user once Clerk reports a session.
import { AuthView } from "@clerk/expo/native";

export function SignInScreen() {
  return <AuthView mode="signInOrUp" />;
}
