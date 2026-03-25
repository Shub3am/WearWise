# syntax=docker/dockerfile:1
# Why: production image for the ingest service: a static Go binary on distroless.
# Must not: add a shell or package manager to the final image; the healthcheck is the binary itself.
FROM golang:1.27.1-trixie AS build
WORKDIR /src/apps/ingest
COPY apps/ingest/go.mod apps/ingest/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY apps/ingest/ ./
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ingest ./cmd/ingest

FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/ingest /ingest
EXPOSE 8080
ENTRYPOINT ["/ingest"]
