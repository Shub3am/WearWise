// Why: runs the ingest server and the retention loop until the container stops, or probes a running server for the container healthcheck.
// Must not: hold logic worth testing; that lives in internal packages.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/config"
	"github.com/Shub3am/WearWise/apps/ingest/internal/ingesthttp"
	"github.com/Shub3am/WearWise/apps/ingest/internal/retention"
	"github.com/Shub3am/WearWise/apps/ingest/internal/sessiontoken"
	"github.com/Shub3am/WearWise/apps/ingest/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	settings, err := config.Read(os.Getenv)
	if err != nil {
		logger.Error("read config failed", "error", err)
		os.Exit(1)
	}
	// The distroless image has no shell or curl, so the container healthcheck runs the binary itself.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(probeHealth(settings.Port))
	}
	if err := serve(settings, logger); err != nil {
		logger.Error("ingest stopped", "error", err)
		os.Exit(1)
	}
}

func probeHealth(port int) int {
	client := http.Client{Timeout: 3 * time.Second}
	response, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/healthz", port))
	if err != nil {
		return 1
	}
	response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func serve(settings config.Config, logger *slog.Logger) error {
	ctx, stopListening := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stopListening()
	pool, err := pgxpool.New(ctx, settings.DatabaseURL)
	if err != nil {
		return fmt.Errorf("create database pool: %w", err)
	}
	defer pool.Close()
	verifier, err := sessiontoken.NewVerifier(settings.ClerkJWTKey)
	if err != nil {
		return fmt.Errorf("load CLERK_JWT_KEY: %w", err)
	}
	go retention.Run(ctx, store.New(pool).DropHealthSamplesPartitionsBefore, logger)
	server := &http.Server{
		Addr: fmt.Sprintf(":%d", settings.Port),
		Handler: ingesthttp.NewHandler(ingesthttp.Dependencies{
			Pool:     pool,
			Verifier: verifier,
			Now:      time.Now,
			Logger:   logger,
		}),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	serveResult := make(chan error, 1)
	go func() { serveResult <- server.ListenAndServe() }()
	logger.Info("ingest listening", "port", settings.Port)
	select {
	case err := <-serveResult:
		return err
	case <-ctx.Done():
	}
	// Compose waits 10 s by default before SIGKILL; Coolify sets its own stop grace period.
	shutdownContext, cancelShutdown := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelShutdown()
	if err := server.Shutdown(shutdownContext); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("shut down server: %w", err)
	}
	return nil
}
