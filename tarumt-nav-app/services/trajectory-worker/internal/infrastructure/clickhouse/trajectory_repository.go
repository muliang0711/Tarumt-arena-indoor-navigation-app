package clickhouseinfra

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/campus-navigator/trajectory-worker/internal/domain"
)

var tablePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$`)

type Options struct {
	Address         string
	Database        string
	Username        string
	Password        string
	DialTimeout     time.Duration
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	Table           string
}

type TrajectoryRepository struct {
	conn  clickhouse.Conn
	table string
}

func NewTrajectoryRepository(options Options) (*TrajectoryRepository, error) {
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
	return &TrajectoryRepository{conn: conn, table: options.Table}, nil
}

func (r *TrajectoryRepository) InsertBatch(ctx context.Context, events []domain.TrajectoryEvent) error {
	if len(events) == 0 {
		return nil
	}
	query := fmt.Sprintf(`INSERT INTO %s (
schema_version, event_id, journey_id, building_id, floor_id,
from_node_id, to_node_id, edge_progress, heading, movement_state,
observed_at, ingested_at
)`, r.table)
	batch, err := r.conn.PrepareBatch(ctx, query)
	if err != nil {
		return fmt.Errorf("prepare ClickHouse batch: %w", err)
	}
	for _, event := range events {
		if err := batch.Append(
			uint16(domain.SchemaVersion), event.EventID, event.JourneyID, event.BuildingID, event.FloorID,
			event.FromNodeID, event.ToNodeID, event.EdgeProgress, event.Heading, event.MovementState,
			event.ObservedAt, event.IngestedAt,
		); err != nil {
			return fmt.Errorf("append ClickHouse batch: %w", err)
		}
	}
	if err := batch.Send(); err != nil {
		return fmt.Errorf("send ClickHouse batch: %w", err)
	}
	return nil
}

func (r *TrajectoryRepository) Ping(ctx context.Context) error {
	if err := r.conn.Ping(ctx); err != nil {
		return err
	}
	return r.conn.Exec(ctx, fmt.Sprintf("SELECT 1 FROM %s LIMIT 0", r.table))
}

func (r *TrajectoryRepository) Close() error {
	return r.conn.Close()
}
