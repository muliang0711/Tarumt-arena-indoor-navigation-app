const fs = require("fs");

function fail(message) {
  console.error(message);
  process.exit(1);
}

try {
  const [tourPath, resultsPath] = process.argv.slice(2);
  const tour = JSON.parse(fs.readFileSync(tourPath, "utf8"));
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const validIds = new Set(Object.keys(results.nodeSummaryIndex || {}));

  if (!Array.isArray(tour) || tour.length < 5 || tour.length > 15) {
    fail("Tour must be an array containing 5-15 steps.");
  }
  for (let index = 0; index < tour.length; index += 1) {
    const step = tour[index];
    if (step.order !== index + 1) fail(`Invalid order at step ${index + 1}.`);
    if (typeof step.title !== "string" || !step.title.trim()) fail(`Missing title at step ${index + 1}.`);
    if (typeof step.description !== "string" || !step.description.trim()) {
      fail(`Missing description at step ${index + 1}.`);
    }
    if (!Array.isArray(step.nodeIds) || step.nodeIds.length < 1 || step.nodeIds.length > 5) {
      fail(`Invalid nodeIds at step ${index + 1}.`);
    }
    for (const id of step.nodeIds) {
      if (!validIds.has(id)) fail(`Unknown node ID at step ${index + 1}: ${id}`);
    }
  }
  console.log(`Validated ${tour.length} sequential steps with real node IDs.`);
} catch (error) {
  fail(error.stack || String(error));
}
