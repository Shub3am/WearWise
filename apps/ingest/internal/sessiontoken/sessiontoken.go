// Why: turns a Clerk session token into the Clerk user id it was issued to, offline, with the instance's PEM public key.
// Must not: call Clerk's API or fetch JWKS, and must not look the user up in Postgres.
package sessiontoken

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
)

var ErrInvalidToken = errors.New("invalid session token")

type Verifier struct {
	publicKey *clerk.JSONWebKey
}

type sessionStatusClaims struct {
	Status string `json:"sts"`
}

func NewVerifier(publicKeyPEM string) (*Verifier, error) {
	publicKey, err := clerk.JSONWebKeyFromPEM(publicKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("CLERK_JWT_KEY is not a PEM public key: %w", err)
	}
	return &Verifier{publicKey: publicKey}, nil
}

func (verifier *Verifier) ClerkUserID(ctx context.Context, token string) (string, error) {
	claims, err := jwt.Verify(ctx, &jwt.VerifyParams{
		Token:                   token,
		JWK:                     verifier.publicKey,
		Leeway:                  5 * time.Second,
		CustomClaimsConstructor: func(context.Context) any { return &sessionStatusClaims{} },
	})
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}
	// clerk-sdk-go accepts tokens with no exp claim and tokens of pending sessions.
	sessionStatus := claims.Custom.(*sessionStatusClaims).Status
	if claims.Expiry == nil || claims.Subject == "" || sessionStatus == "pending" {
		return "", ErrInvalidToken
	}
	return claims.Subject, nil
}
