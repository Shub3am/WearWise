// Why: reads an ingest request body, gzip or identity, without ever holding more than the cap in memory.
// Must not: parse JSON.
package ingesthttp

import (
	"compress/gzip"
	"errors"
	"io"
	"net/http"
	"strings"
)

const maxRequestBodyBytes = 8 << 20

type bodyRejection struct {
	status  int
	message string
}

func readRequestBody(writer http.ResponseWriter, request *http.Request) ([]byte, *bodyRejection) {
	limitedBody := http.MaxBytesReader(writer, request.Body, maxRequestBodyBytes)
	var decodedBody io.Reader = limitedBody
	switch strings.ToLower(request.Header.Get("Content-Encoding")) {
	case "", "identity":
	case "gzip":
		gzipReader, err := gzip.NewReader(limitedBody)
		if err != nil {
			return nil, &bodyRejection{status: http.StatusBadRequest, message: "body could not be decoded"}
		}
		decodedBody = gzipReader
	default:
		return nil, &bodyRejection{status: http.StatusUnsupportedMediaType, message: "Content-Encoding must be gzip or identity"}
	}
	// The raw body is capped by MaxBytesReader; the decoded body is capped here, so a gzip bomb stops at cap + 1 bytes.
	body, err := io.ReadAll(io.LimitReader(decodedBody, maxRequestBodyBytes+1))
	var maxBytesError *http.MaxBytesError
	if errors.As(err, &maxBytesError) || len(body) > maxRequestBodyBytes {
		return nil, &bodyRejection{status: http.StatusRequestEntityTooLarge, message: "body must be at most 8 MiB"}
	}
	if err != nil {
		return nil, &bodyRejection{status: http.StatusBadRequest, message: "body could not be decoded"}
	}
	return body, nil
}
