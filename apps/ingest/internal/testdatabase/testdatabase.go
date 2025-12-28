// Why: gives tests a pool on the migrated wearwise_test database and throwaway users that remove themselves.
// Must not: be imported by non-test code, or truncate tables other tests are using.
package testdatabase

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultTestDatabaseURL = "postgres://wearwise:wearwise@localhost:55432/wearwise_test?sslmode=disable"

func Open(t testing.TB) *pgxpool.Pool {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = defaultTestDatabaseURL
	}
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func CreateUserWithoutConsent(t testing.TB, pool *pgxpool.Pool) (uuid.UUID, string) {
	t.Helper()
	clerkUserID := "user_" + uuid.NewString()
	var userID uuid.UUID
	err := pool.QueryRow(context.Background(),
		"INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id", clerkUserID).Scan(&userID)
	if err != nil {
		t.Fatal(err)
	}
	// Cleanups run last in, first out, so this runs before the pool from Open closes.
	// t.Context() is already cancelled when cleanups run.
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userID); err != nil {
			t.Error(err)
		}
	})
	return userID, clerkUserID
}

func CreateConsentedUser(t testing.TB, pool *pgxpool.Pool) (uuid.UUID, string) {
	t.Helper()
	userID, clerkUserID := CreateUserWithoutConsent(t, pool)
	_, err := pool.Exec(context.Background(),
		"INSERT INTO consents (user_id, kind, version) VALUES ($1, 'health_data_processing', '2026-09-01')", userID)
	if err != nil {
		t.Fatal(err)
	}
	return userID, clerkUserID
}
