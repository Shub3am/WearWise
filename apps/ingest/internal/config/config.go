// Why: turns the process environment into typed ingest settings once, at startup.
// Must not: call os.Getenv itself or default a secret.
package config

import (
	"errors"
	"fmt"
	"strconv"
)

type Config struct {
	DatabaseURL string
	Port        int
	ClerkJWTKey string
}

func Read(getenv func(string) string) (Config, error) {
	databaseURL := getenv("DATABASE_URL")
	if databaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	port := 8080
	if rawPort := getenv("PORT"); rawPort != "" {
		parsedPort, err := strconv.Atoi(rawPort)
		if err != nil || parsedPort < 1 || parsedPort > 65535 {
			return Config{}, fmt.Errorf("PORT must be an integer from 1 to 65535, got %q", rawPort)
		}
		port = parsedPort
	}
	clerkJWTKey := getenv("CLERK_JWT_KEY")
	if clerkJWTKey == "" {
		return Config{}, errors.New("CLERK_JWT_KEY is required")
	}
	return Config{DatabaseURL: databaseURL, Port: port, ClerkJWTKey: clerkJWTKey}, nil
}
