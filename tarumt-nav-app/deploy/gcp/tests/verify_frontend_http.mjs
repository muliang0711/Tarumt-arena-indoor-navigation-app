// Run inside the built admin-web container attached to a real backend network.
// No host ports, DNS-provider calls, or public certificate requests are made.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const server = spawn("npm", ["run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"], { stdio: "ignore" });
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch("http://127.0.0.1:3000/", { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "frontend startup");
  for (const page of ["/", "/live"]) {
    assert.equal((await fetch(`http://127.0.0.1:3000${page}`)).status, 200);
  }
  const live = await fetch("http://127.0.0.1:3000/api/live", { signal: AbortSignal.timeout(8000) });
  assert.equal(live.status, 200);
  assert.equal(live.headers.get("x-data-source"), "live");
  const snapshot = await live.json();
  assert.ok(Array.isArray(snapshot.representatives));
  const dashboard = await fetch("http://127.0.0.1:3000/api/dashboard?period=week", { signal: AbortSignal.timeout(8000) });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.headers.get("x-data-source"), "live");
  const report = await dashboard.json();
  assert.ok(Array.isArray(report.destinations));
  assert.ok(report.destinations.every(place => typeof place.name === "string"));
  console.log(JSON.stringify({ passed: true, users: snapshot.representatives.length,
    namedUsers: snapshot.representatives.filter(actor => actor.display_name?.trim()).length,
    backendTransport: "private Docker HTTP", pages: 2, proxies: 2 }));
} finally {
  server.kill("SIGTERM");
}
