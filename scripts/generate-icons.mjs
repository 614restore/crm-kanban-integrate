/**
 * Generates placeholder PWA icons for TrussCTR.
 * Run: node scripts/generate-icons.mjs
 *
 * These are solid-color placeholder icons in TrussCTR brand blue (#1e3a8a).
 * Replace them with properly designed icons before your App Store submission.
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

// CRC32 for PNG chunks
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function createSolidPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB color type

  // Raw image: filter byte (0) + RGB pixels per row
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < size; x++) {
      raw[rowStart + 1 + x * 3] = r;
      raw[rowStart + 1 + x * 3 + 1] = g;
      raw[rowStart + 1 + x * 3 + 2] = b;
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// TrussCTR brand blue: #1e3a8a
const [R, G, B] = [30, 58, 138];

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const size of sizes) {
  const file = join(iconsDir, `icon-${size}x${size}.png`);
  writeFileSync(file, createSolidPNG(size, R, G, B));
  console.log(`✅ ${file}`);
}

// Shortcut and notification icons
for (const name of ['contact-shortcut', 'camera-shortcut', 'pipeline-shortcut', 'badge-72x72']) {
  const size = name.includes('badge') ? 72 : 96;
  const file = join(iconsDir, `${name}.png`);
  writeFileSync(file, createSolidPNG(size, R, G, B));
  console.log(`✅ ${file}`);
}

console.log('\n⚠️  These are solid-color placeholder icons.');
console.log('   Replace them with properly designed brand icons before your App Store submission.\n');
