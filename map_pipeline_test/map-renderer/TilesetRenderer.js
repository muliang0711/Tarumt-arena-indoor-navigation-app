export class TilesetRenderer {
  constructor(mapData, assetBundle) {
    this.mapData = mapData;
    this.manifest = assetBundle.manifest;
    this.images = assetBundle.images;
    this.missing = assetBundle.missing;
  }

  drawVisualLayers(ctx, visualLayers) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const placement of visualLayers) {
      this.drawPlacement(ctx, placement);
    }
    ctx.restore();
  }

  drawPlacement(ctx, placement) {
    const asset = this.manifest.get(placement.assetId);
    if (!asset) {
      console.warn(`[map_pipeline_test] Placement "${placement.id}" references unknown asset "${placement.assetId}".`);
      return;
    }

    const image = this.images.get(placement.assetId);
    const x = Math.round(placement.x * this.mapData.tileSize);
    const y = Math.round(placement.y * this.mapData.tileSize);
    const width = Math.round(asset.widthPixels);
    const height = Math.round(asset.heightPixels);

    if (!image) {
      this.drawMissingAsset(ctx, placement.assetId, x, y, width, height);
      return;
    }

    ctx.drawImage(image, 0, 0, image.naturalWidth || image.width, image.naturalHeight || image.height, x, y, width, height);
  }

  drawMissingAsset(ctx, assetId, x, y, width, height) {
    ctx.save();
    ctx.fillStyle = "#ff00aa";
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, y, width, height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#7a004f";
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
    ctx.fillStyle = "#4a0030";
    ctx.font = "10px sans-serif";
    ctx.fillText(assetId, x + 3, y + 12);
    ctx.restore();
  }
}
