// Why: shows the consent notice and records both consents at its version when the user agrees.
// Must not: decide what comes after consent; home runs the onboarding check again.
import { consentKinds } from "@wearwise/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, ScrollView, Text } from "react-native";
import {
  consentNoticeParagraphs,
  consentNoticeVersion,
} from "../onboarding/consent-notice.ts";
import { recordConsent } from "../server-clients/api-client.ts";
import { useServerAccess } from "./use-server-access.ts";

export function ConsentScreen() {
  const router = useRouter();
  const { apiConnection } = useServerAccess();
  const [recordingFailed, setRecordingFailed] = useState(false);

  async function recordBothConsents() {
    try {
      await Promise.all(
        consentKinds.map((kind) =>
          recordConsent(apiConnection, kind, consentNoticeVersion),
        ),
      );
      router.replace("/");
    } catch {
      setRecordingFailed(true);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      {consentNoticeParagraphs.map((paragraph) => (
        <Text key={paragraph}>{paragraph}</Text>
      ))}
      {recordingFailed && <Text>Could not reach WearWise. Try again.</Text>}
      <Button
        title="Agree and continue"
        onPress={() => void recordBothConsents()}
      />
    </ScrollView>
  );
}
