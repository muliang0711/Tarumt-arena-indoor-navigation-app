package domain

import "testing"

func TestRepresentativeSelectionIsStableAndLimited(t *testing.T) {
	t.Parallel()
	presences := make([]Presence, 20)
	for index := range presences {
		presences[index].SessionID = string(rune('a' + index))
	}
	first := SelectRepresentatives("main", "2", presences, 10)
	second := SelectRepresentatives("main", "2", presences, 10)
	if len(first) != 10 || len(second) != 10 {
		t.Fatalf("representative counts = %d and %d, want 10", len(first), len(second))
	}
	for index := range first {
		if first[index].SessionID != second[index].SessionID {
			t.Fatal("representative selection was not stable")
		}
	}
}
