package identity

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"unicode"
)

var ErrInvalidInstallationID = errors.New("installation_id must be 16 to 128 printable characters")

type AnonymousIdentity struct {
	secret []byte
}

func NewAnonymousIdentity(secret string) *AnonymousIdentity {
	return &AnonymousIdentity{secret: []byte(secret)}
}

func (i *AnonymousIdentity) DeriveDeviceReference(installationID string) (string, error) {
	value := strings.TrimSpace(installationID)
	if len(value) < 16 || len(value) > 128 {
		return "", ErrInvalidInstallationID
	}
	for _, char := range value {
		if !unicode.IsPrint(char) || unicode.IsSpace(char) {
			return "", ErrInvalidInstallationID
		}
	}
	mac := hmac.New(sha256.New, i.secret)
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil)), nil
}
