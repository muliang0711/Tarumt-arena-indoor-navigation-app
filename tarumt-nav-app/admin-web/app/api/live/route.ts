import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const origin = process.env.PRESENCE_API_BASE_URL?.replace(/\/$/, "");
  if (!origin) return NextResponse.json({ error: "Live connection is not configured" }, { status: 503 });
  try {
    const response = await fetch(`${origin}/v1/live/floors/main-campus/floor-2`, { cache:"no-store", signal:AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("Gateway unavailable");
    return new NextResponse(response.body, {headers:{"content-type":"application/json", "cache-control":"no-store", "x-data-source":"live"}});
  } catch { return NextResponse.json({error:"Live connection unavailable"}, {status:503}); }
}
