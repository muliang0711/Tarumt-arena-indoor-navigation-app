import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeExportFileName, writeProjectExportFile } from "../../projectExport.js";

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
  it("sanitizes export filenames to root-level json files", () => {
    expect(sanitizeExportFileName("../bad name!.txt")).toBe("bad_name_txt.json");
    expect(sanitizeExportFileName("village_demo_01.json")).toBe("village_demo_01.json");
    expect(sanitizeExportFileName("")).toBe("map.json");
  });

  it("writes and replaces the export file inside the project root", async () => {
    const root = await createTempRoot();

    const first = await writeProjectExportFile("demo.json", "{\"version\":1}\n", root);
    const second = await writeProjectExportFile("../demo.json", "{\"version\":2}\n", root);

    expect(first.path).toBe(path.join(root, "demo.json"));
    expect(second.path).toBe(path.join(root, "demo.json"));
    await expect(fs.readFile(path.join(root, "demo.json"), "utf8")).resolves.toBe("{\"version\":2}\n");
    await expect(fs.readdir(root)).resolves.toEqual(["demo.json"]);
  });
});
