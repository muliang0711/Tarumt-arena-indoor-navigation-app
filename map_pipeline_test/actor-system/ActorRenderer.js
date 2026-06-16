import { routeNodeToPixels } from "./CoordTransform.js";

export class ActorRenderer {
  constructor(mapData) {
    this.mapData = mapData;
  }

  render(ctx, actors = [], options = {}) {
    if (!options.visible) {
      return;
    }

    ctx.save();
    for (const actor of actors) {
      const point = routeNodeToPixels(actor, this.mapData.movement.coordinateSystem.pixelsPerMeter);
      if (actor.sprite?.image) {
        this.drawSprite(ctx, actor, point);
      } else {
        this.drawFallbackMarker(ctx, actor, point);
      }
    }
    ctx.restore();
  }

  drawSprite(ctx, actor, point) {
    const sprite = actor.sprite;
    const width = sprite.width || sprite.image.naturalWidth || sprite.image.width;
    const height = sprite.height || sprite.image.naturalHeight || sprite.image.height;
    const anchorX = sprite.anchorX ?? 0.5;
    const anchorY = sprite.anchorY ?? 1;
    const x = Math.round(point.x - width * anchorX);
    const y = Math.round(point.y - height * anchorY);
    ctx.drawImage(sprite.image, x, y, width, height);
  }

  drawFallbackMarker(ctx, actor, point) {
    ctx.fillStyle = actor.color || "#0f766e";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
