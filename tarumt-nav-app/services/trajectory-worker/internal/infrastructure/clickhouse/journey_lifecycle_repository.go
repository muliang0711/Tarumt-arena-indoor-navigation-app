package clickhouseinfra

import (
	"context"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/campus-navigator/trajectory-worker/internal/domain"
)

type JourneyLifecycleRepository struct {
	conn  clickhouse.Conn
	table string
}

func NewJourneyLifecycleRepository(options Options) (*JourneyLifecycleRepository, error) {
	if !tablePattern.MatchString(options.Table) {
		return nil, fmt.Errorf("invalid ClickHouse table identifier %q", options.Table)
	}
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{options.Address},
		Auth: clickhouse.Auth{
			Database: options.Database, Username: options.Username, Password: options.Password,
		},
		DialTimeout:  options.DialTimeout,
		Compression:  &clickhouse.Compression{Method: clickhouse.CompressionLZ4},
		MaxOpenConns: options.MaxOpenConns, MaxIdleConns: options.MaxIdleConns,
		ConnMaxLifetime: options.ConnMaxLifetime,
	})
	if err != nil {
		return nil, fmt.Errorf("open ClickHouse: %w", err)
	}
	return &JourneyLifecycleRepository{conn: conn, table: options.Table}, nil
}

func (r *JourneyLifecycleRepository) InsertBatch(
	ctx context.Context,
	events []domain.JourneyLifecycleEvent,
) error {
	if len(events) == 0 {
		return nil
	}
	query := fmt.Sprintf(`INSERT INTO %s (
schema_version, event_type, event_id, client_event_id, journey_id,
client_journey_key, map_id, map_revision, lifecycle_sequence, route_revision,
occurred_at, ingested_at, origin_node_id, destination_node_id,
planned_edge_ids, reroute_reason, outcome
)`, r.table)
	batch, err := r.conn.PrepareBatch(ctx, query)
	if err != nil {
		return fmt.Errorf("prepare ClickHouse Journey batch: %w", err)
	}
	for _, event := range events {
		var originNodeID *string
		var destinationNodeID *string
		edgeIDs := []string{}
		if event.PlannedRoute != nil {
			originNodeID = &event.PlannedRoute.OriginNodeID
			destinationNodeID = &event.PlannedRoute.DestinationNodeID
			edgeIDs = event.PlannedRoute.PlannedEdgeIDs
		}
		if err := batch.Append(
			uint16(domain.JourneyLifecycleSchemaVersion),
			event.EventType,
			event.EventID,
			event.ClientEventID,
			event.JourneyID,
			event.ClientJourneyKey,
			event.MapID,
			event.MapRevision,
			event.LifecycleSequence,
			event.RouteRevision,
			event.OccurredAt,
			event.IngestedAt,
			originNodeID,
			destinationNodeID,
			edgeIDs,
			event.Reason,
			event.Outcome,
		); err != nil {
			return fmt.Errorf("append ClickHouse Journey batch: %w", err)
		}
	}
	if err := batch.Send(); err != nil {
		return fmt.Errorf("send ClickHouse Journey batch: %w", err)
	}
	return nil
}

func (r *JourneyLifecycleRepository) Ping(ctx context.Context) error {
	if err := r.conn.Ping(ctx); err != nil {
		return err
	}
	return r.conn.Exec(ctx, fmt.Sprintf("SELECT 1 FROM %s LIMIT 0", r.table))
}

func (r *JourneyLifecycleRepository) Close() error {
	return r.conn.Close()
}
