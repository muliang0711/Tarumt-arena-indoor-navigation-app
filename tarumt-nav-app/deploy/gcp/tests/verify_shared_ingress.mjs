// Node 22+, no dependencies. Run against a synthetic-demo deployment only.
// Creates one short-lived session; does not publish a position or journey.
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { randomBytes, randomUUID, createHash } from 'node:crypto';

const base = new URL(process.env.VERIFY_BASE_URL || 'http://127.0.0.1:18081');
assert.ok(['http:', 'https:'].includes(base.protocol));
assert.equal(base.pathname, '/');
assert.ok(!base.username && !base.password && !base.search && !base.hash);
async function request(path, status = 200, options = {}) {
  const r = await fetch(new URL(path, base), {
    ...options, redirect: 'manual', signal: AbortSignal.timeout(10000),
  });
  assert.equal(r.status, status, `${path}: expected ${status}, received ${r.status}`);
  return r;
}

// Native HTTP upgrade permits the Authorization header used by Flutter.
// Read the first server text frame to prove the backend session actually opens.
async function websocketSession(token) {
  await new Promise((resolve, reject) => {
    const key = randomBytes(16).toString('base64');
    const expected = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    let socket, buffer = Buffer.alloc(0), settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      req.destroy();
      error ? reject(error) : resolve();
    };
    const req = (base.protocol === 'https:' ? https : http).request(new URL('/v1/presence', base), {
      headers: { Connection: 'Upgrade', Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key, Authorization: `Bearer ${token}` },
    });
    const timer = setTimeout(() => finish(Error('WebSocket session timed out')), 10000);
    req.on('error', () => finish(Error('WebSocket transport failed')));
    req.on('response', r => { r.resume(); finish(Error(`WebSocket upgrade rejected: ${r.statusCode}`)); });
    req.on('upgrade', (r, upgraded, head) => {
      socket = upgraded;
      socket.on('error', () => finish(Error('WebSocket connection failed')));
      socket.on('end', () => finish(Error('WebSocket ended before session_ready')));
      function consume(chunk) {
        try {
          assert.equal(r.statusCode, 101);
          assert.equal(r.headers['sec-websocket-accept'], expected);
          buffer = Buffer.concat([buffer, chunk]);
          assert.ok(buffer.length <= 65536, 'Unexpected oversized WebSocket frame');
          if (buffer.length < 2) return;
          assert.equal(buffer[0], 0x81, 'Expected complete session_ready text frame');
          assert.equal(buffer[1] & 0x80, 0, 'Server frame must not be masked');
          let size = buffer[1] & 0x7f, offset = 2;
          assert.notEqual(size, 127, 'Unexpected large frame');
          if (size === 126) {
            if (buffer.length < 4) return;
            size = buffer.readUInt16BE(2); offset = 4;
          }
          if (buffer.length < offset + size) return;
          assert.equal(JSON.parse(buffer.subarray(offset, offset + size).toString()).type, 'session_ready');
          finish();
        } catch { finish(Error('Invalid WebSocket handshake or session_ready frame')); }
      }
      socket.on('data', consume);
      consume(head);
    });
    req.end();
  });
}

if (base.protocol === 'https:') {
  const plain = new URL('/', base);
  plain.protocol = 'http:';
  plain.port = '';
  const redirect = await fetch(plain, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.ok([301, 302, 307, 308].includes(redirect.status), 'HTTP must redirect to HTTPS');
  assert.equal(new URL(redirect.headers.get('location'), plain).origin, base.origin);
}
for (const page of ['/', '/live']) {
  assert.match((await request(page)).headers.get('content-type') || '', /text\/html/);
}
for (const path of ['/api/live', '/api/dashboard?period=week']) {
  const r = await request(path);
  assert.equal(r.headers.get('x-data-source'), 'live', `${path} must use the backend`);
  await r.json();
}
await request('/health/ready');
// The HTTP current endpoint returns the manifest, not the on-disk pointer.
const manifest = await (await request('/v1/maps/main-campus/current')).json();
assert.match(manifest.bundle_revision, /^sha256:[a-f0-9]{64}$/);
assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0);
for (const asset of manifest.assets) {
  assert.match(asset.path, /^[a-zA-Z0-9_.-]+$/);
  const r = await request(`/v1/maps/main-campus/revisions/${manifest.bundle_revision}/${asset.path}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.length, asset.byte_size, `Map asset size: ${asset.path}`);
  assert.equal('sha256:' + createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Map asset checksum: ${asset.path}`);
}
assert.ok(Array.isArray((await (await request('/v1/live/floors/main-campus/floor-2')).json()).representatives));
await (await request('/v1/analytics/dashboard?map_id=main-campus&period=week')).json();
// Missing query parameters must reach Analytics and return JSON 400, not UI HTML.
for (const path of ['/v1/analytics/floor-traffic', '/v1/analytics/route-edges']) {
  await (await request(path, 400)).json();
}
for (const path of ['/metrics', '/health/live', '/debug/pprof/', '/v1/unknown', '/v1/analytics/unknown']) {
  await request(path, 404);
}
await request('/v1/presence', 401);
await request('/v1/presence', 401, { headers: { Authorization: 'Bearer invalid-test-token' } });
const session = await (await request('/v1/anonymous-sessions', 201, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ installation_id: randomUUID(), display_name: 'Deployment check' }),
})).json();
assert.ok(session.access_token, 'Session access token');
assert.equal(session.websocket_path, '/v1/presence');
await websocketSession(session.access_token);
console.log('PASS: website, live/dashboard proxies, map manifest, public APIs, private route denial, token rejection and authenticated WebSocket session.');
