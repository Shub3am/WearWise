package ingesthttp_test

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/ingesthttp"
	"github.com/Shub3am/WearWise/apps/ingest/internal/sessiontoken"
	"github.com/Shub3am/WearWise/apps/ingest/internal/sessiontoken/sessiontokentest"
	"github.com/Shub3am/WearWise/apps/ingest/internal/testdatabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const unreachableDatabaseURL = "postgres://wearwise:wearwise@127.0.0.1:1/wearwise?sslmode=disable&connect_timeout=1"

type testServer struct {
	handler http.Handler
	signer  *sessiontokentest.Signer
	pool    *pgxpool.Pool
}

func newTestServer(t testing.TB, pool *pgxpool.Pool) testServer {
	t.Helper()
	signer := sessiontokentest.NewSigner(t)
	verifier, err := sessiontoken.NewVerifier(signer.PublicKeyPEM)
	if err != nil {
		t.Fatal(err)
	}
	handler := ingesthttp.NewHandler(ingesthttp.Dependencies{
		Pool:     pool,
		Verifier: verifier,
		Now:      time.Now,
		Logger:   slog.New(slog.DiscardHandler),
	})
	return testServer{handler: handler, signer: signer, pool: pool}
}

func openUnreachablePool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	// pgxpool.New does not connect, so this succeeds and every query fails.
	pool, err := pgxpool.New(t.Context(), unreachableDatabaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func (server testServer) postSamples(t testing.TB, headers map[string]string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/v1/samples", bytes.NewReader(body))
	for headerName, headerValue := range headers {
		request.Header.Set(headerName, headerValue)
	}
	recorder := httptest.NewRecorder()
	server.handler.ServeHTTP(recorder, request)
	return recorder
}

func (server testServer) bearer(t testing.TB, clerkUserID string) map[string]string {
	t.Helper()
	return map[string]string{"Authorization": "Bearer " + server.signer.SignSessionToken(t, clerkUserID, nil)}
}

func requireResponse(t *testing.T, recorder *httptest.ResponseRecorder, wantStatus int, wantBody string) {
	t.Helper()
	gotBody := strings.TrimSpace(recorder.Body.String())
	if recorder.Code != wantStatus || gotBody != wantBody {
		t.Fatalf("got %d %s, want %d %s", recorder.Code, gotBody, wantStatus, wantBody)
	}
}

func gzipped(t testing.TB, body []byte) []byte {
	t.Helper()
	var compressed bytes.Buffer
	gzipWriter := gzip.NewWriter(&compressed)
	if _, err := gzipWriter.Write(body); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	return compressed.Bytes()
}

func heartRateBatch(t *testing.T, startAt time.Time) []byte {
	t.Helper()
	formattedStartAt := startAt.UTC().Format(time.RFC3339Nano)
	body, err := json.Marshal(map[string]any{"samples": []any{map[string]any{
		"metric": "heart_rate", "externalUuid": uuid.NewString(), "startAt": formattedStartAt, "endAt": formattedStartAt,
		"value": 64, "unit": "bpm", "source": "com.apple.health",
	}}})
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func storedSampleCount(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) int {
	t.Helper()
	var sampleCount int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM health_samples WHERE user_id = $1", userID).Scan(&sampleCount); err != nil {
		t.Fatal(err)
	}
	return sampleCount
}

func TestPostSamplesRejectsMissingToken(t *testing.T) {
	server := newTestServer(t, testdatabase.Open(t))
	requireResponse(t, server.postSamples(t, nil, heartRateBatch(t, time.Now())), http.StatusUnauthorized, `{"error":"Unauthorized"}`)
}

func TestPostSamplesRejectsTokenFromAnotherSigner(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	_, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	otherSigner := sessiontokentest.NewSigner(t)
	headers := map[string]string{"Authorization": "Bearer " + otherSigner.SignSessionToken(t, clerkUserID, nil)}
	requireResponse(t, server.postSamples(t, headers, heartRateBatch(t, time.Now())), http.StatusUnauthorized, `{"error":"Unauthorized"}`)
}

func TestPostSamplesRejectsUserWithoutConsent(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	_, clerkUserID := testdatabase.CreateUserWithoutConsent(t, pool)
	requireResponse(t, server.postSamples(t, server.bearer(t, clerkUserID), heartRateBatch(t, time.Now())),
		http.StatusForbidden, `{"error":"health_data_processing consent required"}`)
}

func TestPostSamplesRejectsUnknownUser(t *testing.T) {
	server := newTestServer(t, testdatabase.Open(t))
	requireResponse(t, server.postSamples(t, server.bearer(t, "user_"+uuid.NewString()), heartRateBatch(t, time.Now())),
		http.StatusForbidden, `{"error":"health_data_processing consent required"}`)
}

func TestPostSamplesStoresGzipBatch(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	userID, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	headers := server.bearer(t, clerkUserID)
	headers["Content-Encoding"] = "gzip"
	requireResponse(t, server.postSamples(t, headers, gzipped(t, heartRateBatch(t, time.Now()))), http.StatusNoContent, "")
	if sampleCount := storedSampleCount(t, pool, userID); sampleCount != 1 {
		t.Fatalf("stored %d samples, want 1", sampleCount)
	}
}

func TestPostSamplesStoresIdentityBatch(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	userID, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	requireResponse(t, server.postSamples(t, server.bearer(t, clerkUserID), heartRateBatch(t, time.Now())), http.StatusNoContent, "")
	if sampleCount := storedSampleCount(t, pool, userID); sampleCount != 1 {
		t.Fatalf("stored %d samples, want 1", sampleCount)
	}
}

func TestPostSamplesSkipsSamplesPastRetention(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	userID, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	hundredDaysAgo := time.Now().Add(-100 * 24 * time.Hour)
	requireResponse(t, server.postSamples(t, server.bearer(t, clerkUserID), heartRateBatch(t, hundredDaysAgo)), http.StatusNoContent, "")
	if sampleCount := storedSampleCount(t, pool, userID); sampleCount != 0 {
		t.Fatalf("stored %d samples, want 0", sampleCount)
	}
}

func TestPostSamplesRejectsInvalidBatch(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	_, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	invalidBatch := []byte(`{"samples":[{"metric":"heart_rate","externalUuid":"a","startAt":"2026-09-23T10:00:00Z","endAt":"2026-09-23T10:00:00Z","value":64,"unit":"count/min","source":"s"}]}`)
	requireResponse(t, server.postSamples(t, server.bearer(t, clerkUserID), invalidBatch),
		http.StatusBadRequest, `{"error":"samples[0].unit: must be \"bpm\" for heart_rate, got \"count/min\""}`)
}

func TestPostSamplesRejectsCorruptGzip(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	_, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	headers := server.bearer(t, clerkUserID)
	headers["Content-Encoding"] = "gzip"
	requireResponse(t, server.postSamples(t, headers, []byte("not gzip at all")), http.StatusBadRequest, `{"error":"body could not be decoded"}`)
}

func TestPostSamplesRejectsOversizeBody(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	_, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	oversizeBody := bytes.Repeat([]byte("a"), 8<<20+1)
	requireResponse(t, server.postSamples(t, server.bearer(t, clerkUserID), oversizeBody),
		http.StatusRequestEntityTooLarge, `{"error":"body must be at most 8 MiB"}`)
}

func TestPostSamplesRejectsGzipBomb(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	_, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	headers := server.bearer(t, clerkUserID)
	headers["Content-Encoding"] = "gzip"
	// 9 MiB of zeros compresses to a few KiB, far under the raw cap.
	requireResponse(t, server.postSamples(t, headers, gzipped(t, make([]byte, 9<<20))),
		http.StatusRequestEntityTooLarge, `{"error":"body must be at most 8 MiB"}`)
}

func TestPostSamplesRejectsUnsupportedEncoding(t *testing.T) {
	pool := testdatabase.Open(t)
	server := newTestServer(t, pool)
	_, clerkUserID := testdatabase.CreateConsentedUser(t, pool)
	headers := server.bearer(t, clerkUserID)
	headers["Content-Encoding"] = "br"
	requireResponse(t, server.postSamples(t, headers, heartRateBatch(t, time.Now())),
		http.StatusUnsupportedMediaType, `{"error":"Content-Encoding must be gzip or identity"}`)
}

func TestPostSamplesAnswers500WhenPostgresIsUnreachable(t *testing.T) {
	server := newTestServer(t, openUnreachablePool(t))
	requireResponse(t, server.postSamples(t, server.bearer(t, "user_unreachable"), heartRateBatch(t, time.Now())),
		http.StatusInternalServerError, `{"error":"Internal Server Error"}`)
}

func TestHealthzAnswersOKWhenPostgresAnswers(t *testing.T) {
	server := newTestServer(t, testdatabase.Open(t))
	recorder := httptest.NewRecorder()
	server.handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	requireResponse(t, recorder, http.StatusOK, `{"status":"ok"}`)
}

func TestHealthzAnswers503WhenPostgresIsUnreachable(t *testing.T) {
	server := newTestServer(t, openUnreachablePool(t))
	recorder := httptest.NewRecorder()
	server.handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	requireResponse(t, recorder, http.StatusServiceUnavailable, `{"status":"unavailable"}`)
}
