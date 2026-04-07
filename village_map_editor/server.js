const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 4173;
const ROOT = path.resolve(__dirname, "..");
const EDITOR_DIR = __dirname;
const ASSET_DIR = path.join(ROOT, "village_tileset_placeholders");
const GENERATED_DIR = path.join(ROOT, "generated_maps");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function createAssetManifest() {
  const entries = fs
    .readdirSync(ASSET_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".png")
    .map((entry) => {
      const fileName = entry.name;
      const id = path.basename(fileName, ".png");
      const normalized = id.replace(/^\d+_/, "");
      const [category = "misc"] = normalized.split("_");
      const label = normalized
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      const orderMatch = id.match(/^(\d+)_/);
      return {
        id,
        category,
        fileName,
        label,
        order: orderMatch ? Number(orderMatch[1]) : Number.MAX_SAFE_INTEGER,
        src: `/assets/${fileName}`,
      };
    })
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return left.id.localeCompare(right.id);
    });

  return JSON.stringify(entries);
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
  if (requestUrl.pathname === "/assets/index.json") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(createAssetManifest());
    return;
  }

  sendFile(response, resolveRequestPath(requestUrl.pathname));
});

server.listen(PORT, () => {
  console.log(`Village Map Editor running at http://localhost:${PORT}`);
});
