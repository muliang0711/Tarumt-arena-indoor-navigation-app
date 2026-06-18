const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const intermediate = path.join(root, ".understand-anything", "intermediate");
const graphPath = path.join(intermediate, "assembled-graph.json");
const layersPath = path.join(intermediate, "layers.json");
const tourPath = path.join(intermediate, "tour.json");

const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
let layers = JSON.parse(fs.readFileSync(layersPath, "utf8"));
let tour = JSON.parse(fs.readFileSync(tourPath, "utf8"));

if (!Array.isArray(layers)) layers = layers.layers || [];
if (!Array.isArray(tour)) tour = tour.steps || [];

const nodeIds = new Set(graph.nodes.map((node) => node.id));
const prefixes = /^(file|config|document|service|pipeline|table|schema|resource|endpoint):/;
const toNodeId = (value) => {
  if (typeof value !== "string") return value && value.id;
  return prefixes.test(value) ? value : `file:${value}`;
};
const kebab = (value) =>
  String(value || "unnamed")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

layers = layers
  .map((layer) => {
    const rawIds = layer.nodeIds || layer.nodes || [];
    const ids = rawIds.map(toNodeId).filter((id) => nodeIds.has(id));
    return {
      id: layer.id || `layer:${kebab(layer.name)}`,
      name: layer.name || "Unnamed Layer",
      description: layer.description || "No description available",
      nodeIds: [...new Set(ids)],
    };
  })
  .filter((layer) => layer.nodeIds.length > 0);

tour = tour
  .map((step, index) => {
    const rawIds = step.nodeIds || step.nodesToInspect || [];
    const normalized = {
      order: Number.isInteger(step.order) ? step.order : index + 1,
      title: step.title || `Step ${index + 1}`,
      description:
        step.description || step.whyItMatters || "No description available",
      nodeIds: [...new Set(rawIds.map(toNodeId).filter((id) => nodeIds.has(id)))],
    };
    if (typeof step.languageLesson === "string") {
      normalized.languageLesson = step.languageLesson;
    }
    return normalized;
  })
  .filter((step) => step.nodeIds.length > 0)
  .sort((a, b) => a.order - b.order)
  .map((step, index) => ({ ...step, order: index + 1 }));

const assembled = {
  version: "1.0.0",
  project: {
    name: "arena-indoor-navigation",
    languages: ["json", "markdown", "typescript", "unknown"],
    frameworks: ["React", "React Native", "Expo"],
    description:
      "An Expo and React Native indoor-navigation application with reusable screens, a tile-based map engine, camera and actor systems, movement constraints, and particle-filter/PDR positioning.",
    analyzedAt: new Date().toISOString(),
    gitCommitHash: "not-a-git-repository",
  },
  nodes: graph.nodes,
  edges: graph.edges,
  layers,
  tour,
};

fs.writeFileSync(graphPath, JSON.stringify(assembled, null, 2) + "\n");
console.log(
  JSON.stringify({
    nodes: assembled.nodes.length,
    edges: assembled.edges.length,
    layers: assembled.layers.length,
    tour: assembled.tour.length,
  })
);
