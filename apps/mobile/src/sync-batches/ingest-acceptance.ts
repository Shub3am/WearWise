// Why: drop the records the Go ingest would reject, because one invalid item makes it reject the whole batch with
// a 400 and the sync cursor would never move past that page.
// Must not: change values, units or times; it only filters.
import { metricCatalog } from "@wearwise/metrics-catalog";
import type {
  SampleBatch,
  WireSample,
  WireSleepSession,
} from "./wire-types.ts";
import { sleepStageNames } from "./wire-types.ts";

const maxExternalUuidRunes = 128;
const maxSourceRunes = 256;
const canonicalUnitByMetric = new Map<string, string>(
  metricCatalog.map((metric) => [metric.id, metric.unit]),
);

function isAcceptedText(text: string, maxRunes: number): boolean {
  return (
    text.length > 0 && !text.includes("\u0000") && [...text].length <= maxRunes
  );
}

// Go parses RFC 3339 with a four digit year; Date.parse also accepts expanded years like +010000.
function instantMillis(instant: string): number | undefined {
  if (!/^\d{4}-/.test(instant)) return undefined;
  const millis = Date.parse(instant);
  return Number.isFinite(millis) ? millis : undefined;
}

function isAcceptedSample(sample: WireSample): boolean {
  const startMillis = instantMillis(sample.startAt);
  const endMillis = instantMillis(sample.endAt);
  return (
    sample.metric !== "sleep_analysis" &&
    canonicalUnitByMetric.get(sample.metric) === sample.unit &&
    Number.isFinite(sample.value) &&
    isAcceptedText(sample.externalUuid, maxExternalUuidRunes) &&
    isAcceptedText(sample.source, maxSourceRunes) &&
    startMillis !== undefined &&
    endMillis !== undefined &&
    endMillis >= startMillis
  );
}

function keepAcceptedSession(
  session: WireSleepSession,
): WireSleepSession | undefined {
  const sessionStart = instantMillis(session.startAt);
  const sessionEnd = instantMillis(session.endAt);
  if (
    !isAcceptedText(session.externalUuid, maxExternalUuidRunes) ||
    !isAcceptedText(session.source, maxSourceRunes) ||
    sessionStart === undefined ||
    sessionEnd === undefined ||
    sessionEnd <= sessionStart
  ) {
    return undefined;
  }
  const stages = session.stages.filter((stage) => {
    const stageStart = instantMillis(stage.startAt);
    const stageEnd = instantMillis(stage.endAt);
    return (
      sleepStageNames.includes(stage.stage) &&
      stageStart !== undefined &&
      stageEnd !== undefined &&
      stageStart <= stageEnd &&
      stageStart >= sessionStart &&
      stageEnd <= sessionEnd
    );
  });
  return { ...session, stages };
}

export function keepWhatIngestAccepts(batch: SampleBatch): SampleBatch {
  return {
    samples: batch.samples.filter(isAcceptedSample),
    sleepSessions: batch.sleepSessions.flatMap(
      (session) => keepAcceptedSession(session) ?? [],
    ),
  };
}
