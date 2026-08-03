package websockettransport

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/campus-navigator/presence-gateway/internal/application"
	"github.com/campus-navigator/presence-gateway/internal/application/ports"
	"github.com/campus-navigator/presence-gateway/internal/domain"
	"github.com/campus-navigator/presence-gateway/internal/mapgraph"
	"github.com/campus-navigator/presence-gateway/internal/transport/protocol"
	"github.com/coder/websocket"
)

type SessionRunner struct {
	sessions          *application.SessionService
	presences         *application.PresenceService
	journeys          *application.JourneyService
	liveFloors        *application.LiveFloorProjectionManager
	registry          *ConnectionRegistry
	logger            *slog.Logger
	observer          Observer
	queueSize         int
	maxMessageBytes   int64
	heartbeatInterval time.Duration
}

type Observer interface {
	WebSocketOpened()
	WebSocketClosed()
	WebSocketTerminated(reason string)
	WebSocketMessage(messageType, outcome string, duration time.Duration)
}

type noopObserver struct{}

func (noopObserver) WebSocketOpened()                               {}
func (noopObserver) WebSocketClosed()                               {}
func (noopObserver) WebSocketTerminated(string)                     {}
func (noopObserver) WebSocketMessage(string, string, time.Duration) {}

type runnerState struct {
	runner       *SessionRunner
	client       *client
	sessionID    string
	session      domain.Session
	subscription application.LiveFloorSubscription
	subCancel    context.CancelFunc
	cancel       context.CancelFunc
}

func NewSessionRunner(
	sessions *application.SessionService,
	presences *application.PresenceService,
	journeys *application.JourneyService,
	liveFloors *application.LiveFloorProjectionManager,
	registry *ConnectionRegistry,
	logger *slog.Logger,
	observer Observer,
	queueSize int,
	maxMessageBytes int64,
	heartbeatInterval time.Duration,
) *SessionRunner {
	if observer == nil {
		observer = noopObserver{}
	}
	return &SessionRunner{
		sessions: sessions, presences: presences, journeys: journeys,
		liveFloors: liveFloors,
		registry:   registry, logger: logger, observer: observer, queueSize: queueSize,
		maxMessageBytes: maxMessageBytes, heartbeatInterval: heartbeatInterval,
	}
}

func (r *SessionRunner) Run(
	parent context.Context,
	connection *websocket.Conn,
	session domain.Session,
) {
	sessionID := session.ID
	ctx, cancel := context.WithCancel(parent)
	state := &runnerState{
		runner: r, client: newClient(connection, r.queueSize),
		sessionID: sessionID, session: session, cancel: cancel,
	}
	r.registry.Add(connection)
	r.observer.WebSocketOpened()
	defer func() {
		cancel()
		state.closeSubscription()
		leaveCtx, leaveCancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = r.presences.Leave(leaveCtx, sessionID)
		leaveCancel()
		r.registry.Remove(connection)
		r.observer.WebSocketClosed()
		_ = connection.Close(websocket.StatusNormalClosure, "session closed")
	}()

	writerDone := make(chan error, 1)
	go func() {
		err := state.client.writeLoop(ctx)
		if err != nil && ctx.Err() == nil {
			r.observer.WebSocketTerminated("write_failed")
		}
		writerDone <- err
		cancel()
	}()

	if err := state.send(protocol.TypeSessionReady, "", 0, protocol.SessionReady{
		SessionID: sessionID, HeartbeatSeconds: int64(r.heartbeatInterval.Seconds()),
	}); err != nil {
		return
	}

	for {
		messageType, data, err := connection.Read(ctx)
		if err != nil {
			if ctx.Err() == nil && websocket.CloseStatus(err) == -1 {
				r.logger.Debug("websocket read stopped", "session_id", sessionID, "error", err)
			}
			return
		}
		if messageType != websocket.MessageText {
			r.observer.WebSocketMessage("decode", "rejected", 0)
			state.sendError("", protocol.ErrorInvalidMessage, "only text messages are supported", false)
			continue
		}
		startedAt := time.Now()
		envelope, err := protocol.Decode(data, r.maxMessageBytes)
		if err != nil {
			r.observer.WebSocketMessage("decode", "rejected", time.Since(startedAt))
			state.sendProtocolError("", err)
			continue
		}
		if envelope.Timestamp.IsZero() || time.Since(envelope.Timestamp).Abs() > 5*time.Minute {
			r.observer.WebSocketMessage(envelope.Type, "rejected", time.Since(startedAt))
			state.sendError(envelope.RequestID, protocol.ErrorInvalidMessage, "timestamp is outside the accepted window", false)
			continue
		}
		accepted, err := state.handle(ctx, envelope)
		if err != nil {
			r.observer.WebSocketMessage(envelope.Type, "failed", time.Since(startedAt))
			if errors.Is(err, ErrSlowConsumer) {
				r.observer.WebSocketTerminated("slow_consumer")
				return
			}
			r.logger.Error("websocket message handling failed", "session_id", sessionID, "error", err)
			state.sendError(envelope.RequestID, protocol.ErrorInternal, "request could not be completed", true)
		} else if accepted {
			r.observer.WebSocketMessage(envelope.Type, "accepted", time.Since(startedAt))
		} else {
			r.observer.WebSocketMessage(envelope.Type, "rejected", time.Since(startedAt))
		}
		select {
		case <-writerDone:
			return
		default:
		}
	}
}

func (s *runnerState) handle(ctx context.Context, envelope protocol.Envelope) (bool, error) {
	switch envelope.Type {
	case protocol.TypeSubscribeFloor:
		var payload protocol.FloorSubscription
		if err := protocol.DecodePayload(envelope.Payload, &payload); err != nil {
			s.sendProtocolError(envelope.RequestID, err)
			return false, nil
		}
		return s.switchFloor(ctx, envelope.RequestID, payload.BuildingID, payload.FloorID)
	case protocol.TypeLocationUpdate, protocol.TypeChangeFloor:
		if envelope.Sequence == 0 {
			s.sendError(envelope.RequestID, protocol.ErrorInvalidMessage, "sequence must be greater than zero", false)
			return false, nil
		}
		var payload protocol.LocationUpdate
		if err := protocol.DecodePayload(envelope.Payload, &payload); err != nil {
			s.sendProtocolError(envelope.RequestID, err)
			return false, nil
		}
		active, activeErr := s.runner.journeys.Active(
			ctx,
			s.session.DeviceRef,
		)
		var err error
		if errors.Is(activeErr, ports.ErrNotFound) {
			_, err = s.runner.presences.Update(
				ctx,
				s.sessionID,
				envelope.Sequence,
				payload.Position,
			)
		} else if activeErr != nil {
			return false, activeErr
		} else {
			_, err = s.runner.presences.UpdateForJourney(
				ctx,
				s.sessionID,
				envelope.Sequence,
				payload.Position,
				active.JourneyID,
			)
			if err == nil {
				err = s.runner.journeys.RecordPosition(
					ctx,
					s.session.DeviceRef,
					active.JourneyID,
					s.sessionID,
				)
			}
		}
		if errors.Is(err, domain.ErrInvalidPosition) {
			s.sendError(envelope.RequestID, protocol.ErrorInvalidPosition, "position is invalid", false)
			return false, nil
		}
		if errors.Is(err, domain.ErrStaleSequence) {
			s.sendError(envelope.RequestID, protocol.ErrorStaleSequence, "sequence has already been processed", false)
			return false, nil
		}
		if s.sendJourneyError(envelope.RequestID, err) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		return true, s.send(protocol.TypeAck, envelope.RequestID, envelope.Sequence, protocol.Acknowledgement{AcceptedSequence: envelope.Sequence})
	case protocol.TypeJourneyStart:
		var payload protocol.JourneyStart
		if err := protocol.DecodePayload(envelope.Payload, &payload); err != nil {
			s.sendProtocolError(envelope.RequestID, err)
			return false, nil
		}
		result, err := s.runner.journeys.Start(
			ctx,
			s.session,
			application.StartJourneyCommand{
				ClientEventID:    payload.ClientEventID,
				ClientJourneyKey: payload.ClientJourneyKey,
				MapID:            payload.MapID, MapRevision: payload.MapRevision,
				Route: payload.PlannedRoute, OccurredAt: envelope.Timestamp,
			},
		)
		if s.sendJourneyError(envelope.RequestID, err) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		s.publishRemoved(ctx, result.RemovedPresence)
		return true, s.sendJourneyAck(envelope.RequestID, result)
	case protocol.TypeRouteRecalculate:
		var payload protocol.RouteRecalculate
		if err := protocol.DecodePayload(envelope.Payload, &payload); err != nil {
			s.sendProtocolError(envelope.RequestID, err)
			return false, nil
		}
		result, err := s.runner.journeys.Recalculate(
			ctx,
			s.session,
			application.RecalculateRouteCommand{
				ClientEventID:    payload.ClientEventID,
				JourneyID:        payload.JourneyID,
				ClientJourneyKey: payload.ClientJourneyKey,
				MapID:            payload.MapID, MapRevision: payload.MapRevision,
				Route: payload.PlannedRoute, Reason: payload.Reason,
				OccurredAt: envelope.Timestamp,
			},
		)
		if s.sendJourneyError(envelope.RequestID, err) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		return true, s.sendJourneyAck(envelope.RequestID, result)
	case protocol.TypeJourneyEnd:
		var payload protocol.JourneyEnd
		if err := protocol.DecodePayload(envelope.Payload, &payload); err != nil {
			s.sendProtocolError(envelope.RequestID, err)
			return false, nil
		}
		result, err := s.runner.journeys.End(
			ctx,
			s.session,
			application.EndJourneyCommand{
				ClientEventID:    payload.ClientEventID,
				JourneyID:        payload.JourneyID,
				ClientJourneyKey: payload.ClientJourneyKey,
				Outcome:          payload.Outcome, OccurredAt: envelope.Timestamp,
			},
		)
		if s.sendJourneyError(envelope.RequestID, err) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		s.publishRemoved(ctx, result.RemovedPresence)
		return true, s.sendJourneyAck(envelope.RequestID, result)
	case protocol.TypeHeartbeat:
		if err := s.runner.presences.Heartbeat(ctx, s.sessionID); err != nil {
			return false, err
		}
		return true, s.send(protocol.TypePong, envelope.RequestID, envelope.Sequence, protocol.Acknowledgement{})
	case protocol.TypeLeave:
		if err := s.runner.presences.Leave(ctx, s.sessionID); err != nil {
			return false, err
		}
		return true, s.send(protocol.TypeAck, envelope.RequestID, envelope.Sequence, protocol.Acknowledgement{})
	default:
		s.sendError(envelope.RequestID, protocol.ErrorUnknownMessage, "message type is not supported", false)
		return false, nil
	}
}

func (s *runnerState) sendJourneyAck(
	requestID string,
	result ports.JourneyCommandResult,
) error {
	return s.send(protocol.TypeAck, requestID, 0, protocol.Acknowledgement{
		JourneyID:         result.JourneyID,
		LifecycleSequence: result.LifecycleSequence,
		RouteRevision:     result.RouteRevision,
		Deduplicated:      result.Deduplicated,
	})
}

func (s *runnerState) sendJourneyError(requestID string, err error) bool {
	if err == nil {
		return false
	}
	code := ""
	message := ""
	switch {
	case errors.Is(err, application.ErrInvalidJourneyCommand),
		errors.Is(err, domain.ErrInvalidJourney),
		errors.Is(err, domain.ErrInvalidJourneyOutcome),
		errors.Is(err, domain.ErrInvalidRerouteReason),
		errors.Is(err, mapgraph.ErrInvalidRoute):
		code, message = protocol.ErrorInvalidJourney, "journey command is invalid"
	case errors.Is(err, mapgraph.ErrUnknownRevision):
		code, message = protocol.ErrorUnknownMapRevision, "map revision is not available"
	case errors.Is(err, domain.ErrJourneyNotActive),
		errors.Is(err, domain.ErrJourneyOwnerMismatch):
		code, message = protocol.ErrorJourneyNotActive, "journey is not active"
	case errors.Is(err, domain.ErrJourneyAlreadyEnded):
		code, message = protocol.ErrorJourneyEnded, "journey has already ended"
	case errors.Is(err, domain.ErrDestinationChanged):
		code, message = protocol.ErrorDestinationChanged, "destination change requires a new journey"
	default:
		return false
	}
	s.sendError(requestID, code, message, false)
	return true
}

func (s *runnerState) publishRemoved(
	ctx context.Context,
	presence *domain.Presence,
) {
	if presence != nil {
		s.runner.presences.PublishRemoved(ctx, *presence)
	}
}

func (s *runnerState) switchFloor(ctx context.Context, requestID, buildingID, floorID string) (bool, error) {
	buildingID = strings.TrimSpace(buildingID)
	floorID = strings.TrimSpace(floorID)
	if buildingID == "" || floorID == "" {
		s.sendError(requestID, protocol.ErrorInvalidMessage, "building_id and floor_id are required", false)
		return false, nil
	}
	s.closeSubscription()
	snapshot, subscription, err := s.runner.liveFloors.Subscribe(ctx, buildingID, floorID)
	if err != nil {
		return false, err
	}
	s.subscription = subscription
	if err := s.send(protocol.TypeFloorSnapshot, requestID, 0, toProtocolSnapshot(snapshot)); err != nil {
		subscription.Close()
		return false, err
	}
	pumpCtx, cancel := context.WithCancel(ctx)
	s.subCancel = cancel
	go s.pumpEvents(pumpCtx, subscription)
	return true, nil
}

func (s *runnerState) pumpEvents(ctx context.Context, subscription application.LiveFloorSubscription) {
	for {
		select {
		case <-ctx.Done():
			return
		case update, ok := <-subscription.Updates():
			if !ok {
				if ctx.Err() == nil {
					s.cancel()
				}
				return
			}
			if err := s.forwardUpdate(update); err != nil {
				if ctx.Err() != nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					return
				}
				if errors.Is(err, ErrSlowConsumer) {
					s.runner.observer.WebSocketTerminated("slow_consumer")
				} else {
					s.runner.observer.WebSocketTerminated("event_forward_failed")
				}
				s.cancel()
				return
			}
		}
	}
}

func (s *runnerState) forwardUpdate(update application.LiveFloorUpdate) error {
	switch update.Type {
	case application.LiveFloorSnapshotUpdate:
		if update.Snapshot == nil {
			return nil
		}
		return s.send(protocol.TypeOccupancyUpdated, "", 0, toProtocolSnapshot(*update.Snapshot))
	case application.LiveFloorPresenceUpdate:
		if update.Presence == nil {
			return nil
		}
		return s.send(protocol.TypePresenceUpdated, "", update.Presence.Sequence, protocol.PresenceChanged{Actor: toActor(*update.Presence)})
	case application.LiveFloorEdgeOccupancyUpdate:
		return s.send(protocol.TypeEdgeOccupancyUpdated, "", 0, protocol.EdgeOccupancyUpdated{
			BuildingID:      update.BuildingID,
			FloorID:         update.FloorID,
			EdgeOccupancies: update.EdgeOccupancies,
			GeneratedAt:     time.Now().UTC().Format(time.RFC3339Nano),
		})
	default:
		return nil
	}
}

func (s *runnerState) send(messageType, requestID string, sequence uint64, payload any) error {
	message, err := protocol.Encode(messageType, requestID, sequence, time.Now().UTC(), payload)
	if err != nil {
		return err
	}
	return s.client.enqueue(message)
}

func (s *runnerState) sendProtocolError(requestID string, err error) {
	switch {
	case errors.Is(err, protocol.ErrUnsupportedVersion):
		s.sendError(requestID, protocol.ErrorUnsupportedVersion, "protocol version is not supported", false)
	case errors.Is(err, protocol.ErrUnknownMessage):
		s.sendError(requestID, protocol.ErrorUnknownMessage, "message type is not supported", false)
	default:
		s.sendError(requestID, protocol.ErrorInvalidMessage, "message is invalid", false)
	}
}

func (s *runnerState) sendError(requestID, code, message string, retryable bool) {
	_ = s.send(protocol.TypeError, requestID, 0, protocol.ErrorMessage{Code: code, Message: message, Retryable: retryable})
}

func (s *runnerState) closeSubscription() {
	if s.subCancel != nil {
		s.subCancel()
		s.subCancel = nil
	}
	if s.subscription != nil {
		s.subscription.Close()
		s.subscription = nil
	}
}

func toProtocolSnapshot(snapshot domain.FloorSnapshot) protocol.FloorSnapshot {
	representatives := make([]protocol.ActorPresence, 0, len(snapshot.Representatives))
	for _, presence := range snapshot.Representatives {
		representatives = append(representatives, toActor(presence))
	}
	return protocol.FloorSnapshot{
		TotalActiveUsers: snapshot.TotalActiveUsers, BuildingActiveUsers: snapshot.BuildingActiveUsers,
		BuildingID: snapshot.BuildingID, FloorID: snapshot.FloorID, FloorCounts: snapshot.FloorCounts,
		Representatives: representatives, EdgeOccupancies: snapshot.EdgeOccupancies,
		GeneratedAt: snapshot.GeneratedAt,
	}
}

func toActor(presence domain.Presence) protocol.ActorPresence {
	return protocol.ActorPresence{
		ActorID: publicActorID(presence.SessionID), DisplayName: presence.DisplayName, Position: presence.Position,
		Sequence: presence.Sequence, UpdatedAt: presence.LastSeenAt,
	}
}

func publicActorID(sessionID string) string {
	hash := sha256.Sum256([]byte(sessionID))
	return hex.EncodeToString(hash[:8])
}
