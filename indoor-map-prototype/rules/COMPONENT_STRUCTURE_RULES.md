# Component Structure Rules

This file defines how components should be split, owned, and promoted in the project.

## Default Rule

- place a component in the closest feature or page folder first
- do not move a component into a shared folder just because it looks reusable

## Promotion Rule

- promote a component into a shared folder only after it is used by multiple pages
- promotion is also allowed when the component is clearly true shared framing, infrastructure, or cross-page chrome
- one-page usage means one-page ownership

## Home Example

- if a header, card, button group, or effect belongs only to `HomeStep`, it stays under `src/presentation/components/home/`
- generic-looking UI inside a home-only flow is still a home component until real reuse exists elsewhere

## Layout Rule

- `src/presentation/components/layout/` is for true shared layout framing
- shells may expose extension points such as `header` or custom slots
- page-owned visuals passed into a shell still belong to the page feature, not to `layout/`

## Splitting Rule

- split a page when a UI block has its own visual identity, behavior, animation, or likely iteration path
- do not split tiny fragments with no independent value
- split for clarity and ownership, not for file-count vanity

## Naming Rule

- name files by ownership and role, not by vague generic terms
- prefer names such as `HomeStepHeader`, `HomeActionStack`, or `ConfirmRouteCard`
- avoid names that imply broad reuse when the component is still page-specific

## Documentation Rule

- durable component-organization decisions belong in `rules/`
- feature READMEs may summarize local structure, but they should point back to this file instead of redefining the rules

## Future Additions

- append new component rules here when new patterns appear
- keep this file focused on ownership, splitting, placement, naming, and promotion decisions
