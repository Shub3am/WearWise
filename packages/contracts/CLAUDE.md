# packages/contracts

Owns: zod schemas for every JSON body the API accepts or returns, shared by the API, mobile and web.

Must not know about: the database, Fastify, Clerk, Node only APIs. Mobile and web bundle it.

Entry points: `@wearwise/contracts`.

Invariants and gotchas:
- A schema here is a public contract once a released mobile build depends on it. Add fields, do not rename or tighten them.
- Time zones are validated through `Intl`, then ICU's legacy link names (Asia/Calcutta, Europe/Kiev and 16 more) are mapped to current IANA names, because Debian's tzdata in the Postgres image no longer ships those links. UTC offsets and `SystemV/*` are rejected because Go's `time.LoadLocation` cannot load them. `apps/api/src/users/stored-time-zone.test.ts` checks every accepted zone against `pg_timezone_names`; if it fails after a Node or Postgres upgrade, extend the map.
- Request schemas may transform (time zone canonicalisation); Fastify hands handlers the transformed output.

Callers: `apps/api`, `apps/mobile`. Later `apps/web`, `apps/worker`.
