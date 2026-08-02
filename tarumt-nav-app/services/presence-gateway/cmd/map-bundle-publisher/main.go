package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/campus-navigator/presence-gateway/internal/mapbundle"
)

func main() {
	workspace := flag.String("workspace", ".", "repository workspace root")
	source := flag.String("source", "", "source manifest path, relative to workspace")
	output := flag.String("output", "", "published map directory, relative to workspace")
	flag.Parse()

	if *source == "" || *output == "" {
		fmt.Fprintln(os.Stderr, "-source and -output are required")
		os.Exit(2)
	}
	outputPath := *output
	if !filepath.IsAbs(outputPath) {
		outputPath = filepath.Join(*workspace, outputPath)
	}
	manifest, err := mapbundle.NewPublisher().Publish(mapbundle.PublishRequest{
		WorkspaceRoot: *workspace,
		SourcePath:    *source,
		OutputRoot:    outputPath,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(manifest); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
