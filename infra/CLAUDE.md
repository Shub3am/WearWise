# infra

Owns: how WearWise runs outside application code: the local dev stack and the production compose that Coolify deploys. Each service's Dockerfile lives beside its code.

Must not know about: application logic or schema contents (db/ owns schema).

Entry points: `docker compose -f infra/docker-compose.dev.yml up -d --wait`, `infra/check-dev-stack.sh`, `infra/check-prod-stack.sh`.

Invariants and gotchas:
- Redis runs with `maxmemory-policy noeviction`; BullMQ loses jobs under any evicting policy.
- Local ports are 55432 (Postgres) and 56379 (Redis) because 5432, 5433 and 6379 are used by other projects on the dev machine.
- `check-dev-stack.sh` runs its migration round trip on a separate `wearwise_check` database so it never rolls back dev data.
- The pgvector image tag pins both pgvector (0.8.6) and Postgres (18). Change them together.
- `compose.prod.yml` is what Coolify deploys. Coolify resolves build contexts from the Base Directory (repo root), so local runs must pass `--project-directory .`, as `check-prod-stack.sh` does.
- A failed migration fails the deploy, but under compose the old api container is already stopped: migrations must be backwards compatible (expand, then contract) and pass the up, rollback, up round trip.
- Coolify's Docker Compose build pack has no rolling updates; each deploy has a short gap.
- Postgres inside a Git compose application gets no Coolify scheduled S3 backups. Decide before launch (sub-project 11): standalone Coolify database, or a pg_dump sidecar.
- `exclude_from_hc: true` on `migrate` is a Coolify only key that plain `docker compose` rejects. It is not set; if Coolify marks the app unhealthy because `migrate` exited, add it then.

Callers: developers, CI (mirrors the Postgres image as a service container).
