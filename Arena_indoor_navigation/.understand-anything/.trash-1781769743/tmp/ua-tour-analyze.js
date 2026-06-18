const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function edgeKind(edge) {
  return String(edge.type || edge.relationship || edge.kind || "").toLowerCase();
}

try {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    fail("Usage: node ua-tour-analyze.js <input.json> <output.json>");
  }

  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const nodes = input.nodes || [];
  const edges = input.edges || [];
  const layers = input.layers || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const fanIn = new Map(nodes.map((node) => [node.id, 0]));
  const fanOut = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (nodeById.has(edge.source) && nodeById.has(edge.target)) {
      fanOut.set(edge.source, fanOut.get(edge.source) + 1);
      fanIn.set(edge.target, fanIn.get(edge.target) + 1);
    }
  }

  const ranking = (counts, field) =>
    nodes
      .map((node) => ({ id: node.id, [field]: counts.get(node.id), name: node.name }))
      .sort((a, b) => b[field] - a[field] || a.id.localeCompare(b.id))
      .slice(0, 20);

  const fanInRanking = ranking(fanIn, "fanIn");
  const fanOutRanking = ranking(fanOut, "fanOut");
  const fanOutValues = [...fanOut.values()].sort((a, b) => a - b);
  const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
  const percentile = (values, fraction) =>
    values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))] : 0;
  const top10FanOutThreshold = percentile(fanOutValues, 0.9);
  const bottom25FanInThreshold = percentile(fanInValues, 0.25);
  const entryNames = new Set(
    [
      "index.ts", "index.js", "main.ts", "main.js", "app.ts", "app.js",
      "server.ts", "server.js", "mod.rs", "main.go", "main.py", "main.rs",
      "manage.py", "app.py", "wsgi.py", "asgi.py", "run.py", "__main__.py",
      "application.java", "main.java", "program.cs", "config.ru", "index.php",
      "app.swift", "application.kt", "main.cpp", "main.c",
    ].map((name) => name.toLowerCase()),
  );

  const entryPointCandidates = nodes
    .map((node) => {
      const filePath = String(node.filePath || node.path || node.name || "");
      const base = path.basename(filePath).toLowerCase();
      const segments = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
      let score = 0;
      if (node.type === "file") {
        if (entryNames.has(base)) score += 3;
        if (segments.length <= 2) score += 1;
        if (fanOut.get(node.id) >= top10FanOutThreshold && fanOut.get(node.id) > 0) score += 1;
        if (fanIn.get(node.id) <= bottom25FanInThreshold) score += 1;
      } else if (node.type === "document") {
        if (base === "readme.md" && segments.length === 1) score += 5;
        else if (base.endsWith(".md") && segments.length === 1) score += 2;
      }
      return { id: node.id, score, name: node.name, summary: node.summary || "" };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5);

  const topCodeEntry = entryPointCandidates.find(
    (candidate) => nodeById.get(candidate.id)?.type === "file",
  );
  const bfsTraversal = { startNode: topCodeEntry?.id || null, order: [], depthMap: {}, byDepth: {} };
  if (topCodeEntry) {
    const adjacency = new Map(nodes.map((node) => [node.id, []]));
    for (const edge of edges) {
      if (
        nodeById.has(edge.source) &&
        nodeById.has(edge.target) &&
        ["imports", "calls"].includes(edgeKind(edge))
      ) {
        adjacency.get(edge.source).push(edge.target);
      }
    }
    const queue = [topCodeEntry.id];
    bfsTraversal.depthMap[topCodeEntry.id] = 0;
    while (queue.length) {
      const current = queue.shift();
      const depth = bfsTraversal.depthMap[current];
      bfsTraversal.order.push(current);
      (bfsTraversal.byDepth[depth] ||= []).push(current);
      for (const next of adjacency.get(current) || []) {
        if (bfsTraversal.depthMap[next] === undefined) {
          bfsTraversal.depthMap[next] = depth + 1;
          queue.push(next);
        }
      }
    }
  }

  const summarize = (node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    summary: node.summary || "",
  });
  const nonCodeFiles = {
    documentation: nodes.filter((node) => node.type === "document").map(summarize),
    infrastructure: nodes
      .filter((node) => ["service", "pipeline", "resource"].includes(node.type))
      .map(summarize),
    data: nodes
      .filter((node) => ["table", "schema", "endpoint"].includes(node.type))
      .map(summarize),
    config: nodes.filter((node) => node.type === "config").map(summarize),
  };

  const relationSet = new Set(
    edges
      .filter(
        (edge) =>
          nodeById.has(edge.source) &&
          nodeById.has(edge.target) &&
          ["imports", "calls"].includes(edgeKind(edge)),
      )
      .map((edge) => `${edgeKind(edge)}\0${edge.source}\0${edge.target}`),
  );
  const seeds = [];
  for (const edge of edges) {
    const kind = edgeKind(edge);
    if (
      ["imports", "calls"].includes(kind) &&
      nodeById.has(edge.source) &&
      nodeById.has(edge.target) &&
      relationSet.has(`${kind}\0${edge.target}\0${edge.source}`)
    ) {
      const pair = [edge.source, edge.target].sort();
      if (!seeds.some((seed) => seed[0] === pair[0] && seed[1] === pair[1])) seeds.push(pair);
    }
  }
  const allConnections = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    if (nodeById.has(edge.source) && nodeById.has(edge.target)) {
      allConnections.get(edge.source).add(edge.target);
      allConnections.get(edge.target).add(edge.source);
    }
  }
  const clusters = seeds.map((seed) => {
    const cluster = new Set(seed);
    let changed = true;
    while (changed && cluster.size < 5) {
      changed = false;
      const candidate = nodes
        .filter((node) => !cluster.has(node.id))
        .map((node) => ({
          id: node.id,
          links: [...cluster].filter((member) => allConnections.get(node.id).has(member)).length,
        }))
        .filter((item) => item.links >= 2)
        .sort((a, b) => b.links - a.links || a.id.localeCompare(b.id))[0];
      if (candidate) {
        cluster.add(candidate.id);
        changed = true;
      }
    }
    const members = [...cluster];
    const edgeCount = edges.filter(
      (edge) => cluster.has(edge.source) && cluster.has(edge.target),
    ).length;
    return { nodes: members, edgeCount };
  })
    .sort((a, b) => b.edgeCount - a.edgeCount || b.nodes.length - a.nodes.length)
    .slice(0, 10);

  const nodeSummaryIndex = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      { name: node.name, type: node.type, summary: node.summary || "" },
    ]),
  );

  const output = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal,
    nonCodeFiles,
    clusters,
    layers: { count: layers.length, list: layers.map(({ id, name, description }) => ({ id, name, description })) },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Analyzed ${nodes.length} nodes and ${edges.length} edges.`);
} catch (error) {
  fail(error.stack || String(error));
}
