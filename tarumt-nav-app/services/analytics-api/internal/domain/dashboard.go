package domain

import "time"

type JourneySummaryRow struct {
	Day               string
	DestinationNodeID string
	Outcome           string
	Count             uint64
}

type DestinationSummary struct {
	NodeID string `json:"node_id"`
	Count  uint64 `json:"count"`
}

type DailyJourneys struct {
	Day   string `json:"day"`
	Count uint64 `json:"count"`
}

type DashboardReport struct {
	From         time.Time            `json:"from"`
	To           time.Time            `json:"to"`
	Timezone     string               `json:"timezone"`
	Total        uint64               `json:"total"`
	Arrived      uint64               `json:"arrived"`
	Cancelled    uint64               `json:"cancelled"`
	Expired      uint64               `json:"expired"`
	Active       uint64               `json:"active"`
	Destinations []DestinationSummary `json:"destinations"`
	Days         []DailyJourneys      `json:"days"`
	GeneratedAt  time.Time            `json:"generated_at"`
}
