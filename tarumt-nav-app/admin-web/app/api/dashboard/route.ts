import { NextResponse } from "next/server";
import campus from "../../data/campus.json";
export const dynamic="force-dynamic";
const places=new Map(campus.rooms.map(room=>[room.nodeId,room.roomCode||room.name]));
export async function GET(request:Request) {
  const period=new URL(request.url).searchParams.get("period") ?? "week";
  if (period!=="today" && period!=="week") return NextResponse.json({error:"Invalid period"},{status:400});
  const origin=process.env.ANALYTICS_API_BASE_URL?.replace(/\/$/,"");
  if (!origin) return NextResponse.json({error:"Analytics is not configured"},{status:503});
  try {
    const response=await fetch(`${origin}/v1/analytics/dashboard?map_id=main-campus&period=${period}`,{cache:"no-store",signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error("Analytics unavailable");
    const report=await response.json() as {destinations:{node_id:string;count:number}[]};
    return NextResponse.json({...report,destinations:report.destinations.map(destination=>({name:places.get(destination.node_id)||"Unnamed location",count:destination.count}))},{headers:{"cache-control":"no-store","x-data-source":"live"}});
  } catch {return NextResponse.json({error:"Analytics unavailable"},{status:503});}
}
