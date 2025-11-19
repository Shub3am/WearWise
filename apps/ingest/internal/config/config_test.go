package config

import "testing"

func environment(values map[string]string) func(string) string {
	return func(name string) string { return values[name] }
}

func TestReadReturnsSettings(t *testing.T) {
	settings, err := Read(environment(map[string]string{
		"DATABASE_URL":  "postgres://example",
		"PORT":          "9090",
		"CLERK_JWT_KEY": "public key pem",
	}))
	if err != nil {
		t.Fatal(err)
	}
	want := Config{DatabaseURL: "postgres://example", Port: 9090, ClerkJWTKey: "public key pem"}
	if settings != want {
		t.Fatalf("got %+v, want %+v", settings, want)
	}
}

func TestReadDefaultsPortTo8080(t *testing.T) {
	settings, err := Read(environment(map[string]string{
		"DATABASE_URL":  "postgres://example",
		"CLERK_JWT_KEY": "public key pem",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if settings.Port != 8080 {
		t.Fatalf("got port %d, want 8080", settings.Port)
	}
}

func TestReadRejectsMissingDatabaseURL(t *testing.T) {
	_, err := Read(environment(map[string]string{"CLERK_JWT_KEY": "public key pem"}))
	if err == nil || err.Error() != "DATABASE_URL is required" {
		t.Fatalf("got %v, want DATABASE_URL is required", err)
	}
}

func TestReadRejectsInvalidPort(t *testing.T) {
	for _, rawPort := range []string{"0", "65536", "http"} {
		t.Run(rawPort, func(t *testing.T) {
			_, err := Read(environment(map[string]string{
				"DATABASE_URL":  "postgres://example",
				"PORT":          rawPort,
				"CLERK_JWT_KEY": "public key pem",
			}))
			want := `PORT must be an integer from 1 to 65535, got "` + rawPort + `"`
			if err == nil || err.Error() != want {
				t.Fatalf("got %v, want %s", err, want)
			}
		})
	}
}

func TestReadRejectsMissingClerkJWTKey(t *testing.T) {
	_, err := Read(environment(map[string]string{"DATABASE_URL": "postgres://example"}))
	if err == nil || err.Error() != "CLERK_JWT_KEY is required" {
		t.Fatalf("got %v, want CLERK_JWT_KEY is required", err)
	}
}
