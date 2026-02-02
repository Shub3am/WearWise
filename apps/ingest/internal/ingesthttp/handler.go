// Why: turns ingest HTTP requests into batch writes and status codes for the mobile app and the container probe.
// Must not: validate sample fields or write SQL itself.
package ingesthttp

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/batchwriter"
	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
	"github.com/Shub3am/WearWise/apps/ingest/internal/sessiontoken"
	"github.com/Shub3am/WearWise/apps/ingest/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Dependencies struct {
	Pool     *pgxpool.Pool
	Verifier *sessiontoken.Verifier
	Now      func() time.Time
	Logger   *slog.Logger
}

func NewHandler(dependencies Dependencies) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(writer http.ResponseWriter, request *http.Request) {
		serveHealth(writer, request, dependencies.Pool)
	})
	mux.HandleFunc("POST /v1/samples", func(writer http.ResponseWriter, request *http.Request) {
		serveSamples(writer, request, dependencies)
	})
	return mux
}

func serveHealth(writer http.ResponseWriter, request *http.Request, pool *pgxpool.Pool) {
	pingContext, cancelPing := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancelPing()
	if err := pool.Ping(pingContext); err != nil {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
}

func serveSamples(writer http.ResponseWriter, request *http.Request, dependencies Dependencies) {
	token, hasBearer := strings.CutPrefix(request.Header.Get("Authorization"), "Bearer ")
	if !hasBearer {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}
	clerkUserID, err := dependencies.Verifier.ClerkUserID(request.Context(), token)
	if err != nil {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}
	userID, err := store.New(dependencies.Pool).FindUserIDWithHealthDataConsent(request.Context(), clerkUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "health_data_processing consent required"})
		return
	}
	if err != nil {
		respondInternalError(writer, dependencies.Logger, "find consented user", err)
		return
	}
	body, rejection := readRequestBody(writer, request)
	if rejection != nil {
		writeJSON(writer, rejection.status, map[string]string{"error": rejection.message})
		return
	}
	batch, err := samplebatch.Decode(body, dependencies.Now())
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if batch.SkippedSampleCount > 0 {
		dependencies.Logger.Info("skipped samples outside the retention window", "user_id", userID, "skipped_count", batch.SkippedSampleCount)
	}
	if err := batchwriter.Write(request.Context(), dependencies.Pool, userID, batch); err != nil {
		respondInternalError(writer, dependencies.Logger, "write batch", err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

func writeJSON(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	json.NewEncoder(writer).Encode(body)
}

// The client gets no detail, because pgx errors carry query text and parameters.
func respondInternalError(writer http.ResponseWriter, logger *slog.Logger, action string, err error) {
	logger.Error(action+" failed", "error", err)
	writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "Internal Server Error"})
}
