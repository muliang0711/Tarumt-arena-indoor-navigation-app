# Your Current Demo

## What the `demo` app already does

Your current pipeline is already useful:

- `src/parsing/graphParser.ts` reads JSON nodes and edges
- `src/transform/sceneBuilder.ts` projects graph data onto a tile grid
- `src/render/pixelRenderer.ts` draws corridors, markers, labels, and highlights
- `src/render/mapTheme.ts` defines the current visual palette
- `src/components/GraphCanvas.tsx` handles pan, zoom, hover, and selection

## What this means

You are not starting from zero in code.

You already have:

- graph loading
- floor filtering
- scene generation
- canvas rendering
- interaction

## Why it still does not feel like a polished pixel map

Right now the renderer is optimized for readability, not art quality:

- many shapes are flat rectangles
- there is no tile atlas
- there are no decorative layers
- there is no authored tile placement
- there is little visual variation

This is normal for a prototype. The base is good. The art pipeline is the missing piece.
