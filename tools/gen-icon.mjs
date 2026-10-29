// 앱 아이콘 생성기: node tools/gen-icon.mjs → build/icon.png (256×256, 조준선 모양)
import fs from 'node:fs';
import zlib from 'node:zlib';

const S = 256;
const px = Buffer.alloc(S * S * 4);
const set = (x, y, [r, g, b, a]) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
};
const rect = (x0, y0, w, h, c) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c);
};

const BG = [22, 25, 32, 255];
const RED = [255, 70, 85, 255];
const CYAN = [0, 229, 255, 255];
const c = S / 2;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - c + 0.5, y - c + 0.5);
    if (d <= 118) set(x, y, d >= 104 ? RED : BG);
  }
}
const T = 16;
const L = 52;
const G = 18;
rect(c + G, c - T / 2, L, T, CYAN);
rect(c - G - L, c - T / 2, L, T, CYAN);
rect(c - T / 2, c + G, T, L, CYAN);
rect(c - T / 2, c - G - L, T, L, CYAN);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let k = n;
  for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
  return k >>> 0;
});
const crc32 = (buf) => {
  let k = 0xffffffff;
  for (const b of buf) k = crcTable[(k ^ b) & 0xff] ^ (k >>> 8);
  return (k ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr.set([8, 6, 0, 0, 0], 8);
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../build/icon.png', import.meta.url), png);
console.log('build/icon.png', png.length, 'bytes');
