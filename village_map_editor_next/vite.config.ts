import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { handleProjectExportRequest } from "./projectExport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.resolve(__dirname, "../village_tileset_placeholders/serious_shit");

function assetEntries() {
  return fs
    .readdirSync(assetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => ({
      relativePath: entry.name,
      url: `/assets/serious_shit/${entry.name}`,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "village-asset-server",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const requestUrl = new URL(request.url ?? "/", "http://localhost");
          if (requestUrl.pathname === "/api/assets") {
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(assetEntries()));
            return;
          }

          if (requestUrl.pathname === "/api/export") {
            void handleProjectExportRequest(request, response);
            return;
          }

          if (requestUrl.pathname.startsWith("/assets/serious_shit/")) {
            const fileName = decodeURIComponent(requestUrl.pathname.replace("/assets/serious_shit/", ""));
            const filePath = path.join(assetDir, fileName);
            if (filePath.startsWith(assetDir) && fs.existsSync(filePath)) {
              response.setHeader("Content-Type", "image/png");
              fs.createReadStream(filePath).pipe(response);
              return;
            }
          }

          next();
        });
      },
    },
  ],
  test: {
    environment: "node",
    globals: false,
  },
});
