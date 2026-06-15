import type { MapDocumentV2, NavigationLink, NavigationNode } from "./schema";

export interface BackendNode {
  node_id: string;
  floor_id: number;
  x: number;
  y: number;
  type: string;
  name: string;
  enabled: boolean;
}

export interface BackendEdge {
  edge_id: string;
  from_node: string;
  to_node: string;
  bidirectional: boolean;
  weight: number;
  distance_m: number;
  time_s: number;
  accessibility: string;
  enabled: boolean;
}

export interface NodeSystemGraph {
  nodes: BackendNode[];
  edges: BackendEdge[];
}

export interface NodeSystemJsonFile {
  fileName: string;
  content: string;
}

function createBackendNode(node: NavigationNode): BackendNode {
  return {
    node_id: node.id,
    floor_id: 1,
    x: node.x,
    y: node.y,
    type: node.type,
    name: node.label,
    enabled: true,
  };
}

function distanceBetweenNodes(link: NavigationLink, nodesById: Map<string, NavigationNode>): number {
  const from = nodesById.get(link.from);
  const to = nodesById.get(link.to);
  if (!from || !to) {
    return 0;
  }

  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Number(distance.toFixed(3));
}

function createBackendEdge(link: NavigationLink, nodesById: Map<string, NavigationNode>): BackendEdge {
  const distance = distanceBetweenNodes(link, nodesById);
  return {
    edge_id: link.id,
    from_node: link.from,
    to_node: link.to,
    bidirectional: link.bidirectional,
    weight: distance || 1,
    distance_m: distance,
    time_s: 0,
    accessibility: "standard",
    enabled: true,
  };
}

export function createNodeSystemExport(document: MapDocumentV2): NodeSystemGraph {
  const nodesById = new Map(document.navigation.nodes.map((node) => [node.id, node]));

  return {
    nodes: document.navigation.nodes.map(createBackendNode),
    edges: document.navigation.links.map((link) => createBackendEdge(link, nodesById)),
  };
}

export function nodeSystemGraphToJsonFiles(graph: NodeSystemGraph): NodeSystemJsonFile[] {
  return [
    { fileName: "nodes.json", content: `${JSON.stringify(graph.nodes, null, 2)}\n` },
    { fileName: "edges.json", content: `${JSON.stringify(graph.edges, null, 2)}\n` },
  ];
}
