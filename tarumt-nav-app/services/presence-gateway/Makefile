.PHONY: format vet test race build verify redis-up redis-test redis-down verify-redis run publish-main-campus-map

format:
	gofmt -w $$(find . -name '*.go' -not -path './vendor/*')

vet:
	go vet ./...

test:
	go test ./...

race:
	go test -race ./...

build:
	go build ./cmd/presence-gateway

verify: format vet test race build

redis-up:
	docker compose -f compose.redis.yaml up -d --wait

redis-test:
	PRESENCE_REDIS_TEST_URL=redis://127.0.0.1:16379/15 go test -count=1 ./tests/redisintegration

redis-down:
	docker compose -f compose.redis.yaml down

verify-redis: verify redis-up redis-test

run:
	go run ./cmd/presence-gateway

publish-main-campus-map:
	go run ./cmd/map-bundle-publisher \
		-workspace ../.. \
		-source contracts/maps/main-campus/map-bundle.source.json \
		-output map-data/main-campus
