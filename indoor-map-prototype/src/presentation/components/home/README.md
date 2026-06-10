# Home Components

## Purpose

This folder holds visual pieces that are specific to the home step but still worth isolating from the page container. These components keep page files focused on flow wiring and make it easier to add animation or alternate visual treatments later.

## Contains

- `HomeDashboard.tsx`: home step composition container that wires state, callbacks, and section order
- `HomeDashboardHeader.tsx`: home-only title, status, and system row section
- `HomePrimaryActions.tsx`: start navigation and scan anchor action row
- `HomeQuickDestinations.tsx`: horizontal quick destination chip list
- `HomeMapPreviewCard.tsx`: level preview card with map overview action
- `HomeMiniMapPreview.tsx`: home-specific mini route preview graphic
- `HomeRecentRoutes.tsx`: recent route list card

## Dependencies And Coupling

- uses shared theme tokens from `src/shared/theme/tokens.ts`
- uses shared dashboard primitives only after real multi-page reuse exists
- remains presentational and expects already-formatted strings from the page layer
- should be the default home for UI that belongs only to `HomeStep`

## Rules Reference

- component ownership and promotion rules live in [rules/COMPONENT_STRUCTURE_RULES.md](../../../../rules/COMPONENT_STRUCTURE_RULES.md)
