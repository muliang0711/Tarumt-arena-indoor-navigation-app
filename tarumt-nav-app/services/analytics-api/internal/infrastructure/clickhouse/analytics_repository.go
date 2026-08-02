package clickhouseinfra

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/campus-navigator/analytics-api/internal/domain"
)

var tablePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$`)

type Options struct {
	Address         string
	Database        string
	Username        string
	Password        string
	Table           string
	DialTimeout     time.Duration
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

type AnalyticsRepository struct {
	conn  clickhouse.Conn
	table string
}

func NewAnalyticsRepository(options Options) (*AnalyticsRepository, error) {
	if !tablePattern.MatchString(options.Table) {
		return nil, fmt.Errorf("invalid ClickHouse table identifier %q", options.Table)
	}
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr:         []string{options.Address},
		Auth:         clickhouse.Auth{Database: options.Database, Username: options.Username, Password: options.Password},
		DialTimeout:  options.DialTimeout,
		Compression:  &clickhouse.Compression{Method: clickhouse.CompressionLZ4},
		MaxOpenConns: options.MaxOpenConns, MaxIdleConns: options.MaxIdleConns,
		ConnMaxLifetime: options.ConnMaxLifetime,
	})
	if err != nil {
		return nil, fmt.Errorf("open ClickHouse: %w", err)
	}
	return &AnalyticsRepository{conn: conn, table: options.Table}, nil
}

func (r *AnalyticsRepository) FloorTraffic(ctx context.Context, query domain.TrafficQuery, policy domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error) {
	sql := fmt.Sprintf(`
SELECT %s AS bucket_start,
       uniqExact(journey_id) AS journey_count,
       uniqExact(event_id) AS event_count
FROM %s FINAL
WHERE building_id = ? AND floor_id = ?
  AND observed_at >= ? AND observed_at < ?
GROUP BY bucket_start
HAVING journey_count >= ?
ORDER BY bucket_start
LIMIT ?`, bucketExpression(query.Bucket), r.table)
	return r.queryRows(ctx, sql, false, query, policy)
}

func (r *AnalyticsRepository) RouteEdgeUsage(ctx context.Context, query domain.TrafficQuery, policy domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error) {
	sql := fmt.Sprintf(`
SELECT %s AS bucket_start,
       from_node_id,
       to_node_id,
       uniqExact(journey_id) AS journey_count,
       uniqExact(event_id) AS event_count
FROM %s FINAL
WHERE building_id = ? AND floor_id = ?
  AND observed_at >= ? AND observed_at < ?
GROUP BY bucket_start, from_node_id, to_node_id
HAVING journey_count >= ?
ORDER BY bucket_start, journey_count DESC, from_node_id, to_node_id
LIMIT ?`, bucketExpression(query.Bucket), r.table)
	return r.queryRows(ctx, sql, true, query, policy)
}

func (r *AnalyticsRepository) queryRows(ctx context.Context, sql string, includeEdge bool, query domain.TrafficQuery, policy domain.QueryPolicy) ([]domain.AggregateRow, domain.QueryStats, error) {
	var stats domain.QueryStats
	queryCtx := clickhouse.Context(ctx, clickhouse.WithProgress(func(progress *clickhouse.Progress) {
		stats.RowsRead += progress.Rows
		stats.BytesRead += progress.Bytes
	}))
	rows, err := r.conn.Query(queryCtx, sql,
		query.BuildingID, query.FloorID, query.From, query.To,
		policy.PrivacyThreshold, policy.MaxResultRows+1,
	)
	if err != nil {
		return nil, stats, fmt.Errorf("execute ClickHouse aggregate query: %w", err)
	}
	defer rows.Close()
	result := make([]domain.AggregateRow, 0)
	for rows.Next() {
		var row domain.AggregateRow
		if includeEdge {
			err = rows.Scan(&row.BucketStart, &row.FromNodeID, &row.ToNodeID, &row.JourneyCount, &row.EventCount)
		} else {
			err = rows.Scan(&row.BucketStart, &row.JourneyCount, &row.EventCount)
		}
		if err != nil {
			return nil, stats, fmt.Errorf("scan ClickHouse aggregate row: %w", err)
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, stats, fmt.Errorf("iterate ClickHouse aggregate rows: %w", err)
	}
	return result, stats, nil
}

func (r *AnalyticsRepository) Ping(ctx context.Context) error {
	if err := r.conn.Ping(ctx); err != nil {
		return err
	}
	return r.conn.Exec(ctx, fmt.Sprintf("SELECT 1 FROM %s LIMIT 0", r.table))
}

func (r *AnalyticsRepository) Close() error { return r.conn.Close() }

func bucketExpression(bucket domain.Bucket) string {
	switch bucket {
	case domain.Bucket15Minutes:
		return "toStartOfFifteenMinutes(observed_at, 'UTC')"
	case domain.BucketHour:
		return "toStartOfHour(observed_at, 'UTC')"
	case domain.BucketDay:
		return "toStartOfDay(observed_at, 'UTC')"
	default:
		panic("validated analytics bucket is unsupported")
	}
}
