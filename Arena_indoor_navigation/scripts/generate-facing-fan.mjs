import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const width = 128;
const height = 128;
const centerX = width / 2;
const centerY = height / 2;
const radius = 56;
const halfAngle = (42 * Math.PI) / 180;
const pixels = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const dx = x + 0.5 - centerX;
    const dy = y + 0.5 - centerY;
    const distance = Math.hypot(dx, dy);
    const angleFromUp = Math.atan2(dx, -dy);
    const inside = distance <= radius && Math.abs(angleFromUp) <= halfAngle;
    if (!inside) {
      continue;
    }

    const edgeDistance = Math.min(
      radius - distance,
      (halfAngle - Math.abs(angleFromUp)) * radius,
    );
    const edgeAlpha = Math.max(0, Math.min(1, edgeDistance / 2));
    const radialFade = 1 - 0.35 * (distance / radius);
    const index = (y * width + x) * 4;
    pixels[index] = 255;
    pixels[index + 1] = 116;
    pixels[index + 2] = 23;
    pixels[index + 3] = Math.round(92 * radialFade * edgeAlpha);
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;

const rows = Buffer.alloc(height * (1 + width * 4));
for (let y = 0; y < height; y += 1) {
  const rowStart = y * (1 + width * 4);
  rows[rowStart] = 0;
  pixels.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4);
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(rows)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../src/storage/bob/facing_fan.png', import.meta.url), png);
