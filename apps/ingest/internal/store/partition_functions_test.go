package store_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/store"
	"github.com/Shub3am/WearWise/apps/ingest/internal/testdatabase"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func dropPartitionAtCleanup(t *testing.T, pool *pgxpool.Pool, partitionName string) {
	t.Helper()
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DROP TABLE IF EXISTS "+partitionName); err != nil {
			t.Error(err)
		}
	})
}

func partitionNames(t *testing.T, pool *pgxpool.Pool, namePattern string) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `
		SELECT child.relname FROM pg_inherits
		JOIN pg_class child ON child.oid = pg_inherits.inhrelid
		WHERE pg_inherits.inhparent = 'health_samples'::regclass AND child.relname LIKE $1
		ORDER BY child.relname`, namePattern)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return names
}

func TestEnsurePartitionUsesUTCMonthBoundsInAnySessionTimeZone(t *testing.T) {
	pool := testdatabase.Open(t)
	dropPartitionAtCleanup(t, pool, "health_samples_2031_05")
	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	if _, err := tx.Exec(t.Context(), "SET LOCAL TIME ZONE 'Asia/Kolkata'"); err != nil {
		t.Fatal(err)
	}
	// 20:00 UTC on May 31 is already June 1 in Kolkata; the sample still belongs to May.
	if err := store.New(tx).EnsureHealthSamplesPartition(t.Context(), time.Date(2031, 5, 31, 20, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	var partitionBound string
	err = tx.QueryRow(t.Context(),
		"SELECT pg_get_expr(relpartbound, oid) FROM pg_class WHERE relname = 'health_samples_2031_05'").Scan(&partitionBound)
	if err != nil {
		t.Fatal(err)
	}
	wantBound := "FOR VALUES FROM ('2031-05-01 05:30:00+05:30') TO ('2031-06-01 05:30:00+05:30')"
	if partitionBound != wantBound {
		t.Fatalf("got %s, want %s", partitionBound, wantBound)
	}
	if err := tx.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := store.New(pool).EnsureHealthSamplesPartition(t.Context(), time.Date(2031, 5, 2, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("second ensure of the same month: %v", err)
	}
}

func TestEnsurePartitionCreatesOnePartitionUnderConcurrency(t *testing.T) {
	pool := testdatabase.Open(t)
	dropPartitionAtCleanup(t, pool, "health_samples_2041_03")
	queries := store.New(pool)
	const writerCount = 16
	ensureErrors := make([]error, writerCount)
	var writers sync.WaitGroup
	for writerIndex := range writerCount {
		writers.Go(func() {
			ensureErrors[writerIndex] = queries.EnsureHealthSamplesPartition(t.Context(), time.Date(2041, 3, 15, 0, 0, 0, 0, time.UTC))
		})
	}
	writers.Wait()
	for writerIndex, err := range ensureErrors {
		if err != nil {
			t.Errorf("writer %d: %v", writerIndex, err)
		}
	}
	if names := partitionNames(t, pool, "health_samples_2041_%"); len(names) != 1 || names[0] != "health_samples_2041_03" {
		t.Fatalf("got partitions %v, want [health_samples_2041_03]", names)
	}
}

func TestDropPartitionsBeforeDropsOnlyWholeMonthsBeforeTheCutoff(t *testing.T) {
	pool := testdatabase.Open(t)
	for _, partitionName := range []string{"health_samples_2001_01", "health_samples_2001_02", "health_samples_2001_03"} {
		dropPartitionAtCleanup(t, pool, partitionName)
	}
	queries := store.New(pool)
	for _, month := range []time.Month{time.January, time.February, time.March} {
		if err := queries.EnsureHealthSamplesPartition(t.Context(), time.Date(2001, month, 10, 0, 0, 0, 0, time.UTC)); err != nil {
			t.Fatal(err)
		}
	}
	droppedCount, err := queries.DropHealthSamplesPartitionsBefore(t.Context(), time.Date(2001, 3, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if droppedCount != 2 {
		t.Fatalf("dropped %d partitions, want 2", droppedCount)
	}
	if names := partitionNames(t, pool, "health_samples_2001_%"); len(names) != 1 || names[0] != "health_samples_2001_03" {
		t.Fatalf("got partitions %v, want [health_samples_2001_03]", names)
	}
}

// lockKind is a pg_stat_activity wait_event of type Lock, such as "relation" or "advisory".
func waitUntilBackendWaitsOnLock(t *testing.T, pool *pgxpool.Pool, backendPID uint32, lockKind string) {
	t.Helper()
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		var waitEvent *string
		err := pool.QueryRow(t.Context(),
			"SELECT wait_event FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'", backendPID).Scan(&waitEvent)
		if err == nil && waitEvent != nil && *waitEvent == lockKind {
			return
		}
	}
	t.Fatalf("backend %d never waited on a %s lock", backendPID, lockKind)
}

// Runs partitionDDL while a user delete is between locking users and cascading into health_samples.
func requireNoDeadlockWithUserDeletion(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID, partitionDDL func(conn *pgxpool.Conn) error) {
	t.Helper()
	userDeletion, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer userDeletion.Rollback(context.Background())
	// A DELETE FROM users holds this lock before its ON DELETE CASCADE reaches health_samples.
	if _, err := userDeletion.Exec(t.Context(), "LOCK TABLE users IN ROW EXCLUSIVE MODE"); err != nil {
		t.Fatal(err)
	}
	ddlConn, err := pool.Acquire(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer ddlConn.Release()
	ddlResult := make(chan error, 1)
	go func() { ddlResult <- partitionDDL(ddlConn) }()
	waitUntilBackendWaitsOnLock(t, pool, ddlConn.Conn().PgConn().PID(), "relation")
	_, deletionErr := userDeletion.Exec(t.Context(), "DELETE FROM users WHERE id = $1", userID)
	if deletionErr == nil {
		deletionErr = userDeletion.Commit(t.Context())
	}
	// After a failed delete the transaction still holds its locks until rollback, and the DDL waits on them.
	userDeletion.Rollback(context.Background())
	if ddlErr := <-ddlResult; ddlErr != nil || deletionErr != nil {
		t.Fatalf("partition DDL: %v, user deletion: %v", ddlErr, deletionErr)
	}
}

func TestEnsurePartitionDoesNotDeadlockWithUserDeletion(t *testing.T) {
	pool := testdatabase.Open(t)
	dropPartitionAtCleanup(t, pool, "health_samples_2051_07")
	userID, _ := testdatabase.CreateUserWithoutConsent(t, pool)
	requireNoDeadlockWithUserDeletion(t, pool, userID, func(conn *pgxpool.Conn) error {
		return store.New(conn).EnsureHealthSamplesPartition(context.Background(), time.Date(2051, 7, 1, 0, 0, 0, 0, time.UTC))
	})
}

// Holds the lock a long read such as pg_dump holds on health_samples until the test ends.
func holdReadLockOnHealthSamples(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	longRead, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { longRead.Rollback(context.Background()) })
	if _, err := longRead.Exec(t.Context(), "LOCK TABLE health_samples IN ACCESS SHARE MODE"); err != nil {
		t.Fatal(err)
	}
}

const lockNotAvailableCode = "55P03"

func requireLockNotAvailable(t *testing.T, err error) {
	t.Helper()
	var postgresError *pgconn.PgError
	if !errors.As(err, &postgresError) || postgresError.Code != lockNotAvailableCode {
		t.Fatalf("got %v, want SQLSTATE %s (lock_timeout)", err, lockNotAvailableCode)
	}
}

func TestEnsurePartitionGivesUpWhileALongReadHoldsHealthSamples(t *testing.T) {
	pool := testdatabase.Open(t)
	dropPartitionAtCleanup(t, pool, "health_samples_2061_02")
	holdReadLockOnHealthSamples(t, pool)
	ensureContext, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	err := store.New(pool).EnsureHealthSamplesPartition(ensureContext, time.Date(2061, 2, 1, 0, 0, 0, 0, time.UTC))
	requireLockNotAvailable(t, err)
}

func TestDropPartitionsGivesUpWhileALongReadHoldsHealthSamples(t *testing.T) {
	pool := testdatabase.Open(t)
	dropPartitionAtCleanup(t, pool, "health_samples_2001_06")
	if err := store.New(pool).EnsureHealthSamplesPartition(t.Context(), time.Date(2001, 6, 1, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	holdReadLockOnHealthSamples(t, pool)
	dropContext, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	_, err := store.New(pool).DropHealthSamplesPartitionsBefore(dropContext, time.Date(2001, 7, 1, 0, 0, 0, 0, time.UTC))
	requireLockNotAvailable(t, err)
}

func TestEnsurePartitionSkipsUsersLockWhenAnotherSessionCreatedThePartitionFirst(t *testing.T) {
	pool := testdatabase.Open(t)
	dropPartitionAtCleanup(t, pool, "health_samples_2071_04")
	monthStart := time.Date(2071, 4, 1, 0, 0, 0, 0, time.UTC)
	firstCreator, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer firstCreator.Rollback(context.Background())
	if err := store.New(firstCreator).EnsureHealthSamplesPartition(t.Context(), monthStart); err != nil {
		t.Fatal(err)
	}
	userWriterConn, err := pool.Acquire(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer userWriterConn.Release()
	userWriter, err := userWriterConn.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer userWriter.Rollback(context.Background())
	userWriterLocked := make(chan error, 1)
	go func() {
		_, lockErr := userWriter.Exec(t.Context(), "LOCK TABLE users IN ROW EXCLUSIVE MODE")
		userWriterLocked <- lockErr
	}()
	waitUntilBackendWaitsOnLock(t, pool, userWriterConn.Conn().PgConn().PID(), "relation")
	secondCreatorConn, err := pool.Acquire(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer secondCreatorConn.Release()
	secondCreatorContext, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	secondCreatorResult := make(chan error, 1)
	go func() {
		secondCreatorResult <- store.New(secondCreatorConn).EnsureHealthSamplesPartition(secondCreatorContext, monthStart)
	}()
	waitUntilBackendWaitsOnLock(t, pool, secondCreatorConn.Conn().PgConn().PID(), "advisory")
	// Commit releases the users lock before the advisory lock, so the user writer holds users before the second creator wakes.
	if err := firstCreator.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := <-userWriterLocked; err != nil {
		t.Fatal(err)
	}
	if err := <-secondCreatorResult; err != nil {
		t.Fatalf("second creator got %v, want nil without waiting on users", err)
	}
}
