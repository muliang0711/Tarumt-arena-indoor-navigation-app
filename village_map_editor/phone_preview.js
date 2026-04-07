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

const state = {
  assets: [],
  deviceId: "iphone-15",
  mapSnapshot: null,
  reviewSource: "asset",
  selectedAssetId: null,
  scalePercent: 100,
  search: "",
  background: "transparent",
  uploadedImage: null,
};

const ui = {
  assetLibraryPanel: document.querySelector("#asset-library-panel"),
  assetGroups: document.querySelector("#asset-groups"),
  assetMeta: document.querySelector("#asset-meta"),
  backgroundSelect: document.querySelector("#background-select"),
  coverageSummary: document.querySelector("#coverage-summary"),
  deviceSelect: document.querySelector("#device-select"),
  deviceSummary: document.querySelector("#device-summary"),
  fitWidthButton: document.querySelector("#fit-width-button"),
  nativeSizeButton: document.querySelector("#native-size-button"),
  phoneScreen: document.querySelector("#phone-screen"),
  phoneStage: document.querySelector("#phone-stage"),
  previewImage: document.querySelector("#preview-image"),
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

function syncControls() {
  ui.deviceSelect.value = state.deviceId;
  ui.scaleRange.value = String(state.scalePercent);
  ui.scaleInput.value = String(state.scalePercent);
  ui.searchInput.value = state.search;
  ui.backgroundSelect.value = state.background;
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

function renderStage() {
  const asset = getActiveReviewItem();
  const device = getSelectedDevice();
  fitPhoneFrameToStage(device);
  applyBackgroundClass();
  updateSourceUi();
  updateDeviceSummary(device);

  if (!asset) {
    ui.previewImage.removeAttribute("src");
    ui.previewImage.alt = "";
    ui.stageTitle.textContent = "No image selected";
    ui.coverageSummary.textContent =
      state.reviewSource === "map"
        ? "No map snapshot was found yet."
        : state.reviewSource === "upload"
          ? "Upload a PNG to preview it."
          : "Choose a PNG from the tileset list.";
    updateAssetMeta(null, 0, 0, device);
    return;
  }

  const renderedWidth = asset.width * (state.scalePercent / 100);
  const renderedHeight = asset.height * (state.scalePercent / 100);
  const widthCoverage = (renderedWidth / device.width) * 100;
  const heightCoverage = (renderedHeight / device.height) * 100;

  ui.previewImage.src = asset.src;
  ui.previewImage.alt = asset.label;
  ui.previewImage.style.width = `${renderedWidth}px`;
  ui.previewImage.style.height = `${renderedHeight}px`;

  ui.stageTitle.textContent = asset.label;
  ui.coverageSummary.textContent =
    `${Math.round(renderedWidth)} x ${Math.round(renderedHeight)} CSS px at ${state.scalePercent}%.\nThis uses ${widthCoverage.toFixed(1)}% of the phone width and ${heightCoverage.toFixed(1)}% of the phone height.`;

  updateAssetMeta(asset, renderedWidth, renderedHeight, device);
}

function setScale(value) {
  state.scalePercent = clampScale(value);
  syncControls();
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
    if (state.reviewSource === "map") {
      loadStoredMapSnapshot();
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

  ui.nativeSizeButton.addEventListener("click", () => setScale(100));

  ui.fitWidthButton.addEventListener("click", () => {
    const asset = getActiveReviewItem();
    const device = getSelectedDevice();
    if (!asset) {
      return;
    }

    const percent = (device.width / asset.width) * 100;
    setScale(percent);
  });

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
      syncControls();
      renderStage();
    } catch (error) {
      console.error(error);
      ui.sourceStatus.textContent = error instanceof Error ? error.message : "Unable to load uploaded PNG.";
    } finally {
      ui.uploadInput.value = "";
    }
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
    syncControls();
    bindEvents();
    await loadAssets();
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
