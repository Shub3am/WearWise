package ingesthttp_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/samplebatch"
	"github.com/Shub3am/WearWise/apps/ingest/internal/testdatabase"
	"github.com/google/uuid"
)

func fullGzipBatches(b *testing.B, batchCount int) [][]byte {
	b.Helper()
	firstStartAt := time.Now().UTC().Add(-2 * time.Hour)
	batches := make([][]byte, batchCount)
	for batchIndex := range batches {
		samples := make([]map[string]any, samplebatch.MaxItems)
		for sampleIndex := range samples {
			startAt := firstStartAt.Add(time.Duration(sampleIndex) * time.Second).Format(time.RFC3339Nano)
			samples[sampleIndex] = map[string]any{
				"metric": "heart_rate", "externalUuid": uuid.NewString(), "startAt": startAt, "endAt": startAt,
				"value": 55 + sampleIndex%50, "unit": "bpm", "source": "com.apple.health",
			}
		}
		body, err := json.Marshal(map[string]any{"samples": samples})
		if err != nil {
			b.Fatal(err)
		}
		batches[batchIndex] = gzipped(b, body)
	}
	return batches
}

func postEachBatch(b *testing.B, server testServer, headers map[string]string, batchAt func(batchIndex int) []byte) {
	b.Helper()
	b.ResetTimer()
	for batchIndex := range b.N {
		if recorder := server.postSamples(b, headers, batchAt(batchIndex)); recorder.Code != http.StatusNoContent {
			b.Fatalf("got %d %s, want 204", recorder.Code, recorder.Body.String())
		}
	}
	b.ReportMetric(float64(b.N*samplebatch.MaxItems)/b.Elapsed().Seconds(), "samples/s")
}

func BenchmarkPostSamples(b *testing.B) {
	pool := testdatabase.Open(b)
	server := newTestServer(b, pool)
	_, clerkUserID := testdatabase.CreateConsentedUser(b, pool)
	headers := server.bearer(b, clerkUserID)
	headers["Content-Encoding"] = "gzip"
	b.Run("new_samples", func(b *testing.B) {
		batches := fullGzipBatches(b, b.N)
		postEachBatch(b, server, headers, func(batchIndex int) []byte { return batches[batchIndex] })
	})
	b.Run("resent_batch", func(b *testing.B) {
		batch := fullGzipBatches(b, 1)[0]
		if recorder := server.postSamples(b, headers, batch); recorder.Code != http.StatusNoContent {
			b.Fatalf("first write got %d %s", recorder.Code, recorder.Body.String())
		}
		postEachBatch(b, server, headers, func(int) []byte { return batch })
	})
}
