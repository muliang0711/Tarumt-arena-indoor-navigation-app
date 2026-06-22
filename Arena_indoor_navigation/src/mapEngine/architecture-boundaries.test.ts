import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const mapEngineRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const srcRoot = resolve(mapEngineRoot, '..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(fullPath);
    }
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [fullPath] : [];
  });
}

function importsFor(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  return [...source.matchAll(/(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1]);
}

test('external movement consumers use only the movement public entry', () => {
  const violations: string[] = [];
  for (const filePath of sourceFiles(srcRoot)) {
    const normalized = filePath.replaceAll('\\', '/');
    if (normalized.includes('/movement_system/')) {
      continue;
    }
    for (const importedPath of importsFor(filePath)) {
      if (/movement_system\/.+/.test(importedPath)) {
        violations.push(`${relative(srcRoot, filePath)} -> ${importedPath}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('movement does not import actor, camera or rendering systems', () => {
  const movementRoot = join(mapEngineRoot, 'movement_system');
  const violations = sourceFiles(movementRoot).flatMap((filePath) =>
    importsFor(filePath)
      .filter((importedPath) => /actor_system|cameran_system|map_rendering_system/.test(importedPath))
      .map((importedPath) => `${relative(movementRoot, filePath)} -> ${importedPath}`),
  );
  assert.deepEqual(violations, []);
});

test('shared contracts are platform and subsystem neutral', () => {
  const sharedRoot = join(mapEngineRoot, 'shared');
  const violations = sourceFiles(sharedRoot).flatMap((filePath) =>
    importsFor(filePath)
      .filter((importedPath) =>
        /react|expo|actor_system|cameran_system|movement_system|map_rendering_system/.test(importedPath),
      )
      .map((importedPath) => `${relative(sharedRoot, filePath)} -> ${importedPath}`),
  );
  assert.deepEqual(violations, []);
});

test('MapScreen imports only page-safe map-engine and sensor APIs', () => {
  const mapScreen = join(srcRoot, 'screens', 'MapScreen.tsx');
  const imports = importsFor(mapScreen);
  const mapEngineImports = imports.filter((path) => path.includes('mapEngine/'));
  const sensorImports = imports.filter((path) => path.includes('sensors/'));

  assert.deepEqual(mapEngineImports, ['../mapEngine/map-controller']);
  assert.deepEqual(sensorImports, ['../sensors/useMovementSensors']);
});

test('MapScreen presents the map as a responsive full-width camera window', () => {
  const source = readFileSync(join(srcRoot, 'screens', 'MapScreen.tsx'), 'utf8');

  assert.match(source, /useWindowDimensions/);
  assert.match(source, /marginHorizontal:\s*-20/);
  assert.match(source, /padding:\s*0/);
  assert.match(source, /mapToolbar[\s\S]*position:\s*'absolute'/);
});

test('camera viewport keeps gesture updates local and commits camera state after interaction', () => {
  const viewport = readFileSync(join(mapEngineRoot, 'cameran_system', 'CameraViewport.tsx'), 'utf8');

  assert.match(viewport, /Gesture\.Pan\(\)/);
  assert.match(viewport, /Gesture\.Pinch\(\)/);
  assert.match(viewport, /shouldSyncCameraFromProps/);
  assert.match(viewport, /isGestureActive/);
  assert.match(viewport, /onInteractionStart/);
  assert.match(viewport, /onFinalize\(commitCamera\)/);
});

test('debugger exposes removable UI through one public entry', () => {
  const debuggerRoot = join(mapEngineRoot, 'debugger');
  const publicEntry = join(debuggerRoot, 'index.ts');

  assert.equal(existsSync(publicEntry), true);
  const source = readFileSync(publicEntry, 'utf8');
  assert.match(source, /MovementDebugPanel/);
  assert.match(source, /DestinationDebugLayer/);
  assert.match(source, /buildMovementDebugSnapshot/);
  assert.match(source, /findDestinationNode/);
});

test('map engine consumes debugger modules only through the debugger public entry', () => {
  const violations = sourceFiles(mapEngineRoot).flatMap((filePath) => {
    const normalized = filePath.replaceAll('\\', '/');
    if (normalized.includes('/debugger/')) {
      return [];
    }
    return importsFor(filePath)
      .filter((importedPath) => /debugger\/.+/.test(importedPath))
      .map((importedPath) => `${relative(mapEngineRoot, filePath)} -> ${importedPath}`);
  });

  assert.deepEqual(violations, []);
});

test('bob actor assets expose directional idle and run frames from src/storage/bob', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'actor_system', 'actorAssetRegistry.ts'),
    'utf8',
  );

  assert.match(source, /src\/storage\/bob|storage\/bob/);
  assert.match(source, /idle_down\.png/);
  assert.match(source, /idle_left\.png/);
  assert.match(source, /idle_right\.png/);
  assert.match(source, /idle_up\.png/);
  assert.match(source, /run_down_6\.png/);
  assert.match(source, /run_left_6\.png/);
  assert.match(source, /run_right_6\.png/);
  assert.match(source, /run_up_6\.png/);
});

test('actor layer renders directional sprites instead of a hardcoded idle frame', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'actor_system', 'ActorLayer.tsx'),
    'utf8',
  );

  assert.doesNotMatch(source, /bobActorAssets\.idleDown/);
  assert.match(source, /bobIdleAssets/);
  assert.match(source, /bobRunAssets/);
  assert.match(source, /setInterval|setTimeout/);
});

test('actor layer renders a rotating fan sector below the actor without SVG', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'actor_system', 'ActorLayer.tsx'),
    'utf8',
  );

  assert.match(source, /bobFacingFanAsset/);
  assert.match(source, /fanRotationDegrees/);
  assert.match(source, /headingRadians/);
  assert.doesNotMatch(source, /react-native-svg|<Svg|<Path/);
});

test('map engine derives Bob motion state from position changes', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'ArenaMapEngineView.tsx'),
    'utf8',
  );

  assert.match(source, /deriveActorMotionState/);
  assert.match(source, /previousActorPosition|lastActorPosition|previousPosition/);
  assert.match(source, /action:\s*bobMotionState\.action|direction:\s*bobMotionState\.direction/);
});

test('debugger public entry exposes the walkable area overlay and shared walkable helper', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'debugger', 'index.ts'),
    'utf8',
  );

  assert.match(source, /WalkableAreaDebugLayer/);
  assert.match(source, /extractTemporaryWalkableAreas/);
});
