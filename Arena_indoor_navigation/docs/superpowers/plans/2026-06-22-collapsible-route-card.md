# Collapsible Route Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users collapse the blue route instruction card into a compact navigation button to expose more of the map.

**Architecture:** `MapRouteInstructionCard` owns a local expanded state and renders either the existing instruction panel or a compact restore button. `MapScreen` keeps the card in its existing screen-level overlay but permits pointer interaction.

**Tech Stack:** React 19, React Native 0.81, Expo Vector Icons, TypeScript, Node test runner.

---

### Task 1: Add the collapsible route instruction

**Files:**
- Modify: `src/components/MapRouteInstructionCard.tsx`
- Modify: `src/screens/MapScreen.tsx`
- Test: `src/mapEngine/architecture-boundaries.test.ts`

- [x] **Step 1: Write the failing architecture regression test**

Assert that the route card uses local collapsed state, exposes accessible collapse and expand buttons, and that the MapScreen route overlay permits pointer interaction.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test src/mapEngine/architecture-boundaries.test.ts`

Expected: failure because the route card is static and the overlay currently disables pointer events.

- [x] **Step 3: Implement the minimal toggle**

Add local `expanded` state to `MapRouteInstructionCard`. Preserve the current full card as the expanded view, add a collapse button, and render a compact blue arrow button when collapsed. Change the route overlay pointer events to `box-none`.

- [x] **Step 4: Verify the focused test, full suite, typecheck, and Android export**

Run:

```text
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
npm test
npm run typecheck
npx expo export --platform android
```

Expected: all commands exit successfully.

- [x] **Step 5: Commit**

```text
git add docs/superpowers/plans/2026-06-22-collapsible-route-card.md src/components/MapRouteInstructionCard.tsx src/screens/MapScreen.tsx src/mapEngine/architecture-boundaries.test.ts
git commit -m "feat: collapse route instruction overlay"
```
