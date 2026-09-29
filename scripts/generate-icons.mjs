#!/usr/bin/env node
/**
 * Generates the Rivet app icons as real PNG files (no dependencies).
 *
 *   node scripts/generate-icons.mjs
 *
 * Output: public/icons/icon-<size>.png for 16, 32, 48, 180, 192, 512.
 * The mark mirrors the brand: ink square, mint rivet ring, mint core.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SIZES = [16, 32, 48, 180, 192, 512];
const OUT_DIR = "public/icons";
const INK = [7, 17, 14];
const MINT = [53, 213, 180];

// ---------- minimal PNG encoder ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const scan = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    scan[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(scan, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scan, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- mark rasterizer (3x supersampled, then box downsampled) ----------
function drawMark(size) {
  const SS = 3;
  const w = size * SS;
  const px = new Uint8Array(w * w * 4);
  const center = w / 2;
  const ringR = (8.5 / 32) * w;
  const ringStroke = (2.4 / 32) * w;
  const coreR = (3 / 32) * w;

  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const d = Math.sqrt(dx * dx + dy * dy);
      const onRing = Math.abs(d - ringR) <= ringStroke / 2;
      const onCore = d <= coreR;
      const col = onRing || onCore ? MINT : INK;
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = 255;
    }
  }

  // downsample SS -> 1 with box average
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 4;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = `${OUT_DIR}/icon-${size}.png`;
  writeFileSync(file, encodePng(size, size, drawMark(size)));
  console.log(`wrote ${file}`);
}
console.log("icons ready");
