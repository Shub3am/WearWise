// Why: signs webhook bodies exactly as Clerk's Svix sender does, so webhook tests need no Clerk account.
// Must not: be imported by production code.
import { randomBytes, randomUUID } from "node:crypto";
import { Webhook } from "svix";

export function createWebhookSigner() {
  const signingSecret = `whsec_${randomBytes(24).toString("base64")}`;
  const svix = new Webhook(signingSecret);
  const signedHeaders = (
    rawBody: string,
    deliveryId = `msg_${randomUUID()}`,
  ) => {
    const sentAt = new Date();
    return {
      "content-type": "application/json",
      "svix-id": deliveryId,
      "svix-timestamp": String(Math.floor(sentAt.getTime() / 1000)),
      "svix-signature": svix.sign(deliveryId, sentAt, rawBody),
    };
  };
  return { signingSecret, signedHeaders };
}
