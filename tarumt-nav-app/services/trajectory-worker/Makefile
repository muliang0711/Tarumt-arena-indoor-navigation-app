.PHONY: format vet test race build verify analytics-up integration-test analytics-down verify-integration run

format:
	gofmt -w $$(find . -name '*.go' -not -path './vendor/*')

vet:
	go vet ./...

test:
	go test ./...

race:
	go test -race ./...

build:
	go build ./cmd/trajectory-worker

verify: format vet test race build

analytics-up:
	docker compose -f compose.analytics.yaml up -d --wait redis clickhouse

integration-test:
	@gateway_binary=$$(mktemp /tmp/campus-presence-gateway.XXXXXX); \
	trap 'rm -f "$$gateway_binary"' EXIT; \
	(cd ../presence-gateway && go build -o "$$gateway_binary" ./cmd/presence-gateway); \
	TRAJECTORY_INTEGRATION_GATEWAY_BINARY="$$gateway_binary" \
	TRAJECTORY_INTEGRATION_REDIS_URL=redis://127.0.0.1:26379/15 \
	TRAJECTORY_INTEGRATION_CLICKHOUSE_ADDRESS=127.0.0.1:19000 \
	TRAJECTORY_INTEGRATION_CLICKHOUSE_USERNAME=trajectory \
	TRAJECTORY_INTEGRATION_CLICKHOUSE_PASSWORD=trajectory-test \
	go test -count=1 -v ./tests/integration

analytics-down:
	docker compose -f compose.analytics.yaml down

verify-integration: verify analytics-up integration-test

run:
	go run ./cmd/trajectory-worker
