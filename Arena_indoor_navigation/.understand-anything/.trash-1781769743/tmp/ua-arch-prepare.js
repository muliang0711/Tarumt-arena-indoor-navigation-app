const fs = require("fs");

try {
  const [graphPath, outputPath] = process.argv.slice(2);
  if (!graphPath || !outputPath) {
    throw new Error("Usage: node ua-arch-prepare.js <assembled-graph.json> <input.json>");
  }

  const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
  const fileTypes = new Set([
    "file", "config", "document", "service", "pipeline",
    "table", "schema", "resource", "endpoint",
  ]);
  const fileNodes = graph.nodes
    .filter((node) => fileTypes.has(node.type))
    .map(({ id, type, name, filePath, summary, tags }) => ({
      id, type, name, filePath, summary, tags,
    }));
  const fileIds = new Set(fileNodes.map((node) => node.id));
  const allEdges = graph.edges.filter(
    (edge) => fileIds.has(edge.source) && fileIds.has(edge.target),
  );
  const importEdges = allEdges.filter((edge) => edge.type === "imports");

  fs.mkdirSync(require("path").dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ fileNodes, importEdges, allEdges }, null, 2) + "\n",
  );
  console.log(JSON.stringify({
    fileNodes: fileNodes.length,
    importEdges: importEdges.length,
    allEdges: allEdges.length,
  }));
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
