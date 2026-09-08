import assert from "node:assert/strict";
const origin=process.env.ADMIN_WEB_URL || "http://localhost:3100";
const expected=Number(process.env.SIM_USERS || 100);
async function read(path) {
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(6000)});
  assert.equal(response.status,200,`${path} HTTP status`);
  assert.equal(response.headers.get("x-data-source"),"live","must use backend data");
  return response.json();
}
let first;
const deadline=Date.now()+45000;
while (Date.now()<deadline) {
  first=await read("/api/live");
  if (first.representatives.length===expected) break;
  await new Promise(resolve=>setTimeout(resolve,1000));
}
assert.equal(first.representatives.length,expected,"all simulated users must be present");
assert.equal(new Set(first.representatives.map(actor=>actor.actor_id)).size,expected,"actors must be unique");
assert.ok(first.representatives.every(actor=>actor.display_name.startsWith("Walker ")));
await new Promise(resolve=>setTimeout(resolve,2200));
const second=await read("/api/live");
const previous=new Map(first.representatives.map(actor=>[actor.actor_id,actor]));
const moving=second.representatives.filter(actor=>{
  const old=previous.get(actor.actor_id);
  return old && actor.sequence>old.sequence && JSON.stringify(actor.position)!==JSON.stringify(old.position);
}).length;
assert.ok(moving>=Math.floor(expected*.9),`only ${moving}/${expected} actors changed positions`);
const report=await read("/api/dashboard?period=week");
assert.ok(report.total>=expected,"navigation starts must have reached ClickHouse");
assert.equal(report.arrived+report.cancelled+report.expired+report.active,report.total,"outcome counts must reconcile");
assert.equal(report.days.reduce((sum,day)=>sum+day.count,0),report.total,"daily counts must reconcile");
assert.ok(report.destinations.length>0,"expected destination ranking");
assert.ok(report.destinations.every(place=>place.name && !/node-|^N\d/.test(place.name)),"show place names, never node IDs");
assert.equal((await fetch(origin+"/api/dashboard?period=invalid")).status,400);
console.log(JSON.stringify({users:expected,moving,journeys:report.total,topDestination:report.destinations[0].name,passed:true},null,2));
