const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const ua = path.join(root, ".understand-anything");
const intermediate = path.join(ua, "intermediate");
const scan = JSON.parse(
  fs.readFileSync(path.join(intermediate, "scan-result.json"), "utf8")
);

const fingerprintInput = {
  projectRoot: root,
  sourceFilePaths: scan.files.map((file) => file.path),
  gitCommitHash: "not-a-git-repository",
};

fs.writeFileSync(
  path.join(intermediate, "fingerprint-input.json"),
  JSON.stringify(fingerprintInput, null, 2) + "\n"
);
fs.copyFileSync(
  path.join(intermediate, "assembled-graph.json"),
  path.join(ua, "knowledge-graph.json")
);
