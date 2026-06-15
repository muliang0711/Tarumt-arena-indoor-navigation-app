import type { EditorState } from "../app/editorState";
import type {
  MapDocument,
  MapDocumentV3,
  MovementRouteEdge,
  MovementRouteNode,
  MapDisplay,
  MovementSection,
} from "./schema";
import { validateMapDocument } from "./validation";

export interface ExportResult {
  document: MapDocumentV3;
  errors: string[];
}

const DEFAULT_TILES_PER_METER = 2.5;

function buildDisplay(document: MapDocument): MapDisplay {
  return {
    assets: structuredClone(document.assets.items),
    visualLayers: structuredClone(document.layers.visual),
    labels: document.navigation.nodes.map((node) => ({
      id: `label_${node.id}`,
      text: node.label,
      position: { x: node.x, y: node.y },
      sourceId: node.id,
    })),
    icons: document.navigation.nodes.map((node) => ({
      id: `icon_${node.id}`,
      iconId: node.type,
      position: { x: node.x, y: node.y },
      sourceId: node.id,
    })),
    layerOrder: ["assets", "visualLayers", "labels", "icons"],
  };
}

function tileToMeter(value: number, tilesPerMeter: number): number {
  return Number((value / tilesPerMeter).toFixed(3));
}

function createRouteGraphNodes(document: MapDocument, tilesPerMeter: number): MovementRouteNode[] {
  return document.navigation.nodes.map((node) => ({
    node_id: node.id,
    floor_id: 1,
    position: {
      x: tileToMeter(node.x, tilesPerMeter),
      y: tileToMeter(node.y, tilesPerMeter),
    },
    type: node.type,
    name: node.label,
    enabled: true,
  }));
}

function createRouteGraphEdges(document: MapDocument, tilesPerMeter: number): MovementRouteEdge[] {
  const nodesById = new Map(document.navigation.nodes.map((node) => [node.id, node]));

  return document.navigation.links.map((link) => {
    const from = nodesById.get(link.from);
    const to = nodesById.get(link.to);
    const tileDistance = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
    const distanceMeters = Number((tileDistance / tilesPerMeter).toFixed(3));

    return {
      edge_id: link.id,
      from_node: link.from,
      to_node: link.to,
      bidirectional: link.bidirectional,
      weight: distanceMeters || 1,
      distance_m: distanceMeters,
      time_s: 0,
      accessibility: "standard",
      enabled: true,
    };
  });
}

function buildMovement(document: MapDocument): MovementSection {
  const tilesPerMeter = DEFAULT_TILES_PER_METER;
  const pixelsPerMeter = document.map.tileSize * tilesPerMeter;

  return {
    coordinateSystem: {
      unit: "meter",
      origin: "top-left",
      scale: Number((1 / tilesPerMeter).toFixed(3)),
      pixelsPerMeter,
      tilesPerMeter,
    },
    bounds: {
      x: 0,
      y: 0,
      width: tileToMeter(document.map.width, tilesPerMeter),
      height: tileToMeter(document.map.height, tilesPerMeter),
    },
    rooms: [],
    corridors: [],
    walkableAreas: [],
    walls: [],
    doors: [],
    entrances: [],
    routeGraph: {
      nodes: createRouteGraphNodes(document, tilesPerMeter),
      edges: createRouteGraphEdges(document, tilesPerMeter),
    },
  };
}

export function exportMapDocument(state: EditorState): ExportResult {
  const document = structuredClone(state.document) as MapDocument;
  const v3Document: MapDocumentV3 = {
    ...document,
    schemaVersion: 3,
    map: {
      ...document.map,
      floor: document.map.floor ?? "1",
    },
    display: buildDisplay(document),
    movement: buildMovement(document),
  };
  return {
    document: v3Document,
    errors: validateMapDocument(v3Document),
  };
}

export function mapDocumentToJson(document: MapDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
