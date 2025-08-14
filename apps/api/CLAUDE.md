# apps/api

Owns: the Fastify product API: authentication of Clerk session tokens, the signed in user's profile and consents, the Clerk webhook, and the health check.

Must not know about: BullMQ jobs, OpenRouter, raw health sample ingest (Go owns that), or how the mobile app stores anything. It never writes Go owned health tables.

Entry points: `src/server.ts` (process), `src/app.ts` (`buildApp`, used by tests and the server).

Invariants and gotchas:
- `readApiConfig` is the only reader of `process.env`. Clerk options are passed explicitly, not picked up from env.
- Every route under `/v1` sits in the authenticated scope and needs a valid Clerk session token. Add new user routes inside that scope, never beside it.
- `CLERK_JWT_KEY` must be an RSA-2048 SPKI PEM with real newlines; Clerk's loader rejects escaped `\n` and 4096 bit keys with token-invalid-signature.
- `authorizedParties` is deliberately unset: native app tokens carry no `azp` and Clerk rejects them when it is set.
- Node runs the TS source directly. Type only imports must be written `import type` or `import { type X }`.
- Tests run against `wearwise_test` (run `pnpm db:test:up` first) and use unique Clerk ids per test instead of truncating, so files run in parallel safely.

Callers: `apps/mobile` and `apps/web` over HTTP, Clerk webhooks, the container healthcheck.
