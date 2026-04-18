# Application Flows

## Purpose

This folder groups feature-level orchestration code. A flow in this repo is more than a helper; it is the logic that turns parsed domain data into screen-ready state and actions for one user journey.

Right now there is a single indoor navigation flow, but this directory is the place where additional flows should land if the prototype grows into multiple journeys.

## Contains

- `indoor-map/`: the current end-to-end navigation flow, from destination picking to live route tracking

## Entry Points

- `indoor-map/useIndoorMapFlow.ts`: the flow model exposed to the presentation layer

## Dependencies And Coupling

- flow folders may depend on `src/integration/` and `src/shared/`
- sibling flows should stay isolated from each other and communicate through shared contracts instead of direct imports

## When To Read Deeper

Read deeper when the task is about user journey state machines, feature-specific hooks, or route-building rules rather than generic UI rendering.
