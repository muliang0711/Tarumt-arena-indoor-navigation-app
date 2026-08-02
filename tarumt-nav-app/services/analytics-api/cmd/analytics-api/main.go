package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/campus-navigator/analytics-api/internal/composition"
	"github.com/campus-navigator/analytics-api/internal/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("analytics API stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	runtime, err := composition.NewRuntime(cfg, logger)
	if err != nil {
		return err
	}
	defer runtime.Close()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	logger.Info("analytics API starting", "address", cfg.Address)
	return runtime.Run(ctx)
}
