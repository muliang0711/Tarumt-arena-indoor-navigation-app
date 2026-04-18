# Shared Theme

## Purpose

This folder contains presentation tokens that define the prototype's visual system in one place. It keeps color, spacing, and radius choices out of individual components so the UI can stay visually consistent as the demo expands.

## Contains

- `tokens.ts`: exported color palette plus spacing and radius scales

## Entry Points

- `tokens.ts`: imported by most files under `src/presentation/`

## Dependencies And Coupling

- tightly coupled to presentation, but intentionally isolated from business logic
- if a styling change should be global, start here before touching individual components

## When To Read Deeper

Open this folder when changing the overall look of the prototype or when repeated hard-coded style values start appearing in components.
