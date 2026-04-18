# Home Components

## Purpose

This folder holds visual pieces that are specific to the home step but still worth isolating from the page container. These components keep page files focused on flow wiring and make it easier to add animation or alternate visual treatments later.

## Contains

- `HomeStepHeader.tsx`: page-specific header block for the home step
- `HomeHeroCard.tsx`: status card for the current indoor anchor and active map package
- `HomeActionStack.tsx`: frosted glass bottom dock for the home-step navigation CTA

## Dependencies And Coupling

- uses shared theme tokens from `src/shared/theme/tokens.ts`
- remains presentational and expects already-formatted strings from the page layer
- should be the default home for UI that belongs only to `HomeStep`
