# Next Repo Steps

## Highest-value improvements

### 1. Replace plain rectangles with tile atlas rendering

Right now `pixelRenderer.ts` uses a lot of `fillRect`.

Next step:

- create a tileset PNG
- define tile IDs
- render tiles with `drawImage`

### 2. Separate logic tiles from art tiles

Do not force one tile system to do everything.

Split into:

- logical graph tiles
- visual art tiles

### 3. Add layers

Aim for:

- ground layer
- wall layer
- object layer
- overlay layer
- interaction layer

### 4. Add authored spaces

Do not auto-generate every important visual area.

Manually author:

- lobbies
- special rooms
- landmarks
- decorative corners

### 5. Move from one palette to theme packs

Later you should support themes like:

- hospital
- office
- mall
- school
- factory

Each theme can define:

- palette
- labels
- highlight colors
- optional tile atlas
