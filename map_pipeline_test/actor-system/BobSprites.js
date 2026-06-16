const DIRECTIONS = ["down", "left", "right", "up"];
const RUN_FRAME_COUNT = 6;
const DEFAULT_FRAME_DURATION_MS = 100;
const DEFAULT_SPRITE_SIZE = 32;

export function createBobSpriteManifest(basePath = "assets/actors/bob") {
  const root = basePath.replace(/\/+$/g, "");
  const idle = {};
  const run = {};

  for (const direction of DIRECTIONS) {
    idle[direction] = `${root}/bob_stand/idle_${direction}.png`;
    run[direction] = Array.from({ length: RUN_FRAME_COUNT }, (_, index) => (
      `${root}/bob_run/run_${direction}_${index + 1}.png`
    ));
  }

  return { idle, run };
}

export async function loadBobSprites(options = {}) {
  const manifest = createBobSpriteManifest(options.basePath || "assets/actors/bob");
  const idle = {};
  const run = {};

  await Promise.all(DIRECTIONS.map(async (direction) => {
    idle[direction] = frameFromImage(await loadImage(manifest.idle[direction]));
    run[direction] = await Promise.all(manifest.run[direction].map(async (url) => (
      frameFromImage(await loadImage(url))
    )));
  }));

  return { idle, run };
}

export function selectBobSprite(spriteSet, actor, options = {}) {
  if (!spriteSet) {
    return null;
  }

  const direction = DIRECTIONS.includes(actor.direction) ? actor.direction : "down";
  if (actor.action === "run" && Array.isArray(spriteSet.run?.[direction]) && spriteSet.run[direction].length > 0) {
    const frameDurationMs = options.frameDurationMs || DEFAULT_FRAME_DURATION_MS;
    const frameIndex = Math.floor((actor.animationMs || 0) / frameDurationMs) % spriteSet.run[direction].length;
    return spriteSet.run[direction][frameIndex];
  }

  return spriteSet.idle?.[direction] || spriteSet.idle?.down || null;
}

function frameFromImage(image) {
  return {
    image,
    width: image.naturalWidth || image.width || DEFAULT_SPRITE_SIZE,
    height: image.naturalHeight || image.height || DEFAULT_SPRITE_SIZE,
    anchorX: 0.5,
    anchorY: 1,
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image failed to load: ${url}`));
    image.src = url;
  });
}
