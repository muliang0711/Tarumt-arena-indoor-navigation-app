# Map Types

## Two different kinds of "2D map"

### 1. Pixel-art tilemap

This is the normal game-style map made from tiles:

- floors
- walls
- grass
- water
- props
- shadows
- decorations

This kind of map is usually built by hand in tools like Aseprite and Tiled.

### 2. Data-driven graph map

This is what your current `demo` project is doing:

- nodes become rooms or facilities
- edges become corridors
- JSON data is converted into a readable layout

This is useful for:

- indoor navigation
- building layouts
- route visualization
- floor previews

## Important difference

A beautiful pixel-art map is mostly an art and tile workflow.

A graph map is mostly a data and rendering workflow.

Your project already has a useful graph workflow. What it still needs is a stronger visual tilemap workflow.
