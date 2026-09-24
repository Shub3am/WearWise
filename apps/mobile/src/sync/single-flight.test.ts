import { singleFlight } from "./single-flight.ts";

function controllableRun() {
  const resolvers: ((value: string) => void)[] = [];
  const rejecters: ((reason: Error) => void)[] = [];
  const run = jest.fn(
    (label: string) =>
      new Promise<string>((resolve, reject) => {
        resolvers.push(() => resolve(label));
        rejecters.push(reject);
      }),
  );
  return { run, resolvers, rejecters };
}

test("calls made while a run is going share that run", async () => {
  const { run, resolvers } = controllableRun();
  const syncOnce = singleFlight(run);

  const first = syncOnce("first");
  const second = syncOnce("second");
  resolvers[0]?.("first");

  await expect(Promise.all([first, second])).resolves.toEqual([
    "first",
    "first",
  ]);
  expect(run).toHaveBeenCalledTimes(1);
});

test("a call after the run finished starts a new run", async () => {
  const { run, resolvers } = controllableRun();
  const syncOnce = singleFlight(run);

  const first = syncOnce("first");
  resolvers[0]?.("first");
  await first;
  const second = syncOnce("second");
  resolvers[1]?.("second");

  await expect(second).resolves.toBe("second");
  expect(run).toHaveBeenCalledTimes(2);
});

test("a call after a failed run starts a new run", async () => {
  const { run, resolvers, rejecters } = controllableRun();
  const syncOnce = singleFlight(run);

  const first = syncOnce("first");
  rejecters[0]?.(new Error("offline"));
  await expect(first).rejects.toThrow("offline");
  const second = syncOnce("second");
  resolvers[1]?.("second");

  await expect(second).resolves.toBe("second");
});
