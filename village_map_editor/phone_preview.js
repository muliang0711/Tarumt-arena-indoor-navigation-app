const ASSET_INDEX_URL = "/assets/index.json";
const PHONE_REVIEW_SNAPSHOT_KEY = "village-phone-review-snapshot-v1";

const DEVICE_PRESETS = [
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667, dpr: 2 },
  { id: "iphone-13-mini", label: "iPhone 13 mini", width: 375, height: 812, dpr: 3 },
  { id: "iphone-15", label: "iPhone 15", width: 393, height: 852, dpr: 3 },
  { id: "iphone-15-plus", label: "iPhone 15 Plus", width: 430, height: 932, dpr: 3 },
  { id: "pixel-8", label: "Pixel 8", width: 412, height: 915, dpr: 2.625 },
  { id: "galaxy-s24", label: "Galaxy S24", width: 360, height: 780, dpr: 3 },
];

const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  assets: [],
  background: "transparent",
  deviceId: "iphone-15",
  navigationActive: false,
  mapSnapshot: null,
  overlayLabels: true,
  overlayNodes: true,
  renderedHeight: 0,
  renderedWidth: 0,
  reviewSource: "asset",
  routeEndId: "",
  routeStartId: "",
  scalePercent: 100,
  search: "",
  selectedAssetId: null,
  uploadedImage: null,
};

const ui = {
  assetGroups: document.querySelector("#asset-groups"),
  assetLibraryPanel: document.querySelector("#asset-library-panel"),
  assetMeta: document.querySelector("#asset-meta"),
  backgroundSelect: document.querySelector("#background-select"),
  clearRouteButton: document.querySelector("#clear-route-button"),
  coverageSummary: document.querySelector("#coverage-summary"),
  detailViewButton: document.querySelector("#detail-view-button"),
  deviceSelect: document.querySelector("#device-select"),
  deviceSummary: document.querySelector("#device-summary"),
  exitNavButton: document.querySelector("#exit-nav-button"),
  fitWidthButton: document.querySelector("#fit-width-button"),
  interactionStatus: document.querySelector("#interaction-status"),
  minimapImage: document.querySelector("#minimap-image"),
  minimapSurface: document.querySelector("#minimap-surface"),
  minimapViewport: document.querySelector("#minimap-viewport"),
  nativeSizeButton: document.querySelector("#native-size-button"),
  navDownButton: document.querySelector("#nav-down-button"),
  navLeftButton: document.querySelector("#nav-left-button"),
  navRightButton: document.querySelector("#nav-right-button"),
  navUpButton: document.querySelector("#nav-up-button"),
  navigatorPanel: document.querySelector("#navigator-panel"),
  overlayLabelsToggle: document.querySelector("#overlay-labels-toggle"),
  overlayNodesToggle: document.querySelector("#overlay-nodes-toggle"),
  overlayPanel: document.querySelector("#overlay-panel"),
  overlayStatus: document.querySelector("#overlay-status"),
  overlaySvg: document.querySelector("#overlay-svg"),
  navBottomBar: document.querySelector("#nav-bottom-bar"),
  navDestination: document.querySelector("#nav-destination"),
  navSubtitle: document.querySelector("#nav-subtitle"),
  navTitle: document.querySelector("#nav-title"),
  navTopCard: document.querySelector("#nav-top-card"),
  phoneScreen: document.querySelector("#phone-screen"),
  phoneStage: document.querySelector("#phone-stage"),
  previewImage: document.querySelector("#preview-image"),
  previewStack: document.querySelector("#preview-stack"),
  readableViewButton: document.querySelector("#readable-view-button"),
  routeEndSelect: document.querySelector("#route-end-select"),
  routeStartSelect: document.querySelector("#route-start-select"),
  scaleInput: document.querySelector("#scale-input"),
  scaleRange: document.querySelector("#scale-range"),
  searchInput: document.querySelector("#search-input"),
  sourceSelect: document.querySelector("#source-select"),
  sourceStatus: document.querySelector("#source-status"),
  stageTitle: document.querySelector("#stage-title"),
  uploadInput: document.querySelector("#upload-input"),
};

function getSelectedDevice() {
  return DEVICE_PRESETS.find((device) => device.id === state.deviceId) ?? DEVICE_PRESETS[0];
}

function getSelectedAsset() {
  return state.assets.find((asset) => asset.id === state.selectedAssetId) ?? null;
}

function getActiveReviewItem() {
  if (state.reviewSource === "map") {
    return state.mapSnapshot;
  }

  if (state.reviewSource === "upload") {
    return state.uploadedImage;
  }

  return getSelectedAsset();
}

function getMapNodes() {
  return Array.isArray(state.mapSnapshot?.nodes) ? state.mapSnapshot.nodes : [];
}

function getMapLinks() {
  return Array.isArray(state.mapSnapshot?.links) ? state.mapSnapshot.links : [];
}

function hasMapOverlayData() {
  return state.reviewSource === "map" && getMapNodes().length > 0;
}

function hasNavigator() {
  return state.reviewSource !== "asset" && Boolean(getActiveReviewItem());
}

function clampScale(value) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return 100;
  }
  return Math.min(Math.max(Math.round(nextValue), 10), 300);
}

function titleCase(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function nodeTypeLabel(type) {
  if (type === "stairs") {
    return "Stairs";
  }
  if (type === "elevator") {
    return "Elevator";
  }
  if (type === "junction") {
    return "Junction";
  }
  return "Destination";
}

function nodeOptionLabel(node) {
  return `${node.label || node.id} (${nodeTypeLabel(node.type)})`;
}

function getRouteDistance(route) {
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previousNode = getNodeById(route[index - 1]);
    const nextNode = getNodeById(route[index]);
    if (previousNode && nextNode) {
      total += Math.hypot(nextNode.x - previousNode.x, nextNode.y - previousNode.y);
    }
  }
  return total;
}

function getFirstDirection(route) {
  if (route.length < 2) {
    return "Follow the highlighted path.";
  }

  const startNode = getNodeById(route[0]);
  const nextNode = getNodeById(route[1]);
  if (!startNode || !nextNode) {
    return "Follow the highlighted path.";
  }

  const dx = nextNode.x - startNode.x;
  const dy = nextNode.y - startNode.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "Start by moving right." : "Start by moving left.";
  }

  return dy > 0 ? "Start by moving down." : "Start by moving up.";
}

function getNodeById(nodeId) {
  return getMapNodes().find((node) => node.id === nodeId) ?? null;
}

function getFitWidthPercent(asset, device) {
  if (!asset?.width) {
    return 100;
  }
  return (device.width / asset.width) * 100;
}

function setRecommendedMapScale() {
  if (!state.mapSnapshot) {
    return;
  }
  state.scalePercent = clampScale(getFitWidthPercent(state.mapSnapshot, getSelectedDevice()) * 1.8);
}

function syncControls() {
  ui.backgroundSelect.value = state.background;
  ui.deviceSelect.value = state.deviceId;
  ui.overlayLabelsToggle.checked = state.overlayLabels;
  ui.overlayNodesToggle.checked = state.overlayNodes;
  ui.routeEndSelect.value = state.routeEndId;
  ui.routeStartSelect.value = state.routeStartId;
  ui.scaleInput.value = String(state.scalePercent);
  ui.scaleRange.value = String(state.scalePercent);
  ui.searchInput.value = state.search;
  ui.sourceSelect.value = state.reviewSource;
}

function buildDeviceOptions() {
  ui.deviceSelect.innerHTML = "";
  for (const device of DEVICE_PRESETS) {
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = `${device.label} (${device.width}x${device.height})`;
    ui.deviceSelect.appendChild(option);
  }
}

function filteredAssets() {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return state.assets;
  }

  return state.assets.filter((asset) => {
    const haystack = `${asset.id} ${asset.label} ${asset.category}`.toLowerCase();
    return haystack.includes(query);
  });
}

function buildAssetLibrary() {
  const matchingAssets = filteredAssets();
  if (!matchingAssets.length) {
    ui.assetGroups.innerHTML = '<div class="empty-state">No PNG matched that search.</div>';
    return;
  }

  const grouped = new Map();
  for (const asset of matchingAssets) {
    if (!grouped.has(asset.category)) {
      grouped.set(asset.category, []);
    }
    grouped.get(asset.category).push(asset);
  }

  ui.assetGroups.innerHTML = "";

  for (const [category, assets] of grouped.entries()) {
    const section = document.createElement("section");
    section.className = "asset-group";

    const title = document.createElement("p");
    title.className = "asset-group-title";
    title.textContent = titleCase(category);
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "asset-grid";

    for (const asset of assets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "asset-button";
      button.classList.toggle("is-active", asset.id === state.selectedAssetId);

      const image = document.createElement("img");
      image.src = asset.src;
      image.alt = asset.label;
      image.width = Math.max(asset.width * 2, 32);
      image.height = Math.max(asset.height * 2, 32);

      const caption = document.createElement("span");
      caption.className = "asset-caption";
      caption.textContent = asset.label;

      button.append(image, caption);
      button.addEventListener("click", () => {
        state.selectedAssetId = asset.id;
        buildAssetLibrary();
        renderStage();
      });

      grid.appendChild(button);
    }

    section.appendChild(grid);
    ui.assetGroups.appendChild(section);
  }
}

function applyBackgroundClass() {
  ui.phoneStage.className = `phone-stage background-${state.background}`;
}

function updateSourceUi() {
  const usingTileset = state.reviewSource === "asset";
  ui.assetLibraryPanel.classList.toggle("is-hidden", !usingTileset);
  ui.navigatorPanel.classList.toggle("is-hidden", !hasNavigator());
  ui.overlayPanel.classList.toggle("is-hidden", !hasMapOverlayData());

  if (state.reviewSource === "map") {
    ui.sourceStatus.textContent = state.mapSnapshot
      ? "Using the latest map snapshot sent from the editor on this browser."
      : "No map snapshot is stored in this browser yet. Use 'Review map on phone' from the editor or upload a PNG instead.";
    return;
  }

  if (state.reviewSource === "upload") {
    ui.sourceStatus.textContent = state.uploadedImage
      ? `Using uploaded PNG: ${state.uploadedImage.fileName}`
      : "No uploaded PNG yet. Choose a file above.";
    return;
  }

  ui.sourceStatus.textContent = "Using PNGs from the tileset library.";
}

function fitPhoneFrameToStage(device) {
  const stageRect = ui.phoneStage.getBoundingClientRect();
  const availableWidth = Math.max(stageRect.width - 70, 240);
  const availableHeight = Math.max(stageRect.height - 70, 320);
  const scale = Math.min(availableWidth / device.width, availableHeight / device.height, 1);
  ui.phoneStage.style.setProperty("--phone-width", String(device.width));
  ui.phoneStage.style.setProperty("--phone-height", String(device.height));
  ui.phoneStage.style.setProperty("--phone-scale", scale.toFixed(4));
}

function updateDeviceSummary(device) {
  ui.deviceSummary.textContent =
    `Viewport: ${device.width} x ${device.height} CSS px\nDevice pixel ratio: ${device.dpr}\nPhysical render target: ${Math.round(device.width * device.dpr)} x ${Math.round(device.height * device.dpr)} px`;
}

function updateAssetMeta(asset, renderedWidth, renderedHeight, device) {
  if (!asset) {
    ui.assetMeta.textContent = "No image selected.";
    return;
  }

  const widthCoverage = ((renderedWidth / device.width) * 100).toFixed(1);
  const heightCoverage = ((renderedHeight / device.height) * 100).toFixed(1);
  const clippedWidth = renderedWidth > device.width ? "Yes" : "No";
  const clippedHeight = renderedHeight > device.height ? "Yes" : "No";

  ui.assetMeta.textContent =
    `File: ${asset.fileName}\nCategory: ${titleCase(asset.category ?? asset.kind ?? "custom")}\nSource size: ${asset.width} x ${asset.height} px\nShown size: ${Math.round(renderedWidth)} x ${Math.round(renderedHeight)} CSS px\nScreen coverage: ${widthCoverage}% width, ${heightCoverage}% height\nClips horizontally: ${clippedWidth}\nClips vertically: ${clippedHeight}`;
}

function updateMinimap() {
  if (!hasNavigator()) {
    return;
  }

  const asset = getActiveReviewItem();
  if (!asset || !state.renderedWidth || !state.renderedHeight) {
    return;
  }

  ui.minimapImage.src = asset.src;
  ui.minimapImage.alt = `${asset.label} minimap`;

  window.requestAnimationFrame(() => {
    const surfaceRect = ui.minimapSurface.getBoundingClientRect();
    const imageRect = ui.minimapImage.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height) {
      return;
    }

    const leftOffset = imageRect.left - surfaceRect.left;
    const topOffset = imageRect.top - surfaceRect.top;
    const viewportLeft = leftOffset + (ui.phoneScreen.scrollLeft / state.renderedWidth) * imageRect.width;
    const viewportTop = topOffset + (ui.phoneScreen.scrollTop / state.renderedHeight) * imageRect.height;
    const viewportWidth = (ui.phoneScreen.clientWidth / state.renderedWidth) * imageRect.width;
    const viewportHeight = (ui.phoneScreen.clientHeight / state.renderedHeight) * imageRect.height;

    ui.minimapViewport.style.left = `${viewportLeft}px`;
    ui.minimapViewport.style.top = `${viewportTop}px`;
    ui.minimapViewport.style.width = `${Math.max(viewportWidth, 18)}px`;
    ui.minimapViewport.style.height = `${Math.max(viewportHeight, 18)}px`;
  });
}

function scrollPreviewBy(deltaX, deltaY) {
  ui.phoneScreen.scrollBy({
    left: deltaX,
    top: deltaY,
    behavior: "smooth",
  });
}

function applyScaleMultiplier(multiplier) {
  const asset = getActiveReviewItem();
  const device = getSelectedDevice();
  if (!asset) {
    return;
  }

  setScale(getFitWidthPercent(asset, device) * multiplier);
  window.requestAnimationFrame(() => {
    ui.phoneScreen.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  });
}

function populateRouteSelectors() {
  const nodes = getMapNodes();

  for (const select of [ui.routeStartSelect, ui.routeEndSelect]) {
    select.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Not selected";
    select.appendChild(emptyOption);

    for (const node of nodes) {
      const option = document.createElement("option");
      option.value = node.id;
      option.textContent = nodeOptionLabel(node);
      select.appendChild(option);
    }
  }

  if (state.routeStartId && !nodes.some((node) => node.id === state.routeStartId)) {
    state.routeStartId = "";
  }
  if (state.routeEndId && !nodes.some((node) => node.id === state.routeEndId)) {
    state.routeEndId = "";
  }
}

function computeShortestRoute(startId, endId) {
  if (!startId || !endId || startId === endId) {
    return [];
  }

  const nodes = getMapNodes();
  const links = getMapLinks();
  if (!nodes.length || !links.length) {
    return [];
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));

  for (const link of links) {
    const fromNode = nodeMap.get(link.from);
    const toNode = nodeMap.get(link.to);
    if (!fromNode || !toNode) {
      continue;
    }

    const weight = Math.hypot(toNode.x - fromNode.x, toNode.y - fromNode.y);
    adjacency.get(link.from).push({ nodeId: link.to, weight });
    adjacency.get(link.to).push({ nodeId: link.from, weight });
  }

  const distances = new Map(nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map();
  const pending = new Set(nodeMap.keys());
  distances.set(startId, 0);

  while (pending.size) {
    let currentId = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const nodeId of pending) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < bestDistance) {
        bestDistance = distance;
        currentId = nodeId;
      }
    }

    if (!currentId || !Number.isFinite(bestDistance) || currentId === endId) {
      break;
    }

    pending.delete(currentId);

    for (const edge of adjacency.get(currentId) ?? []) {
      const nextDistance = bestDistance + edge.weight;
      if (nextDistance < (distances.get(edge.nodeId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.nodeId, nextDistance);
        previous.set(edge.nodeId, currentId);
      }
    }
  }

  if (!previous.has(endId)) {
    return [];
  }

  const route = [endId];
  let cursor = endId;

  while (cursor !== startId) {
    cursor = previous.get(cursor);
    if (!cursor) {
      return [];
    }
    route.unshift(cursor);
  }

  return route;
}

function nodeCenterInExportSpace(node) {
  const tileSize = state.mapSnapshot?.tileSize ?? 16;
  const exportScale = state.mapSnapshot?.exportScale ?? 1;
  const unit = tileSize * exportScale;
  return {
    x: (node.x + 0.5) * unit,
    y: (node.y + 0.5) * unit,
  };
}

function scaledPoint(point) {
  return {
    x: point.x * (state.scalePercent / 100),
    y: point.y * (state.scalePercent / 100),
  };
}

function focusRouteStart(startNode) {
  if (!startNode) {
    return;
  }

  const point = scaledPoint(nodeCenterInExportSpace(startNode));
  const targetLeft = point.x - ui.phoneScreen.clientWidth / 2;
  const targetTop = point.y - ui.phoneScreen.clientHeight * 0.68;

  ui.phoneScreen.scrollTo({
    left: Math.max(targetLeft, 0),
    top: Math.max(targetTop, 0),
    behavior: "smooth",
  });
}

function handleInteractiveNodeSelect(nodeId) {
  if (!state.routeStartId) {
    state.routeStartId = nodeId;
    state.routeEndId = "";
    state.navigationActive = false;
    renderStage();
    focusRouteStart(getNodeById(nodeId));
    return;
  }

  if (state.routeStartId === nodeId && state.routeEndId) {
    state.routeEndId = "";
    state.navigationActive = false;
    renderStage();
    focusRouteStart(getNodeById(nodeId));
    return;
  }

  if (state.routeStartId === nodeId) {
    renderStage();
    focusRouteStart(getNodeById(nodeId));
    return;
  }

  state.routeEndId = nodeId;
  state.navigationActive = true;
  if (state.scalePercent < clampScale(getFitWidthPercent(getActiveReviewItem(), getSelectedDevice()) * 1.8)) {
    state.scalePercent = clampScale(getFitWidthPercent(getActiveReviewItem(), getSelectedDevice()) * 1.8);
  }
  renderStage();
  focusRouteStart(getNodeById(state.routeStartId));
}

function updateNavigationChrome(route) {
  const active = state.navigationActive && route.length > 1;
  ui.previewStack.classList.toggle("nav-active", active);
  ui.navTopCard.classList.toggle("is-hidden", !active);
  ui.navBottomBar.classList.toggle("is-hidden", !active);

  if (!active) {
    return;
  }

  const startNode = getNodeById(route[0]);
  const endNode = getNodeById(route[route.length - 1]);
  const distance = getRouteDistance(route).toFixed(1);
  ui.navTitle.textContent = `Go to ${endNode?.label || state.routeEndId}`;
  ui.navSubtitle.textContent = `${getFirstDirection(route)} Route length ${distance} tiles.`;
  ui.navDestination.textContent = `${startNode?.label || state.routeStartId} -> ${endNode?.label || state.routeEndId}`;
}

function updateOverlayStatus(route) {
  if (!hasMapOverlayData()) {
    ui.overlayStatus.textContent = "No map metadata loaded.";
    ui.interactionStatus.textContent = "Map nodes are required for interactive navigation.";
    return;
  }

  const nodes = getMapNodes();
  const links = getMapLinks();
  const labels = nodes.filter((node) => node.type !== "junction").length;
  const routeText =
    route.length > 1
      ? `Highlighted route length: ${route.length} nodes`
      : state.routeStartId && state.routeEndId
        ? "No valid route was found between the selected nodes."
        : "Select a start and destination to highlight a route.";

  ui.overlayStatus.textContent =
    `Nodes: ${nodes.length}\nLinks: ${links.length}\nLabel-ready nodes: ${labels}\n${routeText}`;

  if (!state.routeStartId) {
    ui.interactionStatus.textContent = "Tap a node on the map to set current location.";
  } else if (!state.routeEndId) {
    const startNode = getNodeById(state.routeStartId);
    ui.interactionStatus.textContent = `Current location: ${startNode?.label || state.routeStartId}. Tap another node to start navigation.`;
  } else if (route.length > 1) {
    const endNode = getNodeById(state.routeEndId);
    ui.interactionStatus.textContent = `Navigation preview active to ${endNode?.label || state.routeEndId}. Tap another node to reroute.`;
  } else {
    ui.interactionStatus.textContent = "Those nodes are not connected. Pick a different destination.";
  }
}

function renderMapOverlay() {
  if (!hasMapOverlayData() || !state.renderedWidth || !state.renderedHeight) {
    ui.overlaySvg.innerHTML = "";
    ui.overlaySvg.removeAttribute("viewBox");
    updateOverlayStatus([]);
    updateNavigationChrome([]);
    return;
  }

  const route = computeShortestRoute(state.routeStartId, state.routeEndId);
  ui.overlaySvg.setAttribute("viewBox", `0 0 ${state.renderedWidth} ${state.renderedHeight}`);
  ui.overlaySvg.setAttribute("width", String(state.renderedWidth));
  ui.overlaySvg.setAttribute("height", String(state.renderedHeight));
  ui.overlaySvg.style.width = `${state.renderedWidth}px`;
  ui.overlaySvg.style.height = `${state.renderedHeight}px`;
  ui.overlaySvg.innerHTML = "";

  if (state.navigationActive && route.length > 1) {
    const scrim = document.createElementNS(SVG_NS, "rect");
    scrim.setAttribute("class", "overlay-scrim");
    scrim.setAttribute("x", "0");
    scrim.setAttribute("y", "0");
    scrim.setAttribute("width", String(state.renderedWidth));
    scrim.setAttribute("height", String(state.renderedHeight));
    ui.overlaySvg.appendChild(scrim);
  }

  if (route.length > 1) {
    const routePoints = route
      .map((nodeId) => getNodeById(nodeId))
      .filter(Boolean)
      .map((node) => scaledPoint(nodeCenterInExportSpace(node)))
      .map((point) => `${point.x},${point.y}`)
      .join(" ");

    const glow = document.createElementNS(SVG_NS, "polyline");
    glow.setAttribute("class", "overlay-route-glow");
    glow.setAttribute("stroke-width", "28");
    glow.setAttribute("points", routePoints);
    ui.overlaySvg.appendChild(glow);

    const line = document.createElementNS(SVG_NS, "polyline");
    line.setAttribute("class", "overlay-route");
    line.setAttribute("stroke-width", "12");
    line.setAttribute("points", routePoints);
    ui.overlaySvg.appendChild(line);
  }

  for (const node of getMapNodes()) {
    const point = scaledPoint(nodeCenterInExportSpace(node));

    if (state.overlayNodes) {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("class", "overlay-node");
      circle.setAttribute("data-type", node.type || "destination");
      if (node.id === state.routeStartId) {
        circle.setAttribute("data-role", "start");
      } else if (node.id === state.routeEndId) {
        circle.setAttribute("data-role", "end");
      }
      circle.setAttribute("cx", String(point.x));
      circle.setAttribute("cy", String(point.y));
      circle.setAttribute("r", route.includes(node.id) ? "13" : "10");
      ui.overlaySvg.appendChild(circle);
    }

    if (hasMapOverlayData()) {
      const hit = document.createElementNS(SVG_NS, "circle");
      hit.setAttribute("class", "overlay-hit");
      hit.setAttribute("cx", String(point.x));
      hit.setAttribute("cy", String(point.y));
      hit.setAttribute("r", "26");
      hit.addEventListener("click", () => handleInteractiveNodeSelect(node.id));
      ui.overlaySvg.appendChild(hit);
    }

    if (state.overlayLabels && node.type !== "junction" && node.label) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("class", "overlay-label");
      text.setAttribute("x", String(point.x + 16));
      text.setAttribute("y", String(point.y - 14));
      text.textContent = node.label;
      ui.overlaySvg.appendChild(text);
    }
  }

  updateOverlayStatus(route);
  updateNavigationChrome(route);
}

function renderStage() {
  const asset = getActiveReviewItem();
  const device = getSelectedDevice();
  fitPhoneFrameToStage(device);
  applyBackgroundClass();
  updateSourceUi();
  updateDeviceSummary(device);
  populateRouteSelectors();
  syncControls();

  if (!asset) {
    ui.previewImage.removeAttribute("src");
    ui.previewImage.alt = "";
    ui.previewStack.style.width = "";
    ui.previewStack.style.height = "";
    ui.previewStack.classList.remove("nav-active");
    ui.overlaySvg.innerHTML = "";
    ui.stageTitle.textContent = "No image selected";
    ui.coverageSummary.textContent =
      state.reviewSource === "map"
        ? "No map snapshot was found yet."
        : state.reviewSource === "upload"
          ? "Upload a PNG to preview it."
          : "Choose a PNG from the tileset list.";
    updateAssetMeta(null, 0, 0, device);
    updateOverlayStatus([]);
    updateNavigationChrome([]);
    return;
  }

  const renderedWidth = asset.width * (state.scalePercent / 100);
  const renderedHeight = asset.height * (state.scalePercent / 100);
  const widthCoverage = (renderedWidth / device.width) * 100;
  const heightCoverage = (renderedHeight / device.height) * 100;
  state.renderedWidth = renderedWidth;
  state.renderedHeight = renderedHeight;

  ui.previewImage.src = asset.src;
  ui.previewImage.alt = asset.label;
  ui.previewImage.style.width = `${renderedWidth}px`;
  ui.previewImage.style.height = `${renderedHeight}px`;
  ui.previewStack.style.width = `${renderedWidth}px`;
  ui.previewStack.style.height = `${renderedHeight}px`;

  ui.stageTitle.textContent = asset.label;
  ui.coverageSummary.textContent =
    `${Math.round(renderedWidth)} x ${Math.round(renderedHeight)} CSS px at ${state.scalePercent}%.\nThis uses ${widthCoverage.toFixed(1)}% of the phone width and ${heightCoverage.toFixed(1)}% of the phone height.\nUse overview for full layout, readable for normal inspection, and detail for tiny rooms or icons.`;

  updateAssetMeta(asset, renderedWidth, renderedHeight, device);
  renderMapOverlay();
  updateMinimap();
}

function setScale(value) {
  state.scalePercent = clampScale(value);
  renderStage();
}

async function loadAssets() {
  const response = await fetch(ASSET_INDEX_URL);
  if (!response.ok) {
    throw new Error("Unable to load tileset manifest.");
  }

  const manifest = await response.json();
  const assetPromises = manifest.map(
    (asset) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () =>
          resolve({
            ...asset,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        image.onerror = () => reject(new Error(`Unable to load ${asset.src}`));
        image.src = asset.src;
      }),
  );

  const results = await Promise.allSettled(assetPromises);
  state.assets = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (!state.assets.length) {
    throw new Error("No PNG assets were loaded from village_tileset_placeholders.");
  }

  state.selectedAssetId = state.assets[0].id;
}

function loadStoredMapSnapshot() {
  try {
    const raw = window.localStorage.getItem(PHONE_REVIEW_SNAPSHOT_KEY);
    if (!raw) {
      state.mapSnapshot = null;
      return;
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed?.src !== "string" || typeof parsed?.width !== "number" || typeof parsed?.height !== "number") {
      state.mapSnapshot = null;
      return;
    }

    state.mapSnapshot = {
      ...parsed,
      category: "map",
      kind: "map",
      label: parsed.label || "Current Map Snapshot",
    };
  } catch (error) {
    console.error(error);
    state.mapSnapshot = null;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function measureImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    image.onerror = () => reject(new Error("Unable to load uploaded PNG."));
    image.src = src;
  });
}

function bindEvents() {
  ui.sourceSelect.addEventListener("change", () => {
    state.reviewSource = ui.sourceSelect.value;
    state.navigationActive = false;
    if (state.reviewSource === "map") {
      loadStoredMapSnapshot();
      setRecommendedMapScale();
    }
    renderStage();
  });

  ui.deviceSelect.addEventListener("change", () => {
    state.deviceId = ui.deviceSelect.value;
    renderStage();
  });

  ui.scaleRange.addEventListener("input", () => setScale(ui.scaleRange.value));
  ui.scaleInput.addEventListener("input", () => setScale(ui.scaleInput.value));

  ui.searchInput.addEventListener("input", () => {
    state.search = ui.searchInput.value;
    buildAssetLibrary();
  });

  ui.backgroundSelect.addEventListener("change", () => {
    state.background = ui.backgroundSelect.value;
    renderStage();
  });

  ui.overlayNodesToggle.addEventListener("change", () => {
    state.overlayNodes = ui.overlayNodesToggle.checked;
    renderStage();
  });

  ui.overlayLabelsToggle.addEventListener("change", () => {
    state.overlayLabels = ui.overlayLabelsToggle.checked;
    renderStage();
  });

  ui.routeStartSelect.addEventListener("change", () => {
    state.routeStartId = ui.routeStartSelect.value;
    if (!state.routeStartId) {
      state.routeEndId = "";
      state.navigationActive = false;
    }
    renderStage();
  });

  ui.routeEndSelect.addEventListener("change", () => {
    state.routeEndId = ui.routeEndSelect.value;
    state.navigationActive = Boolean(state.routeStartId && state.routeEndId);
    renderStage();
  });

  ui.clearRouteButton.addEventListener("click", () => {
    state.routeStartId = "";
    state.routeEndId = "";
    state.navigationActive = false;
    renderStage();
  });

  ui.exitNavButton.addEventListener("click", () => {
    state.routeEndId = "";
    state.navigationActive = false;
    renderStage();
  });

  ui.nativeSizeButton.addEventListener("click", () => setScale(100));
  ui.fitWidthButton.addEventListener("click", () => applyScaleMultiplier(1));
  ui.readableViewButton.addEventListener("click", () => applyScaleMultiplier(1.8));
  ui.detailViewButton.addEventListener("click", () => applyScaleMultiplier(2.6));

  ui.uploadInput.addEventListener("change", async () => {
    const [file] = ui.uploadInput.files || [];
    if (!file) {
      return;
    }

    try {
      const src = await readFileAsDataUrl(file);
      const dimensions = await measureImage(src);
      state.uploadedImage = {
        category: "upload",
        fileName: file.name,
        kind: "upload",
        label: file.name,
        src,
        ...dimensions,
      };
      state.reviewSource = "upload";
      renderStage();
    } catch (error) {
      console.error(error);
      ui.sourceStatus.textContent = error instanceof Error ? error.message : "Unable to load uploaded PNG.";
    } finally {
      ui.uploadInput.value = "";
    }
  });

  ui.navUpButton.addEventListener("click", () => scrollPreviewBy(0, -ui.phoneScreen.clientHeight * 0.78));
  ui.navDownButton.addEventListener("click", () => scrollPreviewBy(0, ui.phoneScreen.clientHeight * 0.78));
  ui.navLeftButton.addEventListener("click", () => scrollPreviewBy(-ui.phoneScreen.clientWidth * 0.78, 0));
  ui.navRightButton.addEventListener("click", () => scrollPreviewBy(ui.phoneScreen.clientWidth * 0.78, 0));

  ui.phoneScreen.addEventListener("scroll", () => updateMinimap());
  ui.minimapSurface.addEventListener("click", (event) => {
    if (!hasNavigator() || !state.renderedWidth || !state.renderedHeight) {
      return;
    }

    const imageRect = ui.minimapImage.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height) {
      return;
    }

    const ratioX = Math.min(Math.max((event.clientX - imageRect.left) / imageRect.width, 0), 1);
    const ratioY = Math.min(Math.max((event.clientY - imageRect.top) / imageRect.height, 0), 1);
    ui.phoneScreen.scrollTo({
      left: ratioX * state.renderedWidth - ui.phoneScreen.clientWidth / 2,
      top: ratioY * state.renderedHeight - ui.phoneScreen.clientHeight / 2,
      behavior: "smooth",
    });
  });

  window.addEventListener("resize", () => renderStage());
}

async function init() {
  try {
    const query = new URLSearchParams(window.location.search);
    if (query.get("source") === "map") {
      state.reviewSource = "map";
    }

    buildDeviceOptions();
    loadStoredMapSnapshot();
    bindEvents();
    await loadAssets();

    if (state.reviewSource === "map" && state.mapSnapshot) {
      setRecommendedMapScale();
    }

    buildAssetLibrary();
    renderStage();
  } catch (error) {
    console.error(error);
    ui.assetGroups.innerHTML = `<div class="empty-state">${error instanceof Error ? error.message : "Unable to load phone reviewer."}</div>`;
    ui.assetMeta.textContent = error instanceof Error ? error.message : "Unable to load phone reviewer.";
    ui.stageTitle.textContent = "Load failed";
    ui.coverageSummary.textContent = "The PNG reviewer could not load the tileset folder.";
  }
}

init();
