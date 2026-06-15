// Why: a KeyValueStore for tests, because jest-expo stubs the SQLite native module and the real store keeps nothing.
// Must not: be imported by app code.
import type { KeyValueStore } from "./key-value-store.ts";

export function createInMemoryKeyValueStore(
  initial: Record<string, string> = {},
): KeyValueStore {
  const values = new Map(Object.entries(initial));
  return {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      values.set(key, value);
    },
    removeItemAsync: async (key) => values.delete(key),
  };
}
