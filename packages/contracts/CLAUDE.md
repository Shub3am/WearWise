# packages/contracts

Owns: zod schemas for every JSON body the API accepts or returns, shared by the API, mobile and web.

Must not know about: the database, Fastify, Clerk, Node only APIs. Mobile and web bundle it.

Entry points: `@wearwise/contracts`.

Invariants and gotchas:
- A schema here is a public contract once a released mobile build depends on it. Add fields, do not rename or tighten them.
- Time zones are validated through `Intl` and stored in the canonical casing Intl returns. UTC offsets are rejected because Go's `time.LoadLocation` cannot load them.
- Request schemas may transform (time zone canonicalisation); Fastify hands handlers the transformed output.

Callers: `apps/api`. Later `apps/mobile`, `apps/web`, `apps/worker`.
