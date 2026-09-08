"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import campus from "./data/campus.json";
import { Navigation } from "./navigation";
import { positionOnImage, worldToImage } from "./map-coordinates.mjs";

type Position = { from_node_id: string; to_node_id: string; edge_progress: number; heading: number; movement_state: string };
type Actor = { actor_id: string; display_name?: string; position: Position; sequence: number; updated_at: string };
type Snapshot = { representatives: Actor[]; floor_counts: { floor_id: string; count: number }[] };
const nodes = new Map(campus.graph.floors[0].nodes.map(node => [node.node_id, node]));
const rooms = new Map(campus.rooms.map(room => [room.nodeId, room.roomCode || room.name]));
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
function locate(actor: Actor) {
  const from = nodes.get(actor.position.from_node_id), to = nodes.get(actor.position.to_node_id);
  if (!from || !to) return null;
  return { actor, ...positionOnImage(from, to, actor.position.edge_progress, campus.surface) };
}
export function ArenaMap() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ representatives: [], floor_counts: [] });
  const [status, setStatus] = useState("Connecting");
  const [limit, setLimit] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: .92 });
  const drag = useRef<{ id: number; x: number; y: number; originX: number; originY: number } | null>(null);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/live", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("offline");
        const body: Snapshot = await response.json();
        if (!disposed) { setSnapshot(body); setStatus("Live"); }
      } catch {
        if (!disposed) { setStatus("Disconnected"); setSnapshot({ representatives: [], floor_counts: [] }); }
      } finally { if (!disposed) timer = setTimeout(refresh, 1000); }
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  }, []);
  const all = useMemo(() => [...snapshot.representatives]
    .sort((a, b) => (a.display_name || "").localeCompare(b.display_name || "") || a.actor_id.localeCompare(b.actor_id))
    .map(locate).filter((point): point is NonNullable<typeof point> => point !== null), [snapshot]);
  const visible = limit === "all" ? all : all.slice(0, Number(limit));
  const selectedPoint = visible.find(point => point.actor.actor_id === selected);
  const floorCount = snapshot.floor_counts.find(floor => floor.floor_id === "floor-2")?.count ?? all.length;
  const zoom = (delta: number) => setViewport(v => ({ ...v, scale: clamp(v.scale+delta, .5, 4) }));
  return <main className="map-app">
    <Navigation page="live" />
    <div className="map-toolbar">
      <div className="connection-status"><i className={status === "Live" ? "connected" : ""} />{status}<span>{floorCount} online</span></div>
      <label>Show users <select aria-label="Show users" value={limit} onChange={e => { setLimit(e.target.value); setSelected(null); }}><option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="all">All</option></select></label>
      <span role="status" data-testid="visible-count">Showing {visible.length} of {all.length}</span>
    </div>
    <div className="map-surface" onWheel={e => zoom(e.deltaY > 0 ? -.1 : .1)}
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id:e.pointerId, x:e.clientX, y:e.clientY, originX:viewport.x, originY:viewport.y };
      }}
      onPointerMove={e => { const d=drag.current; if (d?.id === e.pointerId) setViewport(v => ({...v, x:d.originX+e.clientX-d.x, y:d.originY+e.clientY-d.y})); }}
      onPointerUp={() => { drag.current=null; }} onPointerCancel={() => { drag.current=null; }}>
      <div className="map-layer" style={{aspectRatio:`${campus.surface.width} / ${campus.surface.height}`, transform:`translate(calc(-50% + ${viewport.x}px), calc(-50% + ${viewport.y}px)) scale(${viewport.scale})`}}>
        <img src="/floor-2.png" alt="Main Campus second floor map" draggable={false} />
        {campus.rooms.map(room => { const node=nodes.get(room.nodeId); if (!node) return null; const point=worldToImage(node, campus.surface); return <span key={room.id} className="room-label" style={{left:`${point.x/campus.surface.width*100}%`, top:`${point.y/campus.surface.height*100}%`}}>{room.roomCode || room.name}</span>; })}
        {visible.map(({actor,x,y}) => <button key={actor.actor_id} data-testid="user-marker" data-actor={actor.actor_id} data-sequence={actor.sequence}
          className={`user-marker ${selected === actor.actor_id ? "selected" : ""}`}
          style={{left:`${x/campus.surface.width*100}%`, top:`${y/campus.surface.height*100}%`}}
          aria-label={actor.display_name?.trim() || "Unnamed user"} title={actor.display_name?.trim() || "Unnamed user"}
          onClick={() => setSelected(actor.actor_id)}>
          <span className="marker-dot" /><span className="marker-arrow" style={{transform:`rotate(${actor.position.heading}deg)`}} />
          <span className="marker-name" data-testid="user-name">{actor.display_name?.trim() || "Unnamed user"}</span>
        </button>)}
      </div>
    </div>
    <div className="zoom-controls"><button onClick={() => zoom(.2)} aria-label="Zoom in">+</button><button onClick={() => zoom(-.2)} aria-label="Zoom out">−</button><button onClick={() => setViewport({x:0,y:0,scale:.92})} aria-label="Reset map view">⌂</button></div>
    {status === "Live" && all.length === 0 && <div className="map-empty">No users currently sharing their location.</div>}
    {selectedPoint && <button className="map-popover" onClick={() => setSelected(null)}><strong>{selectedPoint.actor.display_name?.trim() || "Unnamed user"}</strong><span>{selectedPoint.actor.position.movement_state === "walking" ? "Moving" : "Stopped"} · {rooms.get(selectedPoint.actor.position.to_node_id) || rooms.get(selectedPoint.actor.position.from_node_id) || "Corridor"}</span></button>}
  </main>;
}
