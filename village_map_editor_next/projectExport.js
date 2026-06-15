import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");
export const GENERATED_MAP_DIR = "generated_map";
export const NODE_SYSTEM_DIR = "node_system";
const MAX_EXPORT_BYTES = 25 * 1024 * 1024;

export function sanitizeExportFileName(fileName) {
  const baseName = path.basename(String(fileName || "map.json"));
  const withoutExtension = baseName.replace(/\.json$/i, "");
  const cleanName = withoutExtension.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "map";
  return `${cleanName}.json`;
}

export async function writeProjectExportFile(fileName, content, root = PROJECT_ROOT) {
  if (typeof content !== "string") {
    throw new Error("Export content must be a string.");
  }

  const safeFileName = sanitizeExportFileName(fileName);
  const resolvedRoot = path.resolve(root);
  const outputDir = path.resolve(resolvedRoot, GENERATED_MAP_DIR);
  const outputPath = path.resolve(outputDir, safeFileName);
  if (path.dirname(outputPath) !== outputDir) {
    throw new Error("Export path must stay inside generated_map.");
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, content, "utf8");
  return { fileName: safeFileName, path: outputPath };
}

export async function writeNodeSystemExportFiles(files, root = PROJECT_ROOT) {
  if (!Array.isArray(files)) {
    throw new Error("Node system files must be an array.");
  }

  const resolvedRoot = path.resolve(root);
  const outputDir = path.resolve(resolvedRoot, NODE_SYSTEM_DIR);
  await fs.mkdir(outputDir, { recursive: true });

  const results = [];
  for (const file of files) {
    if (typeof file?.content !== "string") {
      throw new Error("Node system file content must be a string.");
    }

    const safeFileName = sanitizeExportFileName(file.fileName);
    const outputPath = path.resolve(outputDir, safeFileName);
    if (path.dirname(outputPath) !== outputDir) {
      throw new Error("Export path must stay inside node_system.");
    }

    await fs.writeFile(outputPath, file.content, "utf8");
    results.push({ fileName: safeFileName, path: outputPath });
  }

  return results;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_EXPORT_BYTES) {
        reject(new Error("Export payload is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

export async function handleProjectExportRequest(request, response, root = PROJECT_ROOT) {
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const body = await readRequestBody(request);
    const payload = JSON.parse(body);
    const result = await writeProjectExportFile(payload.fileName, payload.content, root);
    const nodeSystemFiles = payload.nodeSystemFiles ? await writeNodeSystemExportFiles(payload.nodeSystemFiles, root) : [];
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, ...result, nodeSystemFiles }));
  } catch (error) {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to export map." }));
  }
}
