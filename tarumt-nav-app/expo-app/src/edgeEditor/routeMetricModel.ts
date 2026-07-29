import { distanceBetweenPoints } from '../tiled/model/geometryMath';
import type { OverlayRouteNode, RoutePosition } from '../tiled/type';
import type { RouteGraphEdgeExport } from './routeGraphEdgeModel';

export type RouteMetricSegment = {
  endDistanceMeters: number;
  endDistancePixels: number;
  fromNodeId: string;
  meterLength: number;
  pixelLength: number;
  pixelsPerMeter: number;
  startDistanceMeters: number;
  startDistancePixels: number;
  toNodeId: string;
};

export type RouteMetricModel = {
  averagePixelsPerMeter: number;
  segments: RouteMetricSegment[];
  totalMeters: number;
  totalPixels: number;
};

export function createRouteMetricModel(
  routePath: readonly OverlayRouteNode[],
  edges: readonly RouteGraphEdgeExport[],
): RouteMetricModel {
  const segments: RouteMetricSegment[] = [];
  let startDistanceMeters = 0;
  let startDistancePixels = 0;

  for (let index = 0; index < routePath.length - 1; index += 1) {
    const from = routePath[index];
    const to = routePath[index + 1];
    if (!from || !to) {
      continue;
    }

    const edge = findEdgeBetweenNodes(edges, from.nodeId, to.nodeId);
    if (!edge) {
      throw new Error(`Missing EDGE distance for ${from.nodeId} -> ${to.nodeId}.`);
    }

    const pixelLength = distanceBetweenPoints(from, to);
    const meterLength = edge.distance;
    if (meterLength <= 0) {
      throw new Error(`EDGE distance must be positive for ${edge.id}.`);
    }

    const endDistanceMeters = startDistanceMeters + meterLength;
    const endDistancePixels = startDistancePixels + pixelLength;
    segments.push({
      endDistanceMeters,
      endDistancePixels,
      fromNodeId: from.nodeId,
      meterLength,
      pixelLength,
      pixelsPerMeter: pixelLength / meterLength,
      startDistanceMeters,
      startDistancePixels,
      toNodeId: to.nodeId,
    });
    startDistanceMeters = endDistanceMeters;
    startDistancePixels = endDistancePixels;
  }

  return {
    averagePixelsPerMeter:
      startDistanceMeters > 0 ? startDistancePixels / startDistanceMeters : 1,
    segments,
    totalMeters: startDistanceMeters,
    totalPixels: startDistancePixels,
  };
}

export function findPixelsPerMeterAtRoutePosition(input: {
  metrics: RouteMetricModel;
  position: RoutePosition;
}) {
  const segment = input.metrics.segments.find(
    (currentSegment) =>
      input.position.distanceAlongRoute >= currentSegment.startDistancePixels &&
      input.position.distanceAlongRoute <= currentSegment.endDistancePixels,
  );

  return segment?.pixelsPerMeter ?? input.metrics.averagePixelsPerMeter;
}

export function convertMetersToPixelsAtRoutePosition(input: {
  meters: number;
  metrics: RouteMetricModel;
  position: RoutePosition;
}) {
  return (
    input.meters *
    findPixelsPerMeterAtRoutePosition({
      metrics: input.metrics,
      position: input.position,
    })
  );
}

function findEdgeBetweenNodes(
  edges: readonly RouteGraphEdgeExport[],
  fromNodeId: string,
  toNodeId: string,
) {
  return edges.find(
    (edge) =>
      (edge.from === fromNodeId && edge.to === toNodeId) ||
      (edge.from === toNodeId && edge.to === fromNodeId),
  );
}
