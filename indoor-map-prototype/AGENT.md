# Agent Working Rules

This file is the execution guide for future changes in this repository. Use it together with the durable rule files in `rules/`.

## Required Reading

Before changing structure, components, or UI organization, read:

- [`rules/COMPONENT_STRUCTURE_RULES.md`](./rules/COMPONENT_STRUCTURE_RULES.md)
- [`rules/APP_COLOR_PALETTE.md`](./rules/APP_COLOR_PALETTE.md)

## Non-Negotiable Rules

### 1. Promote reused components in the same patch

- if a component becomes used by more than one page, it must stop living as a page-owned component
- move it into the appropriate shared folder in the same patch
- choose the shared folder by ownership:
  - `src/presentation/components/shared/` for cross-feature reusable components
  - `src/presentation/components/layout/` only for true shared layout framing or shell-level chrome
- do not leave a reused component inside its old page folder just because that is where it started

### 2. Page-specific components stay page-owned until real reuse exists

- default to the closest feature or page folder first
- do not promote something to shared only because it looks generic
- one-page ownership stays with the page folder until real multi-page reuse happens

### 3. Documentation updates are part of the same change

- if a patch moves, promotes, adds, or removes shared structure, update the related docs in the same patch
- do not leave stale README paths, stale folder descriptions, or missing folder docs behind
- if a new shared folder is introduced, add or update its folder-level `README.md`
- if the root-level working rules change, update this file and the relevant file under `rules/`

### 4. No structural half-finished work

- do not ship a patch where code reflects a new ownership model but docs still describe the old one
- do not ship a patch where imports prove a component is shared but the file still lives in a page-only folder

## Required Checks After Structural Changes

After any component move, promotion, or structural refactor:

1. update imports
2. update affected `README.md` files
3. update `rules/` if the rule itself changed
4. run `npm run typecheck`

## Practical Examples

- if `HomeStepHeader` starts being used by another page, it should be promoted out of `home/` in that same patch
- if a destination search bar is reused by multiple pages, it should move to `shared/` and the components docs should be updated in that same patch
- if a component stays used by only one page, it should stay in that feature folder even if it looks reusable
