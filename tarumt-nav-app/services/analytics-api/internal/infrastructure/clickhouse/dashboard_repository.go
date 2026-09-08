package clickhouseinfra

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/campus-navigator/analytics-api/internal/domain"
)

// Collapse lifecycle retries and reroutes by journey before counting selections.
// Outcomes belong to journeys started inside the selected local-calendar period.
func (r *AnalyticsRepository) JourneySummary(ctx context.Context, mapID string, from, to time.Time) ([]domain.JourneySummaryRow, error) {
	table := strings.SplitN(r.table, ".", 2)[0] + ".journey_lifecycle_events_v1"
	query := fmt.Sprintf(`SELECT toString(toDate(started_at, 'Asia/Kuala_Lumpur')) AS day,
 destination, outcome, count()
FROM (
 SELECT journey_id,
 minIf(occurred_at, event_type = 'journey_started') AS started_at,
 argMinIf(ifNull(destination_node_id, ''), lifecycle_sequence, event_type = 'journey_started') AS destination,
 argMaxIf(outcome, lifecycle_sequence, event_type = 'journey_ended') AS outcome
 FROM %s FINAL
 WHERE map_id = ? AND occurred_at >= ? AND occurred_at < ?
 GROUP BY journey_id
 HAVING countIf(event_type = 'journey_started') > 0
)
GROUP BY day, destination, outcome
ORDER BY day, destination, outcome`, table)
	rows, err := r.conn.Query(ctx, query, mapID, from, to)
	if err != nil {
		return nil, fmt.Errorf("query journey summary: %w", err)
	}
	defer rows.Close()
	result := []domain.JourneySummaryRow{}
	for rows.Next() {
		var row domain.JourneySummaryRow
		if err := rows.Scan(&row.Day, &row.DestinationNodeID, &row.Outcome, &row.Count); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}
