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
