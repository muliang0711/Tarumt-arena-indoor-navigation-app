export function findRouteNode(mapData, nodeId) {
  return mapData.movement.routeGraph.nodes.find((node) => node.node_id === nodeId || node.id === nodeId) || null;
}

export function buildNodePath(mapData, fromNodeId, toNodeId) {
  if (fromNodeId === toNodeId) {
    return [fromNodeId];
  }

  const graph = new Map();
  for (const edge of mapData.movement.routeGraph.edges) {
    if (edge.enabled === false) {
      continue;
    }
    addEdge(graph, edge.from_node, edge.to_node);
    if (edge.bidirectional) {
      addEdge(graph, edge.to_node, edge.from_node);
    }
  }

  const queue = [[fromNodeId]];
  const visited = new Set([fromNodeId]);
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    for (const next of graph.get(current) || []) {
      if (visited.has(next)) {
        continue;
      }
      const nextPath = [...path, next];
      if (next === toNodeId) {
        return nextPath;
      }
      visited.add(next);
      queue.push(nextPath);
    }
  }

  return [];
}

export function createBobAtNode(mapData, nodeId = "node_1") {
  const node = findRouteNode(mapData, nodeId);
  if (!node) {
    throw new Error(`Unable to create Bob: route node "${nodeId}" was not found.`);
  }

  return {
    id: "bob",
    name: "Bob",
    nodeId,
    position: clonePosition(node.position),
    direction: "down",
    action: "idle",
    frameIndex: 0,
    animationMs: 0,
  };
}

export function createNodeRouteRunner(mapData, actor, nodeIds, options = {}) {
  return new NodeRouteRunner(mapData, actor, nodeIds, options);
}

class NodeRouteRunner {
  constructor(mapData, actor, nodeIds, options = {}) {
    this.actor = actor;
    this.nodes = nodeIds.map((nodeId) => {
      const node = findRouteNode(mapData, nodeId);
      if (!node) {
        throw new Error(`Route node "${nodeId}" was not found.`);
      }
      return node;
    });
    this.speedMetersPerSecond = options.speedMetersPerSecond || 1.4;
    this.segmentIndex = 0;
    this.segmentProgress = 0;

    if (this.nodes.length > 0) {
      this.actor.nodeId = nodeIdOf(this.nodes[0]);
      this.actor.position = clonePosition(this.nodes[0].position);
    }
  }

  update(deltaMs) {
    const safeDeltaMs = Math.max(0, Number(deltaMs) || 0);
    this.actor.animationMs = (this.actor.animationMs || 0) + safeDeltaMs;
    let remainingSeconds = safeDeltaMs / 1000;
    while (remainingSeconds > 0 && this.segmentIndex < this.nodes.length - 1) {
      const from = this.nodes[this.segmentIndex].position;
      const to = this.nodes[this.segmentIndex + 1].position;
      const distance = distanceBetween(from, to);
      if (distance === 0) {
        this.segmentIndex += 1;
        this.segmentProgress = 0;
        continue;
      }

      const remainingDistance = distance - this.segmentProgress;
      const stepDistance = remainingSeconds * this.speedMetersPerSecond;
      if (stepDistance < remainingDistance) {
        this.segmentProgress += stepDistance;
        remainingSeconds = 0;
      } else {
        this.segmentIndex += 1;
        this.segmentProgress = 0;
        remainingSeconds -= remainingDistance / this.speedMetersPerSecond;
      }
    }

    this.applyActorState();
    return this.actor;
  }

  applyActorState() {
    const atEnd = this.segmentIndex >= this.nodes.length - 1;
    const currentNode = this.nodes[Math.min(this.segmentIndex, this.nodes.length - 1)];
    if (atEnd) {
      this.actor.nodeId = nodeIdOf(currentNode);
      this.actor.position = clonePosition(currentNode.position);
      this.actor.action = "idle";
      return;
    }

    const from = this.nodes[this.segmentIndex].position;
    const to = this.nodes[this.segmentIndex + 1].position;
    const distance = distanceBetween(from, to);
    const t = distance === 0 ? 1 : this.segmentProgress / distance;
    this.actor.position = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
    this.actor.direction = directionBetween(from, to);
    this.actor.action = "run";
  }
}

function addEdge(graph, from, to) {
  if (!graph.has(from)) {
    graph.set(from, []);
  }
  graph.get(from).push(to);
}

function nodeIdOf(node) {
  return node.node_id || node.id;
}

function clonePosition(position) {
  return {
    x: Number(position.x),
    y: Number(position.y),
  };
}

function distanceBetween(from, to) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function directionBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}
