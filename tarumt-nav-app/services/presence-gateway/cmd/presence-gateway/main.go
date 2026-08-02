package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/composition"
	"github.com/campus-navigator/presence-gateway/internal/config"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/auth"
	"github.com/campus-navigator/presence-gateway/internal/infrastructure/identity"
	timeinfra "github.com/campus-navigator/presence-gateway/internal/infrastructure/time"
	"github.com/campus-navigator/presence-gateway/internal/mapbundle"
	"github.com/campus-navigator/presence-gateway/internal/mapgraph"
	"github.com/campus-navigator/presence-gateway/internal/observability"
	httptransport "github.com/campus-navigator/presence-gateway/internal/transport/http"
	websockettransport "github.com/campus-navigator/presence-gateway/internal/transport/websocket"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("presence gateway stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger.Info("starting presence gateway", "config", cfg.String())

	clock := timeinfra.SystemClock{}
	backend, err := composition.NewBackend(cfg, logger)
	if err != nil {
		return err
	}
	defer backend.Close()
	tokenService := auth.NewJWTTokenService(cfg.JWTSecret, cfg.JWTIssuer)
	identityService := identity.NewAnonymousIdentity(cfg.IdentityHMACSecret)
	idGenerator := identity.UUIDGenerator{}
	sessionService := application.NewSessionService(
		backend.Sessions, tokenService, identityService, idGenerator, clock,
		cfg.SessionTTL, cfg.TokenTTL,
	)
	presenceService := application.NewPresenceService(
		backend.Presences, backend.Sessions, backend.Broker, clock, idGenerator,
	)
	mapRegistry, err := mapgraph.NewDefaultRegistry()
	if err != nil {
		return err
	}
	journeyService := application.NewJourneyService(
		backend.Journeys, mapRegistry, idGenerator, clock,
		cfg.JourneyIdempotencyTTL, cfg.JourneyEndedTombstoneTTL,
		cfg.JourneyFirstPositionTimeout, cfg.PresenceStaleAfter,
	)
	occupancyService := application.NewOccupancyService(
		backend.Occupancy, clock, cfg.PresenceStaleAfter, 10,
	)
	expiryService := application.NewExpiryService(
		presenceService, journeyService, cfg.PresenceStaleAfter,
		cfg.ExpirySweepInterval, logger,
	)
	connectionRegistry := websockettransport.NewConnectionRegistry()
	metrics := observability.NewMetrics()
	liveFloors := application.NewLiveFloorProjectionManager(
		backend.Broker, occupancyService, metrics, application.LiveFloorOptions{
			MovementCoalesceInterval: cfg.MovementCoalesce,
			MembershipDebounce:       cfg.MembershipDebounce,
			SubscriberQueueSize:      cfg.ProjectionQueueSize,
			SnapshotTimeout:          cfg.RedisReadTimeout,
		},
	)
	defer liveFloors.Close()
	runner := websockettransport.NewSessionRunner(
		sessionService, presenceService, journeyService, liveFloors,
		connectionRegistry, logger,
		metrics, cfg.WebSocketQueueSize, cfg.MaxWebSocketBytes, cfg.HeartbeatInterval,
	)
	websocketHandler := websockettransport.NewHandler(sessionService, runner, cfg.AllowedOrigins)
	sessionHandler := httptransport.NewSessionHandler(sessionService, cfg.MaxRequestBytes)
	mapHandler := httptransport.NewMapHandler(mapbundle.NewCatalog(cfg.MapDataRoot))
	router := httptransport.NewRouter(
		sessionHandler, websocketHandler, mapHandler,
		backend.Health, metrics, logger,
	)
	server := httptransport.NewServer(cfg.Address, router)

	rootCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go expiryService.Run(rootCtx)
	serverError := make(chan error, 1)
	go func() {
		serverError <- server.ListenAndServe()
	}()

	select {
	case err := <-serverError:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-rootCtx.Done():
		logger.Info("shutting down presence gateway", "connections", connectionRegistry.Count())
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	connectionRegistry.CloseAll(shutdownCtx)
	if err := httptransport.Shutdown(shutdownCtx, server); err != nil {
		return err
	}
	select {
	case err := <-serverError:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-time.After(cfg.ShutdownTimeout):
		return errors.New("http server did not stop before timeout")
	}
	return nil
}
