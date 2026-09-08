import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const report = url.searchParams.get("report") === "route-edges" ? "route-edges" : "floor-traffic";
  const origin = process.env.ANALYTICS_API_BASE_URL?.replace(/\/$/, "");

  if (origin) {
    const query = new URLSearchParams(url.searchParams);
    query.delete("report");
    try {
      const response = await fetch(`${origin}/v1/analytics/${report}?${query}`, { headers: { accept: "application/json" }, cache: "no-store" });
      if (response.ok) {
        return new NextResponse(response.body, { status: 200, headers: { "content-type": "application/json", "x-data-source": "live" } });
      }
    } catch {
      // The dashboard remains presentation-ready when the test VM is offline.
    }
  }

  return NextResponse.json(report === "route-edges" ? demoEdges() : demoTraffic(url.searchParams.get("bucket")), { headers: { "x-data-source": "demo" } });
}

function demoTraffic(bucketValue: string | null) {
  const bucket = bucketValue === "15m" || bucketValue === "1d" ? bucketValue : "1h";
  const now = new Date();
  const interval = bucket === "15m" ? 15 * 60_000 : bucket === "1d" ? 24 * 60 * 60_000 : 60 * 60_000;
  const count = bucket === "1d" ? 7 : 24;
  const pattern = [6, 5, 7, 8, 10, 14, 18, 23, 29, 25, 20, 17, 15, 19, 27, 32, 28, 24, 21, 16, 13, 11, 9, 7];
  const points = Array.from({ length: count }, (_, index) => {
    const journeys = bucket === "1d" ? [38, 44, 51, 47, 63, 58, 54][index] : pattern[index];
    const start = new Date(now.getTime() - (count - 1 - index) * interval);
    start.setUTCMinutes(bucket === "15m" ? Math.floor(start.getUTCMinutes() / 15) * 15 : 0, 0, 0);
    if (bucket === "1d") start.setUTCHours(0, 0, 0, 0);
    return { bucket_start: start.toISOString(), journey_count: journeys, movement_event_count: journeys * (21 + (index % 5) * 3), traffic_level: journeys >= 25 ? "busy" : journeys >= 10 ? "moderate" : "quiet" };
  });
  return { building_id: "main-campus", floor_id: "floor-2", from: points[0].bucket_start, to: new Date(now.getTime() + interval).toISOString(), bucket, generated_at: now.toISOString(), points };
}

function demoEdges() {
  const now = new Date().toISOString();
  const routes = [
    ["node-14", "node-15", 32, 614], ["node-13", "node-14", 28, 536], ["node-13", "node-12", 24, 489],
    ["node-17", "node-16", 21, 408], ["node-18", "node-17", 18, 366], ["node-20", "node-19", 16, 329],
    ["node-15", "node-2", 14, 278], ["node-12", "node-16", 12, 231], ["node-5", "node-6", 10, 194],
  ];
  return { building_id: "main-campus", floor_id: "floor-2", from: now, to: now, bucket: "1h", generated_at: now, edges: routes.map(([from, to, journeys, events], index) => ({ bucket_start: now, from_node_id: from, to_node_id: to, journey_count: journeys, traversal_event_count: events, usage_rank: index + 1 })) };
}
