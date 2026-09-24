// Why: the shape of the on-device store that keeps sync cursors, so readers take it as an argument and tests pass an
// in-memory one.
// Must not: hold sync logic or anything a server must see; it lives only on this device.
import Storage from "expo-sqlite/kv-store";

export type KeyValueStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  removeItemAsync(key: string): Promise<boolean>;
};

export const appKeyValueStore: KeyValueStore = Storage;
