import { timeZoneToSave } from "./device-time-zone.ts";

test("saves the device zone when it differs from the saved one", () => {
  expect(timeZoneToSave("Europe/Berlin", "Asia/Kolkata")).toBe("Europe/Berlin");
});

test("saves nothing when the zones match", () => {
  expect(timeZoneToSave("Asia/Kolkata", "Asia/Kolkata")).toBeUndefined();
});

test("saves nothing when a legacy device name matches the saved current name", () => {
  expect(timeZoneToSave("Asia/Calcutta", "Asia/Kolkata")).toBeUndefined();
});

test("saves the current name for a legacy device name", () => {
  expect(timeZoneToSave("Asia/Calcutta", "UTC")).toBe("Asia/Kolkata");
});

test("saves nothing when the device reports no zone", () => {
  expect(timeZoneToSave(null, "Asia/Kolkata")).toBeUndefined();
});

test("saves nothing for an offset or unknown zone", () => {
  expect(timeZoneToSave("+05:30", "Asia/Kolkata")).toBeUndefined();
  expect(timeZoneToSave("Mars/Olympus_Mons", "Asia/Kolkata")).toBeUndefined();
});
