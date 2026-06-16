export class CameraController {
  constructor(viewport, options = {}) {
    this.viewport = viewport;
    this.zoomFactor = options.zoomFactor || 1.2;
    this.panSpeedPixelsPerSecond = options.panSpeedPixelsPerSecond || 420;
    this.followSmoothing = options.followSmoothing ?? 0.18;
    this.followTarget = null;
    this.followEnabled = false;
    this.keys = new Set();
  }

  follow(target) {
    this.followTarget = target;
    this.followEnabled = true;
  }

  setFollowEnabled(enabled) {
    this.followEnabled = Boolean(enabled);
  }

  toggleFollow() {
    this.followEnabled = !this.followEnabled;
    return this.followEnabled;
  }

  update(deltaMs) {
    this.updateKeyboardPan(deltaMs);
    if (!this.followEnabled || !this.followTarget) {
      return;
    }

    const target = typeof this.followTarget === "function" ? this.followTarget() : this.followTarget;
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
      return;
    }
    this.centerOnWorldPoint(target);
  }

  centerOnWorldPoint(point) {
    const targetOffset = this.getCenteredOffset(point);
    const smoothing = clamp(this.followSmoothing, 0, 1);
    this.viewport.transform.offsetX = Math.round(lerp(this.viewport.transform.offsetX, targetOffset.x, smoothing));
    this.viewport.transform.offsetY = Math.round(lerp(this.viewport.transform.offsetY, targetOffset.y, smoothing));
  }

  zoomIn(screenPoint = this.getScreenCenter()) {
    this.zoomBy(this.zoomFactor, screenPoint);
  }

  zoomOut(screenPoint = this.getScreenCenter()) {
    this.zoomBy(1 / this.zoomFactor, screenPoint);
  }

  zoomBy(factor, screenPoint = this.getScreenCenter()) {
    const before = this.viewport.transform.screenToWorld(screenPoint);
    this.viewport.transform.scale = clamp(
      this.viewport.transform.scale * factor,
      this.viewport.minScale,
      this.viewport.maxScale,
    );
    const after = this.viewport.transform.worldToScreen(before);
    this.viewport.transform.offsetX = Math.round(this.viewport.transform.offsetX + screenPoint.x - after.x);
    this.viewport.transform.offsetY = Math.round(this.viewport.transform.offsetY + screenPoint.y - after.y);
  }

  panByDirection(direction, deltaMs) {
    const seconds = Math.max(0, Number(deltaMs) || 0) / 1000;
    const distance = this.panSpeedPixelsPerSecond * seconds;
    this.panByScreenPixels({
      x: -direction.x * distance,
      y: -direction.y * distance,
    });
  }

  panByScreenPixels(delta) {
    if (!delta.x && !delta.y) {
      return;
    }
    this.followEnabled = false;
    this.viewport.transform.offsetX = Math.round(this.viewport.transform.offsetX + delta.x);
    this.viewport.transform.offsetY = Math.round(this.viewport.transform.offsetY + delta.y);
  }

  attachKeyboard(target = window) {
    target.addEventListener("keydown", (event) => {
      if (isCameraKey(event.key)) {
        event.preventDefault();
        this.keys.add(event.key.toLowerCase());
      }
      if (event.key.toLowerCase() === "f") {
        this.toggleFollow();
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        this.zoomIn();
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        this.zoomOut();
      }
    });

    target.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
  }

  updateKeyboardPan(deltaMs) {
    const direction = { x: 0, y: 0 };
    if (this.keys.has("arrowleft") || this.keys.has("a")) {
      direction.x -= 1;
    }
    if (this.keys.has("arrowright") || this.keys.has("d")) {
      direction.x += 1;
    }
    if (this.keys.has("arrowup") || this.keys.has("w")) {
      direction.y -= 1;
    }
    if (this.keys.has("arrowdown") || this.keys.has("s")) {
      direction.y += 1;
    }
    if (direction.x || direction.y) {
      this.panByDirection(normalizeDirection(direction), deltaMs);
    }
  }

  getCenteredOffset(point) {
    const center = this.getScreenCenter();
    return {
      x: center.x - point.x * this.viewport.transform.scale,
      y: center.y - point.y * this.viewport.transform.scale,
    };
  }

  getScreenCenter() {
    return {
      x: this.viewport.canvas.width / 2,
      y: this.viewport.canvas.height / 2,
    };
  }
}

function isCameraKey(key) {
  return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "A", "d", "D", "w", "W", "s", "S"].includes(key);
}

function normalizeDirection(direction) {
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: direction.x / length,
    y: direction.y / length,
  };
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
