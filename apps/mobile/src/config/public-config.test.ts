import { publicConfigFrom } from "./public-config.ts";

const complete = {
  clerkPublishableKey: "pk_test_abc",
  apiUrl: "http://10.0.2.2:3000",
  ingestUrl: "http://10.0.2.2:8080",
};

test("returns the config when every value is set", () => {
  expect(publicConfigFrom(complete)).toEqual(complete);
});

test.each(["clerkPublishableKey", "apiUrl", "ingestUrl"] as const)(
  "returns undefined when %s is empty",
  (name) => {
    expect(publicConfigFrom({ ...complete, [name]: "" })).toBeUndefined();
    expect(
      publicConfigFrom({ ...complete, [name]: undefined }),
    ).toBeUndefined();
  },
);
