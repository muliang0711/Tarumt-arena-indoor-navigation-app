# Home Components

## Purpose

This folder holds visual pieces that are specific to the home step but still worth isolating from the page container. These components keep page files focused on flow wiring and make it easier to add animation or alternate visual treatments later.

## Contains

- `HomeHeroCard.tsx`: status card for the current indoor anchor, camera state, and active map package

## Dependencies And Coupling

- uses shared theme tokens from `src/shared/theme/tokens.ts`
- remains presentational and expects already-formatted strings from the page layer
