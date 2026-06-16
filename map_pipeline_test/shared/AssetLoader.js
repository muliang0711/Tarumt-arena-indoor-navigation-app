export function buildAssetManifest(mapData, basePath = "assets/") {
  const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const manifest = new Map();

  for (const asset of mapData.assets) {
    const src = asset.src.replace(/\\/g, "/").replace(/^\/+/, "");
    manifest.set(asset.id, {
      ...asset,
      url: `${normalizedBasePath}${mapData.resourceRoot}/${src}`,
    });
  }

  return manifest;
}

export async function loadAssets(mapData, options = {}) {
  const manifest = buildAssetManifest(mapData, options.basePath || "assets/");
  const images = new Map();
  const missing = [];

  await Promise.all([...manifest.entries()].map(async ([id, asset]) => {
    try {
      images.set(id, await loadImage(asset.url));
    } catch (error) {
      missing.push({ id, url: asset.url, error });
      console.warn(`[map_pipeline_test] Missing tileset asset "${id}" at ${asset.url}.`);
    }
  }));

  return { manifest, images, missing };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image failed to load: ${url}`));
    image.src = url;
  });
}
