COMPOSE := docker compose -f compose.load.yaml
SCENARIO ?= presence_smoke
SUMMARY_NAME ?= $(SCENARIO)
K6_ENV ?=

.PHONY: up down status smoke steady churn burst stress journey-stress analytics baseline recovery run snapshot verify

up:
	$(COMPOSE) up -d --build --wait

down:
	$(COMPOSE) --profile load down

status:
	$(COMPOSE) ps

run:
	$(COMPOSE) --profile load run --rm $(K6_ENV) k6 run \
		--summary-export=/results/$(SUMMARY_NAME)-summary.json \
		/scripts/scenarios/$(SCENARIO).js

smoke:
	$(MAKE) run SCENARIO=presence_smoke
	./scripts/wait-for-drain.sh
	./scripts/capture-evidence.sh smoke

steady:
	$(MAKE) run SCENARIO=presence_steady
	./scripts/wait-for-drain.sh
	./scripts/capture-evidence.sh steady

churn:
	$(MAKE) run SCENARIO=presence_churn
	./scripts/wait-for-drain.sh
	./scripts/capture-evidence.sh churn

burst:
	$(MAKE) run SCENARIO=trajectory_burst
	./scripts/wait-for-drain.sh
	./scripts/capture-evidence.sh burst

stress:
	@./scripts/sample-container-stats.sh stress & sampler=$$!; \
	trap 'kill $$sampler 2>/dev/null || true; wait $$sampler 2>/dev/null || true' EXIT INT TERM; \
	$(MAKE) run SCENARIO=trajectory_stress; \
	./scripts/wait-for-drain.sh; \
	./scripts/capture-evidence.sh stress

journey-stress:
	@./scripts/sample-container-stats.sh journey-stress & sampler=$$!; \
	trap 'kill $$sampler 2>/dev/null || true; wait $$sampler 2>/dev/null || true' EXIT INT TERM; \
	$(MAKE) run SCENARIO=journey_lifecycle_stress; \
	./scripts/wait-for-drain.sh; \
	./scripts/capture-evidence.sh journey-stress

analytics:
	$(MAKE) run SCENARIO=analytics_reads
	./scripts/capture-evidence.sh analytics

baseline: steady churn burst analytics verify

recovery:
	$(COMPOSE) stop worker
	$(MAKE) run SCENARIO=trajectory_burst SUMMARY_NAME=worker_recovery K6_ENV="-e RATE=5 -e DURATION=20s -e PREALLOCATED_VUS=20 -e MAX_VUS=50"
	./scripts/capture-stream-state.sh recovery-before-restart
	$(COMPOSE) start worker
	./scripts/wait-for-drain.sh
	./scripts/capture-stream-state.sh recovery-after-drain
	./scripts/capture-evidence.sh recovery

snapshot:
	./scripts/capture-evidence.sh manual

verify:
	./scripts/verify-pipeline.sh
