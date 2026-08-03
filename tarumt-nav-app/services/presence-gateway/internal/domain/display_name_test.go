package domain

import (
	"errors"
	"testing"
)

func TestNormalizeDisplayName(t *testing.T) {
	t.Parallel()
	normalized, err := NormalizeDisplayName("  Mei   Ling  ")
	if err != nil {
		t.Fatal(err)
	}
	if normalized != "Mei Ling" {
		t.Fatalf("normalized display name = %q, want %q", normalized, "Mei Ling")
	}
	for _, invalid := range []string{"   ", "name\nwith-control", "1234567890123456789012345"} {
		if _, err := NormalizeDisplayName(invalid); !errors.Is(err, ErrInvalidDisplayName) {
			t.Fatalf("NormalizeDisplayName(%q) error = %v, want ErrInvalidDisplayName", invalid, err)
		}
	}
}
