const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const ua = path.join(root, ".understand-anything");
const scan = JSON.parse(
  fs.readFileSync(path.join(ua, "intermediate", "scan-result.json"), "utf8")
);

const meta = {
  lastAnalyzedAt: new Date().toISOString(),
  gitCommitHash: "not-a-git-repository",
  version: "1.0.0",
  analyzedFiles: scan.totalFiles,
};

fs.writeFileSync(
  path.join(ua, "meta.json"),
  JSON.stringify(meta, null, 2) + "\n"
);
