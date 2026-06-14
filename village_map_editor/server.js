const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = 4173;
const HOST = "0.0.0.0";
const ROOT = path.resolve(__dirname, "..");
const EDITOR_DIR = __dirname;
const ASSET_DIR = path.join(ROOT, "village_tileset_placeholders");
const GENERATED_DIR = path.join(ROOT, "generated_maps");
const PACKAGE_DIR = path.join(GENERATED_DIR, "map_packages");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function createAssetManifest() {
  const entries = walkAssetFiles(ASSET_DIR)
    .filter((relativePath) => relativePath.replace(/\\/g, "/").startsWith("serious_shit/"))
    .map((relativePath) => {
      const fileName = path.basename(relativePath);
      const baseName = path.basename(fileName, ".png");
      const normalized = baseName.replace(/^\d+_/, "");
      const categoryPath = path.dirname(relativePath);
      const id = relativePath.replace(/\\/g, "/").replace(/\.png$/i, "").replace(/\//g, "__");
      const orderMatch = baseName.match(/^(\d+)_/);
      return {
        id,
        category:
          categoryPath && categoryPath !== "."
            ? categoryPath.replace(/\\/g, "/")
            : normalized.split("_")[0] || "misc",
        fileName,
        relativePath: relativePath.replace(/\\/g, "/"),
        label: normalized
          .split(/[_\s-]+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        order: orderMatch ? Number(orderMatch[1]) : Number.MAX_SAFE_INTEGER,
        src: `/assets/${relativePath.replace(/\\/g, "/")}`,
      };
    })
    .sort((left, right) => {
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category);
      }
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.id.localeCompare(right.id);
    });

  return JSON.stringify(entries);
}

function walkAssetFiles(directory, relativePrefix = "") {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return walkAssetFiles(absolutePath, relativePath);
      }

      if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".png") {
        return [relativePath];
      }

      return [];
    });
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function slugifyMapId(value) {
  return String(value || "map_package")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "map_package";
}

function copyDirectory(sourceDir, targetDir) {
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid preview image payload.");
  }
  return Buffer.from(match[2], "base64");
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function handleExportPackage(request, response) {
  try {
    const payload = await readJsonBody(request);
    const mapId = slugifyMapId(payload.mapId);
    const packageRoot = path.join(PACKAGE_DIR, mapId);
    const resourcesTarget = path.join(packageRoot, "resources", "serious_shit");
    const sourceResources = path.join(ASSET_DIR, "serious_shit");

    fs.rmSync(packageRoot, { recursive: true, force: true });
    ensureDir(packageRoot);
    ensureDir(PACKAGE_DIR);

    fs.writeFileSync(path.join(packageRoot, "map.json"), `${JSON.stringify(payload.project, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(packageRoot, "preview.png"), dataUrlToBuffer(payload.previewDataUrl));
    copyDirectory(sourceResources, resourcesTarget);

    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        ok: true,
        packageDir: packageRoot,
      }),
    );
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to export package.",
      }),
    );
  }
}

function resolveRequestPath(urlPath) {
  if (urlPath === "/" || urlPath === "/index.html") {
    return path.join(EDITOR_DIR, "index.html");
  }

  if (urlPath.startsWith("/assets/")) {
    return path.join(ASSET_DIR, decodeURIComponent(urlPath.replace("/assets/", "")));
  }

  if (urlPath.startsWith("/generated_maps/")) {
    return path.join(GENERATED_DIR, decodeURIComponent(urlPath.replace("/generated_maps/", "")));
  }

  return path.join(EDITOR_DIR, decodeURIComponent(urlPath.slice(1)));
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "POST" && requestUrl.pathname === "/api/export-package") {
    handleExportPackage(request, response);
    return;
  }
  if (requestUrl.pathname === "/assets/index.json") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(createAssetManifest());
    return;
  }

  sendFile(response, resolveRequestPath(requestUrl.pathname));
});

function localNetworkUrls(port) {
  const urls = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls;
}

server.listen(PORT, HOST, () => {
  console.log(`Village Map Editor running at http://localhost:${PORT}`);
  for (const url of localNetworkUrls(PORT)) {
    console.log(`Phone access: ${url}`);
  }
});
