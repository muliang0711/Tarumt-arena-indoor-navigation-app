package mapgraph

import (
	"bytes"
	"os"
	"testing"
)

func TestBundledGraphMatchesCanonicalContract(t *testing.T) {
	canonical, err := os.ReadFile(
		"../../../../contracts/maps/main-campus/map-graph-bundle.v1.json",
	)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(mainCampusBundle, canonical) {
		t.Fatal("gateway map bundle drifted from canonical contract")
	}
	if _, err := NewDefaultRegistry(); err != nil {
		t.Fatal(err)
	}
}
