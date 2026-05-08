# Shared Components

## Purpose

This folder holds presentation components that were promoted out of a page or feature folder after real multi-page reuse. Put a component here only when it has genuinely become cross-feature UI.

## Contains

- `HeaderSystemRow.tsx`: shared time and system-status strip used across multiple headers
- `DestinationSearchBar.tsx`: reusable expanding search bar shared by destination flow headers
- `ActionDock.tsx`: reusable bottom action dock shared across multiple pages
- `DashboardBottomNavigation.tsx`: shared five-tab bottom navigation used by dashboard-style pages
- `DashboardFloorPlanBackground.tsx`: shared floor-plan background used behind dashboard-style pages
- `DashboardGlassPanel.tsx`: shared frosted panel wrapper used by dashboard-style pages
- `DashboardIcons.tsx`: shared icon set for dashboard-style actions and tabs
- `DashboardRoutePreview.tsx`: shared mini route preview used outside the home-specific mini map
- `DashboardSearchField.tsx`: shared search field used by dashboard-style pages

## Dependencies And Coupling

- uses shared theme tokens from `src/shared/theme/tokens.ts`
- stays presentational and should not own page flow or navigation decisions
- should be the home for reused primitives that are not specific to `layout/`, `controls/`, or a single feature folder

## Rules Reference

- component ownership and promotion rules live in [rules/COMPONENT_STRUCTURE_RULES.md](../../../../rules/COMPONENT_STRUCTURE_RULES.md)
