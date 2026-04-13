# Indoor Map Prototype Architecture

This project is organized into explicit frontend layers so the navigation prototype can grow without collapsing into one large screen file.

## Layers

### `src/presentation`

Owns rendering and user interaction.

- screens
- visual components
- viewport gestures

### `src/application`

Owns feature flow and state orchestration.

- indoor map flow controller
- scenario and route-building logic
- future module entry points such as AR

### `src/integration`

Owns data loading and external boundaries.

- local map package loading
- map parsing
- future backend or Supabase adapters

### `src/shared`

Owns shared contracts and tokens.

- shared types
- theme tokens

## Dependency direction

The intended dependency flow is:

`presentation -> application -> integration`

`shared` may be used by all layers.

This direction keeps the UI replaceable, keeps application logic testable, and gives the project a clean place to attach future modules such as AR and backend synchronization.
