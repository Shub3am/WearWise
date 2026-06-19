// Why: a screen, a HealthKit wake and the Android task can all ask for a sync at once; two runs would read the same
// cursor and post the same pages twice.
// Must not: queue or retry; a call during a run gets that run's result, and its own arguments are ignored.

export function singleFlight<Args extends unknown[], Result>(
  run: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  let runningPromise: Promise<Result> | undefined;
  return (...args) => {
    runningPromise ??= run(...args).finally(() => {
      runningPromise = undefined;
    });
    return runningPromise;
  };
}
