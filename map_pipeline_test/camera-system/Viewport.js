import { Transform } from "./Transform.js";

export class Viewport {
  constructor(canvas, worldSize, focusBounds = null) {
    this.canvas = canvas;
    this.worldSize = worldSize;
    this.focusBounds = focusBounds || { x: 0, y: 0, width: worldSize.width, height: worldSize.height };
    this.transform = new Transform();
    this.minScale = 0.2;
    this.maxScale = 6;
    this.drag = null;
    this.resize();
    this.attachInput();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.fit();
  }

  fit() {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const margin = 48;
    const fitWidth = Math.max(1, this.focusBounds.width + margin * 2);
    const fitHeight = Math.max(1, this.focusBounds.height + margin * 2);
    const scale = Math.min(canvasWidth / fitWidth, canvasHeight / fitHeight);
    this.transform.scale = Math.max(this.minScale, scale);
    this.transform.offsetX = Math.round((canvasWidth - this.focusBounds.width * this.transform.scale) / 2 - this.focusBounds.x * this.transform.scale);
    this.transform.offsetY = Math.round((canvasHeight - this.focusBounds.height * this.transform.scale) / 2 - this.focusBounds.y * this.transform.scale);
  }

  attachInput() {
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const screen = {
        x: (event.clientX - rect.left) * dpr,
        y: (event.clientY - rect.top) * dpr,
      };
      const before = this.transform.screenToWorld(screen);
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      this.transform.scale = clamp(this.transform.scale * factor, this.minScale, this.maxScale);
      const after = this.transform.worldToScreen(before);
      this.transform.offsetX += screen.x - after.x;
      this.transform.offsetY += screen.y - after.y;
    }, { passive: false });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      this.drag = { x: event.clientX, y: event.clientY };
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.drag) {
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      this.transform.offsetX += (event.clientX - this.drag.x) * dpr;
      this.transform.offsetY += (event.clientY - this.drag.y) * dpr;
      this.drag = { x: event.clientX, y: event.clientY };
    });

    this.canvas.addEventListener("pointerup", () => {
      this.drag = null;
    });
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
