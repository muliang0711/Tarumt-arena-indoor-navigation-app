# Shared Components

## Purpose

This folder holds presentation components that were promoted out of a page or feature folder after real multi-page reuse. Put a component here only when it has genuinely become cross-feature UI.

## Contains

- `HeaderSystemRow.tsx`: shared time and system-status strip used across multiple headers
- `DestinationSearchBar.tsx`: reusable expanding search bar shared by destination flow headers

## Dependencies And Coupling

- uses shared theme tokens from `src/shared/theme/tokens.ts`
- stays presentational and should not own page flow or navigation decisions
- should be the home for reused primitives that are not specific to `layout/`, `controls/`, or a single feature folder
