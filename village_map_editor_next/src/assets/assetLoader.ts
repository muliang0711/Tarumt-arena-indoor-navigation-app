import { createAssetManifestItems } from "./assetManifest";
import type { MapAsset } from "../map/schema";

interface AssetApiEntry {
  relativePath: string;
  url: string;
}

export interface LoadedEditorAssets {
  assets: MapAsset[];
  images: Map<string, HTMLImageElement>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

function analyzeBlockedOffsets(image: HTMLImageElement, tileSize: number): Array<{ x: number; y: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return [];
  }

  ctx.drawImage(image, 0, 0);
  const columns = Math.ceil(image.naturalWidth / tileSize);
  const rows = Math.ceil(image.naturalHeight / tileSize);
  const offsets: Array<{ x: number; y: number }> = [];
  const alphaThreshold = 45;
  const tileCoverageThreshold = 0.18;

  for (let tileY = 0; tileY < rows; tileY += 1) {
    for (let tileX = 0; tileX < columns; tileX += 1) {
      const x = tileX * tileSize;
      const y = tileY * tileSize;
      const width = Math.min(tileSize, image.naturalWidth - x);
      const height = Math.min(tileSize, image.naturalHeight - y);
      const { data } = ctx.getImageData(x, y, width, height);
      let visiblePixels = 0;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > alphaThreshold) {
          visiblePixels += 1;
        }
      }
      if (visiblePixels / (width * height) >= tileCoverageThreshold) {
        offsets.push({ x: tileX, y: tileY });
      }
    }
  }

  return offsets;
}

export async function loadEditorAssets(tileSize: number): Promise<LoadedEditorAssets> {
  const response = await fetch("/api/assets");
  if (!response.ok) {
    throw new Error("Unable to load asset manifest.");
  }

  const entries = (await response.json()) as AssetApiEntry[];
  const loaded = await Promise.all(
    entries.map(async (entry) => {
      const image = await loadImage(entry.url);
      const [asset] = createAssetManifestItems(
        [
          {
            relativePath: entry.relativePath,
            widthPixels: image.naturalWidth,
            heightPixels: image.naturalHeight,
            blockedOffsets: analyzeBlockedOffsets(image, tileSize),
          },
        ],
        tileSize,
      );
      return { asset, image };
    }),
  );

  return {
    assets: loaded.map((item) => item.asset).sort((left, right) => left.id.localeCompare(right.id)),
    images: new Map(loaded.map((item) => [item.asset.id, item.image])),
  };
}
