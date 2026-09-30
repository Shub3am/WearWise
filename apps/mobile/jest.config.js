module.exports = {
  preset: "jest-expo",
  // react-native requires its modules lazily, so the first render in a file
  // compiles them inside that test. On CI the transform cache starts empty and
  // that first render alone took over 6 s.
  testTimeout: 30000,
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@clerk/.*|@kingstinct/.*|@react-native-healthkit/.*|react-native-health-connect|react-native-nitro-modules|standard-navigation))",
  ],
};
