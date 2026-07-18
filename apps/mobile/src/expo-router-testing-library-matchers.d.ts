// Why: expo-router/testing-library registers toHavePathname on expect() at runtime
// (expo-router/build/testing-library/expect.js) but ships no type declaration for it, so
// TypeScript does not know screen.test.tsx files can call it without this augmentation.
// Must not: declare a matcher expo-router does not register.
declare namespace jest {
  interface Matchers<R> {
    toHavePathname(pathname: string): R;
  }
}
