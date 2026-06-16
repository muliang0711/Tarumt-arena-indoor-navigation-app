export class Transform {
  constructor({ scale = 1, offsetX = 0, offsetY = 0 } = {}) {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  apply(ctx) {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  worldToScreen(point) {
    return {
      x: point.x * this.scale + this.offsetX,
      y: point.y * this.scale + this.offsetY,
    };
  }

  screenToWorld(point) {
    return {
      x: (point.x - this.offsetX) / this.scale,
      y: (point.y - this.offsetY) / this.scale,
    };
  }
}
