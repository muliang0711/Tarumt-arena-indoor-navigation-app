import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleProjectExportRequest } from "./projectExport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4174);
const HOST = "0.0.0.0";
const DIST_DIR = path.join(__dirname, "dist");
const ASSET_DIR = path.resolve(__dirname, "../village_tileset_placeholders/serious_shit");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function assetEntries() {
  return fs
    .readdirSync(ASSET_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => ({
      relativePath: entry.name,
      url: `/assets/serious_shit/${entry.name}`,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function sendJson(response, value) {
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
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

function localNetworkUrls(port) {
  const urls = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);

  if (requestUrl.pathname === "/api/assets") {
    sendJson(response, assetEntries());
    return;
  }

  if (requestUrl.pathname === "/api/export") {
    handleProjectExportRequest(request, response);
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/serious_shit/")) {
    const fileName = decodeURIComponent(requestUrl.pathname.replace("/assets/serious_shit/", ""));
    const filePath = path.join(ASSET_DIR, fileName);
    if (filePath.startsWith(ASSET_DIR)) {
      sendFile(response, filePath);
      return;
    }
  }

  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.join(DIST_DIR, decodeURIComponent(requestedPath));
  if (filePath.startsWith(DIST_DIR)) {
    sendFile(response, fs.existsSync(filePath) ? filePath : path.join(DIST_DIR, "index.html"));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Village Map Editor Next running at http://localhost:${PORT}`);
  for (const url of localNetworkUrls(PORT)) {
    console.log(`Network access: ${url}`);
  }
});
