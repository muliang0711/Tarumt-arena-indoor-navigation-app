const fs = require("fs");

function fail(message) {
  console.error(message);
  process.exit(1);
}

try {
  const [graphPath, layersPath, outputPath] = process.argv.slice(2);
  if (!graphPath || !layersPath || !outputPath) {
    fail("Usage: node ua-tour-prepare.js <graph.json> <layers.json> <output.json>");
  }

  const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
  const rawLayers = JSON.parse(fs.readFileSync(layersPath, "utf8"));
  const allowedTypes = new Set([
    "file",
    "config",
    "document",
    "service",
    "pipeline",
    "table",
    "schema",
    "resource",
    "endpoint",
  ]);

  const input = {
    nodes: (graph.nodes || []).filter((node) => allowedTypes.has(node.type)),
    edges: graph.edges || [],
    layers: (Array.isArray(rawLayers) ? rawLayers : rawLayers.layers || []).map(
      ({ id, name, description }) => ({ id, name, description }),
    ),
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(
    `Prepared ${input.nodes.length} nodes, ${input.edges.length} edges, and ${input.layers.length} layers.`,
  );
} catch (error) {
  fail(error.stack || String(error));
}
