// Why: signs Clerk shaped session tokens with a throwaway RSA key so no test ever calls Clerk.
// Must not: be imported by non-test code.
package sessiontokentest

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v3"
	josejwt "github.com/go-jose/go-jose/v3/jwt"
	"github.com/google/uuid"
)

type Signer struct {
	PublicKeyPEM string
	signer       jose.Signer
}

func NewSigner(t testing.TB) *Signer {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	publicKeyDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: privateKey},
		(&jose.SignerOptions{}).WithType("JWT"),
	)
	if err != nil {
		t.Fatal(err)
	}
	return &Signer{
		PublicKeyPEM: string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicKeyDER})),
		signer:       signer,
	}
}

func (signer *Signer) SignSessionToken(t testing.TB, clerkUserID string, claimOverrides map[string]any) string {
	t.Helper()
	now := time.Now()
	claims := map[string]any{
		"iss": "https://example.clerk.accounts.dev",
		"sub": clerkUserID,
		"sid": "sess_" + uuid.NewString(),
		"v":   2,
		"sts": "active",
		"iat": now.Unix(),
		"nbf": now.Add(-10 * time.Second).Unix(),
		"exp": now.Add(time.Minute).Unix(),
	}
	for claimName, claimValue := range claimOverrides {
		if claimValue == nil {
			delete(claims, claimName)
			continue
		}
		claims[claimName] = claimValue
	}
	token, err := josejwt.Signed(signer.signer).Claims(claims).CompactSerialize()
	if err != nil {
		t.Fatal(err)
	}
	return token
}
