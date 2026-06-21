import http from 'node:http';
import { mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 4123;
const PATHNAME = '/__movement-debug-log';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const logDir = path.join(repoRoot, 'debug-logs');
const logFile = path.join(logDir, 'movement-runtime.jsonl');

mkdirSync(logDir, { recursive: true });

const server = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== PATHNAME) {
    response.statusCode = 404;
    response.end('not found');
    return;
  }

  const chunks = [];
  request.on('data', (chunk) => {
    chunks.push(chunk);
  });
  request.on('end', () => {
    try {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const parsed = JSON.parse(rawBody);
      appendFileSync(logFile, `${JSON.stringify(parsed)}\n`, 'utf8');
      response.statusCode = 204;
      response.end();
    } catch (error) {
      response.statusCode = 400;
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'invalid request',
        }),
      );
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Movement debug log receiver listening on http://0.0.0.0:${PORT}${PATHNAME}`);
  console.log(`Writing logs to ${logFile}`);
});
