import assert from "node:assert/strict";
import test from "node:test";
import worker from "../dist/server/index.js";

for (const [path,expected] of [["/","Navigation overview"],["/live","Show users"]]) {
  test(`renders the working ${path} page`, async () => {
    const response=await worker.fetch(new Request(`http://localhost${path}`),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
    assert.equal(response.status,200);
    const html=await response.text();
    assert.ok(html.includes(expected));
    assert.ok(html.includes("Dashboard") && html.includes("Live map"));
    assert.ok(!html.includes("Your site is taking shape"));
    assert.ok(!html.includes("Demo Walker"));
  });
}
