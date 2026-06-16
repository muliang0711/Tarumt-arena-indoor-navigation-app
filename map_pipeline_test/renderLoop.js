export function startRenderLoop(canvas, viewport, composer, options = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  const { update, ...renderOptions } = options;
  let previousTimestamp = null;

  function frame(timestamp) {
    const deltaMs = previousTimestamp === null ? 0 : timestamp - previousTimestamp;
    previousTimestamp = timestamp;
    if (typeof update === "function") {
      update({ timestamp, deltaMs });
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    viewport.transform.apply(ctx);
    composer.render(ctx, renderOptions);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
