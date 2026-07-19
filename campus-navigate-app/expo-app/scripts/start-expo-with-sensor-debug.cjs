#!/usr/bin/env node

const os = require('node:os');
const { spawn } = require('node:child_process');

const SENSOR_DEBUG_PORT = process.env.SENSOR_DEBUG_PORT || '8787';
const debugUrl =
  process.env.EXPO_PUBLIC_SENSOR_DEBUG_LOG_URL ||
  `http://${findLanIpAddress()}:${SENSOR_DEBUG_PORT}`;
const args = ['expo', 'start', ...process.argv.slice(2)];

console.log(`Sensor debug URL: ${debugUrl}`);
console.log('Pass Expo args after --, for example: npm run start:sensor-debug -- --port 8082');

const child = spawn('npx', args, {
  env: {
    ...process.env,
    EXPO_PUBLIC_SENSOR_DEBUG_LOG_URL: debugUrl,
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function findLanIpAddress() {
  const preferredInterfaces = ['en0', 'en1'];
  const interfaces = os.networkInterfaces();

  for (const interfaceName of preferredInterfaces) {
    const address = findUsableAddress(interfaces[interfaceName]);
    if (address) {
      return address;
    }
  }

  for (const addresses of Object.values(interfaces)) {
    const address = findUsableAddress(addresses);
    if (address) {
      return address;
    }
  }

  return '127.0.0.1';
}

function findUsableAddress(addresses) {
  return addresses?.find(
    (address) =>
      address.family === 'IPv4' &&
      !address.internal &&
      !address.address.startsWith('169.254.'),
  )?.address;
}
