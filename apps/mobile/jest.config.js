module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@clerk/.*|@kingstinct/.*|@react-native-healthkit/.*|react-native-health-connect|react-native-nitro-modules))",
  ],
};
