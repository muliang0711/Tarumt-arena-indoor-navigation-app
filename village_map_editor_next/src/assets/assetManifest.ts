import type { MapAsset } from "../map/schema";

export interface SourceAssetFile {
  relativePath: string;
  widthPixels?: number;
  heightPixels?: number;
  blockedOffsets?: Array<{ x: number; y: number }>;
}

function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, "/").split("/").at(-1) ?? path;
}

export function cleanAssetId(path: string): string {
  return fileNameFromPath(path).replace(/\.png$/i, "").replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

export function inferBlocksMovement(path: string): boolean {
  const fileName = fileNameFromPath(path).toLowerCase();
  return !(
    fileName.includes("walkable") ||
    fileName.includes("road") ||
    fileName.includes("white_tile") ||
    fileName.includes("white_greg_tile")
  );
}

export function createAssetManifestItems(files: Array<string | SourceAssetFile>, tileSize: number): MapAsset[] {
  return files
    .map((file) => {
      const source = typeof file === "string" ? { relativePath: file } : file;
      const src = fileNameFromPath(source.relativePath);
      return {
        id: cleanAssetId(source.relativePath),
        src,
        widthTiles: Math.max(1, Math.ceil((source.widthPixels ?? tileSize) / tileSize)),
        heightTiles: Math.max(1, Math.ceil((source.heightPixels ?? tileSize) / tileSize)),
        blocksMovement: inferBlocksMovement(source.relativePath),
        blockedOffsets: source.blockedOffsets,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}
