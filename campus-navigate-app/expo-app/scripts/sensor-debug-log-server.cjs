#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const PORT = Number(process.env.SENSOR_DEBUG_PORT || 8787);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_ROOT = path.join(PROJECT_ROOT, 'reports', 'sensor-debug');

fs.mkdirSync(REPORT_ROOT, { recursive: true });

const server = http.createServer(async (request, response) => {
  applyCors(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'method-not-allowed' });
    return;
  }

  try {
    const body = await readJsonBody(request);

    if (request.url === '/session-start') {
      handleSessionStart(body);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.url === '/batch') {
      handleBatch(body);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.url === '/session-stop') {
      handleSessionStop(body);
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: 'not-found' });
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'bad-request',
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sensor debug log server writing to ${REPORT_ROOT}`);
  console.log(`Listening on http://0.0.0.0:${PORT}`);
});

function handleSessionStart(event) {
  assertSessionId(event.sessionId);
  console.log(`[sensor-debug] session-start ${event.sessionId}`);
  const sessionDir = getSessionDir(event.sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(sessionDir, 'session.json'), {
    ...event,
    endedAtMs: null,
  });
  writeSummary(event.sessionId);
}

function handleBatch(log) {
  assertSessionId(log.sessionId);
  console.log(`[sensor-debug] batch ${log.sessionId} #${log.batchId}`);
  const sessionDir = getSessionDir(log.sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.appendFileSync(
    path.join(sessionDir, 'batch-diagnostics.jsonl'),
    `${JSON.stringify(log)}\n`,
  );
  writeSummary(log.sessionId);
}

function handleSessionStop(event) {
  assertSessionId(event.sessionId);
  console.log(`[sensor-debug] session-stop ${event.sessionId}`);
  const sessionDir = getSessionDir(event.sessionId);
  const sessionPath = path.join(sessionDir, 'session.json');
  const session = readJsonIfExists(sessionPath) ?? {
    sessionId: event.sessionId,
    startedAtMs: null,
  };
  writeJson(sessionPath, {
    ...session,
    endedAtMs: event.endedAtMs,
  });
  writeSummary(event.sessionId);
}

function writeSummary(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  const summaryPath = path.join(sessionDir, 'summary.json');
  const previousSummary = readJsonIfExists(summaryPath);
  const actualSteps =
    previousSummary && Object.hasOwn(previousSummary, 'actualSteps')
      ? previousSummary.actualSteps
      : null;
  const logs = readBatchLogs(path.join(sessionDir, 'batch-diagnostics.jsonl'));
  const detectedSteps = logs.reduce(
    (total, log) => total + (log.diagnostics?.step?.stepCount ?? 0),
    0,
  );
  const movedSteps = logs.reduce(
    (total, log) => total + (log.diagnostics?.movement?.movedStepCount ?? 0),
    0,
  );
  const rejectReasonCounts = countBy(logs, (log) =>
    log.diagnostics?.step?.rejectReason ?? 'UNKNOWN',
  );
  const movementDirectionCounts = countBy(logs, (log) =>
    log.diagnostics?.movement?.direction ?? 'unknown',
  );
  const movementBlockedReasonCounts = countBy(
    logs.filter((log) => log.diagnostics?.movement?.blockedReason),
    (log) => log.diagnostics?.movement?.blockedReason,
  );
  const peakAccelerations = logs.map(
    (log) => log.diagnostics?.step?.peakAcceleration ?? 0,
  );
  const latencies = logs.map((log) => log.diagnostics?.latencyMs ?? 0);
  const detectionRatio =
    typeof actualSteps === 'number' && actualSteps > 0
      ? Number((detectedSteps / actualSteps).toFixed(3))
      : null;

  writeJson(summaryPath, {
    actualSteps,
    averageLatencyMs: average(latencies),
    averagePeakAcceleration: average(peakAccelerations),
    detectedSteps,
    detectionRatio,
    firstBatchAtMs: logs[0]?.timestampMs ?? null,
    lastBatchAtMs: logs[logs.length - 1]?.timestampMs ?? null,
    maxPeakAcceleration: maximum(peakAccelerations),
    minPeakAcceleration: minimum(peakAccelerations),
    movedSteps,
    movementBlockedReasonCounts,
    movementDirectionCounts,
    movementBlockedBatches: movementDirectionCounts.blocked ?? 0,
    rejectReasonCounts,
    rejectedBatches: logs.filter(
      (log) => (log.diagnostics?.step?.stepCount ?? 0) === 0,
    ).length,
    sessionId,
    suggestions: createSuggestions({
      actualSteps,
      detectedSteps,
      detectionRatio,
      movementBlockedBatches: movementDirectionCounts.blocked ?? 0,
      rejectReasonCounts,
      totalBatches: logs.length,
    }),
    totalBatches: logs.length,
  });
}

function createSuggestions(input) {
  const suggestions = [];
  const topRejectReason = Object.entries(input.rejectReasonCounts)
    .filter(([reason]) => reason !== 'ACCEPTED')
    .sort((left, right) => right[1] - left[1])[0]?.[0];

  if (input.detectionRatio !== null && input.detectionRatio < 0.85) {
    suggestions.push('Detector may be too strict because detectedSteps is below actualSteps.');
  }

  if (input.detectionRatio !== null && input.detectionRatio > 1.15) {
    suggestions.push('Detector may be too sensitive because detectedSteps is above actualSteps.');
    suggestions.push('Consider raising accelerationStepThreshold before tuning stepLengthMeters.');
  }

  if (
    (input.detectionRatio === null || input.detectionRatio < 0.85) &&
    topRejectReason === 'LOW_PEAK'
  ) {
    suggestions.push('LOW_PEAK is the main rejection reason; consider lowering accelerationStepThreshold slightly.');
  }

  if (topRejectReason === 'NO_QUIET_SAMPLE') {
    suggestions.push('NO_QUIET_SAMPLE is the main rejection reason; consider raising stillnessAccelerationMagnitude slightly.');
  }

  if (topRejectReason === 'TOO_SOON_AFTER_LAST_STEP') {
    suggestions.push('TOO_SOON_AFTER_LAST_STEP is high; consider lowering minStepIntervalMs slightly.');
  }

  if (topRejectReason === 'SHAKE_TOO_HIGH') {
    suggestions.push('SHAKE_TOO_HIGH is high; check hand motion or review maxShakeAccelerationMagnitude.');
  }

  if (topRejectReason === 'PHONE_ROTATION') {
    suggestions.push('PHONE_ROTATION is high; standing phone rotation is being rejected before marker movement.');
  }

  if (input.totalBatches > 0 && input.movementBlockedBatches / input.totalBatches > 0.25) {
    suggestions.push('Many detected batches are heading-blocked; inspect heading source and movementHeadingToleranceDegrees.');
  }

  if (suggestions.length === 0) {
    suggestions.push('No obvious tuning suggestion yet; add actualSteps after the test for a better ratio.');
  }

  return suggestions;
}

function readBatchLogs(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return Number(
    (values.reduce((total, value) => total + value, 0) / values.length).toFixed(3),
  );
}

function maximum(values) {
  return values.length === 0 ? null : Math.max(...values);
}

function minimum(values) {
  return values.length === 0 ? null : Math.min(...values);
}

function getSessionDir(sessionId) {
  return path.join(REPORT_ROOT, sessionId);
}

function assertSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(sessionId)) {
    throw new Error('invalid-session-id');
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('request-too-large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('invalid-json'));
      }
    });
    request.on('error', reject);
  });
}

function applyCors(response) {
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  response.setHeader('access-control-allow-origin', '*');
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}
