#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const REPORT_ROOT = path.join(process.cwd(), 'reports', 'sensor-debug');
const sessionIds = process.argv.slice(2);

if (sessionIds.length < 2) {
  console.error(
    'Usage: npm run sensor-debug-compare -- <idle-shake-session> <walk-session> [...more]',
  );
  process.exit(1);
}

const reports = sessionIds.map(readSessionReport);
const comparison = {
  comparedAtMs: Date.now(),
  reports,
};
const outputPath = path.join(
  REPORT_ROOT,
  `comparison-${new Date(comparison.comparedAtMs)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:.]/g, '-')}.json`,
);

fs.writeFileSync(outputPath, `${JSON.stringify(comparison, null, 2)}\n`);
console.log(JSON.stringify(comparison, null, 2));
console.log(`\nWrote ${outputPath}`);

function readSessionReport(sessionId) {
  const sessionDir = path.join(REPORT_ROOT, sessionId);
  const logs = readBatchLogs(path.join(sessionDir, 'batch-diagnostics.jsonl'));
  const summary = readJson(path.join(sessionDir, 'summary.json'));
  const accepted = logs.filter((log) => log.diagnostics.step.stepCount > 0);
  const moved = logs.filter(
    (log) => log.diagnostics.movement.movedStepCount > 0,
  );
  const blockedMoved = accepted.filter(
    (log) => log.diagnostics.movement.movedStepCount === 0,
  );

  return {
    acceptedPeak: summarizeNumbers(
      accepted.map((log) => log.diagnostics.step.peakAcceleration),
    ),
    detectedSteps: summary.detectedSteps,
    movementBlockedReasonCounts: countBy(blockedMoved, (log) =>
      log.diagnostics.movement.blockedReason ?? 'unknown',
    ),
    movedPeak: summarizeNumbers(
      moved.map((log) => log.diagnostics.step.peakAcceleration),
    ),
    movedSteps: summary.movedSteps,
    rejectReasonCounts: summary.rejectReasonCounts,
    sessionId,
    totalBatches: summary.totalBatches,
  };
}

function readBatchLogs(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function summarizeNumbers(values) {
  if (values.length === 0) {
    return {
      average: null,
      count: 0,
      max: null,
      min: null,
      p50: null,
      p75: null,
      p90: null,
    };
  }

  const sorted = [...values].sort((left, right) => left - right);

  return {
    average: Number(
      (values.reduce((total, value) => total + value, 0) / values.length).toFixed(
        3,
      ),
    ),
    count: values.length,
    max: sorted[sorted.length - 1],
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
  };
}

function percentile(sortedValues, percentileValue) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * percentileValue)),
  );

  return sortedValues[index];
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
