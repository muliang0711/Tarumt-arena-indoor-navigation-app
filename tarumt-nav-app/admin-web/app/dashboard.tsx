"use client";
import { useEffect, useState } from "react";
import { Navigation } from "./navigation";
type Report = { total:number; arrived:number; cancelled:number; expired:number; active:number; destinations:{name:string;count:number}[]; days:{day:string;count:number}[] };
export function Dashboard() {
  const [period,setPeriod] = useState("week");
  const [report,setReport] = useState<Report | null>(null);
  const [error,setError] = useState(false);
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let disposed=false; let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    setReport(null); setError(false);
    async function refresh() {
      try {
        const response=await fetch(`/api/dashboard?period=${period}`,{cache:"no-store",signal:controller.signal});
        if (!response.ok) throw new Error("unavailable");
        const data:Report=await response.json();
        if (!disposed) {setReport(data);setError(false);}
      } catch {if (!disposed) {setReport(null);setError(true);}}
      finally {if (!disposed) timer=setTimeout(refresh,10000);}
    }
    void refresh(); return () => {disposed=true;clearTimeout(timer);controller.abort();};
  },[period,retry]);
  const top=report?.destinations[0];
  const maximum=Math.max(1,...(report?.days.map(day=>day.count) ?? []));
  return <><Navigation page="dashboard" /><main className="dashboard">
    <div className="dashboard-heading"><h1>Navigation overview</h1><select className="period-picker" aria-label="Time period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="today">Today</option><option value="week">This week</option></select></div>
    {error ? <div className="error-state" role="alert">Navigation data is temporarily unavailable.<button onClick={()=>setRetry(n=>n+1)}>Retry</button></div> : <>
      <div className="summary-grid">
        <div className="metric"><span>Navigation starts</span><strong>{report?.total.toLocaleString() ?? "—"}</strong></div>
        <div className="metric"><span>Arrived</span><strong>{report?.arrived.toLocaleString() ?? "—"}</strong></div>
        <div className="metric"><span>In progress</span><strong>{report?.active.toLocaleString() ?? "—"}</strong></div>
        <div className="metric"><span>Most popular</span><strong style={{fontSize:"26px"}}>{top?.name ?? "—"}</strong></div>
      </div>
      <div className="dashboard-panels">
        <section className="panel"><h2>Popular destinations</h2>
          {report?.destinations.length ? <div className="ranking">{report.destinations.map((destination,index)=><div className="rank-row" key={destination.name}><span className="rank-number">{String(index+1).padStart(2,"0")}</span><div className="rank-place">{destination.name}<i style={{width:`${destination.count/(top?.count||1)*100}%`}} /></div><b className="rank-value">{destination.count}</b></div>)}</div> : <div className="empty-state">{report ? "No destination has five navigation starts yet." : "Loading navigation data…"}</div>}
          <p className="panel-note">Times selected to start navigation · Minimum 5 starts</p>
        </section>
        <section className="panel"><h2>Daily navigation starts</h2>
          <div className="trend" aria-label="Daily navigation starts">{report?.days.map(day=><div className="trend-day" key={day.day}><b>{day.count}</b><i style={{height:`${day.count/maximum*150}px`}}/><span>{new Date(`${day.day}T12:00:00+08:00`).toLocaleDateString("en-MY",{weekday:"short",timeZone:"Asia/Kuala_Lumpur"})}</span></div>)}</div>
          <div className="results"><span>Cancelled <b>{report?.cancelled ?? "—"}</b></span><span>Expired <b>{report?.expired ?? "—"}</b></span></div>
          <p className="panel-note">Malaysia time · {period==="week" ? "Monday to today" : "Today"}</p>
        </section>
      </div>
    </>}
  </main></>;
}
