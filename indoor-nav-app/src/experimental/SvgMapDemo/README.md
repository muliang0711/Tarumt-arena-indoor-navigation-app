# Experimental SVG Map Demo

This folder contains a proof-of-concept for migrating the UI map rendering to use a static SVG background instead of calculating and drawing raw coordinate lines.

This demonstrates how a static SVG asset (represented here by `FloorplanMock.tsx`) can handle the aesthetic and performance burden of the background map, while only the essential dynamic elements (User dot, Path highlights, interactive click markers) are drawn over it programmatically.

## How to test this without affecting the existing MVP:

Since you didn't want any existing code modified, you can simply edit your `App.tsx` temporarily whenever you are ready to test it.

**In your `App.tsx`:**

1. Change this line:
   ```ts
   import MapScreen from './src/screens/MapScreen';
   ```
   To this line:
   ```ts
   import MapScreen from './src/experimental/SvgMapDemo/SvgMapScreen';
   ```

2. That's it! Your app will load the experimental SVG mockup screen instead of the regular screen, allowing you to test out the visual differences without breaking your original MVP logic.
