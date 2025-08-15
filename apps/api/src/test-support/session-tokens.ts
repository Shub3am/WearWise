// Why: signs Clerk shaped session tokens with a local key so auth tests never call Clerk.
// Must not: be imported by production code.
import { generateKeyPairSync } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

export async function createSessionTokenSigner() {
  // Clerk's networkless PEM loader only understands RSA-2048 SPKI keys with exponent 65537 (Node's default).
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const signingKey = await importPKCS8(privateKey, "RS256");
  const nowInSeconds = () => Math.floor(Date.now() / 1000);

  // No azp claim: native app tokens have none, and the API must accept them.
  const signSessionToken = (
    clerkUserId: string,
    expiresAt = nowInSeconds() + 60,
  ) =>
    new SignJWT({
      sub: clerkUserId,
      sid: `sess_${clerkUserId}`,
      v: 2,
      sts: "active",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt(expiresAt - 60)
      .setNotBefore(expiresAt - 70)
      .setExpirationTime(expiresAt)
      .sign(signingKey);

  return { jwtKey: publicKey, signSessionToken };
}
