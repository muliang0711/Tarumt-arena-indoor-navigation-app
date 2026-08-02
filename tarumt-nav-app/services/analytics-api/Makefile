.PHONY: format vet test race build verify analytics-up api-up integration-test analytics-down verify-integration run

format:
	gofmt -w $$(find . -name '*.go' -not -path './vendor/*')

vet:
	go vet ./...

test:
	go test ./...

race:
	go test -race ./...

build:
	go build ./cmd/analytics-api

verify: format vet test race build

analytics-up:
	$(MAKE) -C ../trajectory-worker analytics-up

api-up:
	docker compose -f ../trajectory-worker/compose.analytics.yaml --profile api up -d --build --wait analytics-api

integration-test:
	ANALYTICS_INTEGRATION_CLICKHOUSE_ADDRESS=127.0.0.1:19000 \
	ANALYTICS_INTEGRATION_CLICKHOUSE_USERNAME=trajectory \
	ANALYTICS_INTEGRATION_CLICKHOUSE_PASSWORD=trajectory-test \
	go test -count=1 -v ./tests/integration

analytics-down:
	docker compose -f ../trajectory-worker/compose.analytics.yaml --profile api down

verify-integration: verify analytics-up integration-test

run:
	go run ./cmd/analytics-api
