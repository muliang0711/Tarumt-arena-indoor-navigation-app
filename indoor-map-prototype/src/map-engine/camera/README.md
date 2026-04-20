# Map Engine Camera

## Purpose

`camera/` will own map-camera behavior.

This includes the rules for viewport movement, zooming, fitting, recentering, follow-user behavior, and conflict handling between manual interaction and automatic navigation focus.

## Intended Ownership

Examples of future ownership:

- camera state models
- camera controller logic
- zoom and bounds policies
- recenter rules
- follow mode behavior

## Not For

- route generation
- localization fusion
- screen overlays

## Current Phase

Scaffold only. No runtime code has been moved here yet.
