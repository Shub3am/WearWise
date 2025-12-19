package sessiontoken_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Shub3am/WearWise/apps/ingest/internal/sessiontoken"
	"github.com/Shub3am/WearWise/apps/ingest/internal/sessiontoken/sessiontokentest"
)

func newVerifier(t *testing.T, publicKeyPEM string) *sessiontoken.Verifier {
	t.Helper()
	verifier, err := sessiontoken.NewVerifier(publicKeyPEM)
	if err != nil {
		t.Fatal(err)
	}
	return verifier
}

func requireInvalidToken(t *testing.T, err error) {
	t.Helper()
	if !errors.Is(err, sessiontoken.ErrInvalidToken) {
		t.Fatalf("got %v, want ErrInvalidToken", err)
	}
}

func TestClerkUserIDAcceptsValidToken(t *testing.T) {
	signer := sessiontokentest.NewSigner(t)
	clerkUserID, err := newVerifier(t, signer.PublicKeyPEM).ClerkUserID(t.Context(), signer.SignSessionToken(t, "user_valid", nil))
	if err != nil {
		t.Fatal(err)
	}
	if clerkUserID != "user_valid" {
		t.Fatalf("got %q, want user_valid", clerkUserID)
	}
}

func TestClerkUserIDRejectsTokenFromAnotherKey(t *testing.T) {
	trustedSigner := sessiontokentest.NewSigner(t)
	otherSigner := sessiontokentest.NewSigner(t)
	_, err := newVerifier(t, trustedSigner.PublicKeyPEM).ClerkUserID(t.Context(), otherSigner.SignSessionToken(t, "user_other", nil))
	requireInvalidToken(t, err)
}

func TestClerkUserIDRejectsExpiredToken(t *testing.T) {
	signer := sessiontokentest.NewSigner(t)
	token := signer.SignSessionToken(t, "user_expired", map[string]any{"exp": time.Now().Add(-time.Minute).Unix()})
	_, err := newVerifier(t, signer.PublicKeyPEM).ClerkUserID(t.Context(), token)
	requireInvalidToken(t, err)
}

func TestClerkUserIDRejectsTokenWithoutExpiry(t *testing.T) {
	signer := sessiontokentest.NewSigner(t)
	token := signer.SignSessionToken(t, "user_no_expiry", map[string]any{"exp": nil})
	_, err := newVerifier(t, signer.PublicKeyPEM).ClerkUserID(t.Context(), token)
	requireInvalidToken(t, err)
}

func TestClerkUserIDRejectsPendingSession(t *testing.T) {
	signer := sessiontokentest.NewSigner(t)
	token := signer.SignSessionToken(t, "user_pending", map[string]any{"sts": "pending"})
	_, err := newVerifier(t, signer.PublicKeyPEM).ClerkUserID(t.Context(), token)
	requireInvalidToken(t, err)
}

func TestClerkUserIDRejectsTokenWithoutSubject(t *testing.T) {
	signer := sessiontokentest.NewSigner(t)
	token := signer.SignSessionToken(t, "user_ignored", map[string]any{"sub": nil})
	_, err := newVerifier(t, signer.PublicKeyPEM).ClerkUserID(t.Context(), token)
	requireInvalidToken(t, err)
}

func TestClerkUserIDAcceptsNotBeforeWithinLeeway(t *testing.T) {
	signer := sessiontokentest.NewSigner(t)
	token := signer.SignSessionToken(t, "user_clock_skew", map[string]any{"nbf": time.Now().Add(3 * time.Second).Unix()})
	if _, err := newVerifier(t, signer.PublicKeyPEM).ClerkUserID(t.Context(), token); err != nil {
		t.Fatal(err)
	}
}

func TestNewVerifierRejectsEscapedNewlines(t *testing.T) {
	signer := sessiontokentest.NewSigner(t)
	if _, err := sessiontoken.NewVerifier(strings.ReplaceAll(signer.PublicKeyPEM, "\n", `\n`)); err == nil {
		t.Fatal("NewVerifier accepted a PEM with escaped newlines")
	}
}
