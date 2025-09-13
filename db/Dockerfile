# Why: one shot migration image with the migrations baked in, so the deploy needs no bind mount.
# Must not: run anything but dbmate; build context is the repository root.
FROM ghcr.io/amacneil/dbmate:2.36.0
COPY db/migrations /db/migrations
USER nobody
ENTRYPOINT ["dbmate", "--migrations-dir", "/db/migrations", "--no-dump-schema", "--wait", "--wait-timeout", "60s"]
CMD ["up"]
