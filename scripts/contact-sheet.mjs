// T-P4 critic loop (PLINTH_SPEC §8): tiles pg-out/<device>-<scene>.png into one
// pg-out/contact-sheet.png, 5 columns (devices) × 4 rows (scenes), each cell
// downscaled 4:1 with its file name drawn from an in-code 5×7 glyph set — no
// fonts, no assets (§2.2, §3).
//   node scripts/contact-sheet.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'pg-out');
const DEVICES = ['phone', 'tablet', 'laptop', 'browser', 'card'];
const SCENES = ['soft-studio', 'dark-glass', 'warm-sunset', 'clean-white'];
const SCALE = 4;
const CELL_W = 1280 / SCALE;
const CELL_H = 800 / SCALE;
const LABEL_H = 12;
const GAP = 4;

// 5×7 glyphs, rows top→bottom, 1 = ink. Lowercase letters, digits not needed, '-' and ' '.
const GLYPHS = {
  a: ['00000','00000','01110','00001','01111','10001','01111'],
  b: ['10000','10000','10110','11001','10001','10001','11110'],
  c: ['00000','00000','01110','10000','10000','10001','01110'],
  d: ['00001','00001','01101','10011','10001','10001','01111'],
  e: ['00000','00000','01110','10001','11111','10000','01110'],
  f: ['00110','01001','01000','11100','01000','01000','01000'],
  g: ['00000','01111','10001','10001','01111','00001','01110'],
  h: ['10000','10000','10110','11001','10001','10001','10001'],
  i: ['00100','00000','01100','00100','00100','00100','01110'],
  k: ['10000','10000','10010','10100','11000','10100','10010'],
  l: ['01100','00100','00100','00100','00100','00100','01110'],
  m: ['00000','00000','11010','10101','10101','10001','10001'],
  n: ['00000','00000','10110','11001','10001','10001','10001'],
  o: ['00000','00000','01110','10001','10001','10001','01110'],
  p: ['00000','00000','11110','10001','11110','10000','10000'],
  r: ['00000','00000','10110','11001','10000','10000','10000'],
  s: ['00000','00000','01110','10000','01110','00001','11110'],
  t: ['01000','01000','11100','01000','01000','01001','00110'],
  u: ['00000','00000','10001','10001','10001','10011','01101'],
  w: ['00000','00000','10001','10001','10101','10101','01010'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

const sheet = new PNG({
  width: DEVICES.length * (CELL_W + GAP) + GAP,
  height: SCENES.length * (CELL_H + LABEL_H + GAP) + GAP,
});
sheet.data.fill(0x22);
for (let i = 3; i < sheet.data.length; i += 4) sheet.data[i] = 255;

function put(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= sheet.width || y >= sheet.height) return;
  const i = (y * sheet.width + x) * 4;
  sheet.data[i] = r; sheet.data[i + 1] = g; sheet.data[i + 2] = b; sheet.data[i + 3] = 255;
}

function label(text, x0, y0) {
  let x = x0;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') put(x + c, y0 + r, 235, 235, 235);
    x += 6;
  }
}

let missing = 0;
SCENES.forEach((scene, row) => {
  DEVICES.forEach((device, col) => {
    const x0 = GAP + col * (CELL_W + GAP);
    const y0 = GAP + row * (CELL_H + LABEL_H + GAP);
    const name = `${device}-${scene}.png`;
    const path = join(OUT, name);
    label(`${device}-${scene}`, x0 + 2, y0 + 2);
    if (!existsSync(path)) { missing++; return; }
    const src = PNG.sync.read(readFileSync(path));
    for (let y = 0; y < CELL_H; y++) {
      for (let x = 0; x < CELL_W; x++) {
        // Box filter SCALE×SCALE.
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
          const i = ((y * SCALE + dy) * src.width + (x * SCALE + dx)) * 4;
          r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2];
        }
        const n = SCALE * SCALE;
        put(x0 + x, y0 + LABEL_H + y, r / n, g / n, b / n);
      }
    }
  });
});

writeFileSync(join(OUT, 'contact-sheet.png'), PNG.sync.write(sheet));
console.log(`contact-sheet.png: ${DEVICES.length * SCENES.length - missing} cells, ${missing} missing`);
