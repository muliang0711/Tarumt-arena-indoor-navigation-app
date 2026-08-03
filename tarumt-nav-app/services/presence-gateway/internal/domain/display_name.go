package domain

import (
	"errors"
	"strings"
	"unicode"
)

const MaxDisplayNameRunes = 24

var ErrInvalidDisplayName = errors.New("display_name must be 1 to 24 printable characters")

func NormalizeDisplayName(value string) (string, error) {
	for _, char := range value {
		if !unicode.IsPrint(char) {
			return "", ErrInvalidDisplayName
		}
	}
	normalized := strings.Join(strings.Fields(value), " ")
	if normalized == "" || len([]rune(normalized)) > MaxDisplayNameRunes {
		return "", ErrInvalidDisplayName
	}
	return normalized, nil
}
