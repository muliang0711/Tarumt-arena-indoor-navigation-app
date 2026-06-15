import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeExportFileName, writeNodeSystemExportFiles, writeProjectExportFile } from "../../projectExport.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { force: true, recursive: true })));
});

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "village-map-export-"));
  tempRoots.push(root);
  return root;
}

describe("project export writer", () => {
  it("sanitizes export filenames to generated map json files", () => {
    expect(sanitizeExportFileName("../bad name!.txt")).toBe("bad_name_txt.json");
    expect(sanitizeExportFileName("village_demo_01.json")).toBe("village_demo_01.json");
    expect(sanitizeExportFileName("")).toBe("map.json");
  });

  it("writes and replaces the export file inside generated_map", async () => {
    const root = await createTempRoot();

    const first = await writeProjectExportFile("demo.json", "{\"version\":1}\n", root);
    const second = await writeProjectExportFile("../demo.json", "{\"version\":2}\n", root);

    expect(first.path).toBe(path.join(root, "generated_map", "demo.json"));
    expect(second.path).toBe(path.join(root, "generated_map", "demo.json"));
    await expect(fs.readFile(path.join(root, "generated_map", "demo.json"), "utf8")).resolves.toBe("{\"version\":2}\n");
    await expect(fs.readdir(root)).resolves.toEqual(["generated_map"]);
    await expect(fs.readdir(path.join(root, "generated_map"))).resolves.toEqual(["demo.json"]);
  });

  it("writes backend graph files inside node_system", async () => {
    const root = await createTempRoot();

    const result = await writeNodeSystemExportFiles(
      [
        { fileName: "nodes.json", content: "[{\"node_id\":\"a\"}]\n" },
        { fileName: "../edges.json", content: "[{\"edge_id\":\"a_b\"}]\n" },
      ],
      root,
    );

    expect(result).toEqual([
      { fileName: "nodes.json", path: path.join(root, "node_system", "nodes.json") },
      { fileName: "edges.json", path: path.join(root, "node_system", "edges.json") },
    ]);
    await expect(fs.readFile(path.join(root, "node_system", "nodes.json"), "utf8")).resolves.toBe("[{\"node_id\":\"a\"}]\n");
    await expect(fs.readFile(path.join(root, "node_system", "edges.json"), "utf8")).resolves.toBe("[{\"edge_id\":\"a_b\"}]\n");
    await expect(fs.readdir(root)).resolves.toEqual(["node_system"]);
  });
});
