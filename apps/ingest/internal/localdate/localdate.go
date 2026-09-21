// Why: turns an instant into the calendar date the user saw on their own clock.
// Must not: know about metrics, users or the database.
package localdate

import "time"

// Of returns the local calendar date of instant in location, as midnight UTC, the form pgx gives for a Postgres date.
func Of(instant time.Time, location *time.Location) time.Time {
	year, month, day := instant.In(location).Date()
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}
