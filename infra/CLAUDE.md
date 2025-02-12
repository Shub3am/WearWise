# infra

Owns: how WearWise runs outside application code: the local dev stack now, Dockerfiles and the Coolify compose later.

Must not know about: application logic or schema contents (db/ owns schema).

Entry points: `docker compose -f infra/docker-compose.dev.yml up -d --wait`, `infra/check-dev-stack.sh`.

Invariants and gotchas:
- Redis runs with `maxmemory-policy noeviction`; BullMQ loses jobs under any evicting policy.
- Local ports are 55432 (Postgres) and 56379 (Redis) because 5432, 5433 and 6379 are used by other projects on the dev machine.
- The pgvector image tag pins both pgvector (0.8.6) and Postgres (18). Change them together.

Callers: developers, CI (mirrors the Postgres image as a service container).
