import { describe, expect, it } from "vitest";
import { cleanAssetId, createAssetManifestItems, inferBlocksMovement } from "./assetManifest";

describe("assetManifest", () => {
  it("uses clean base filenames as asset ids", () => {
    expect(cleanAssetId("serious_shit/classroom_1.png")).toBe("classroom_1");
  });

  it("marks roads and white tiles as non-blocking", () => {
    expect(inferBlocksMovement("walkable_road_clean.png")).toBe(false);
    expect(inferBlocksMovement("white_tile.png")).toBe(false);
  });

  it("creates sorted manifest items", () => {
    expect(createAssetManifestItems(["toilet.png", "classroom_1.png"], 16)).toEqual([
      expect.objectContaining({ id: "classroom_1", src: "classroom_1.png" }),
      expect.objectContaining({ id: "toilet", src: "toilet.png" }),
    ]);
  });
});
