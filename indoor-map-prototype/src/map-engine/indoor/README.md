# Map Engine Indoor

## Purpose

`indoor/` will isolate indoor-specific semantics so the whole engine does not become implicitly hardcoded around room and floor rules.

This folder is the place for concepts that are specific to indoor navigation rather than generic map capability.

## Intended Ownership

Examples of future ownership:

- floor semantics
- room anchors
- stairs and elevator rules
- vertical navigation policies

## Not For

- generic camera behavior
- generic route search internals
- screen-specific destination UI state

## Current Phase

Scaffold only. No runtime code has been moved here yet.
