// Draws the HUD's frames (9-slice PNGs) into src/ui/styles/img. Run: `node scripts/prepare-ui.mjs`.
// The frames are told in characters, like the status bar's gauges ([####----]): a panel is +-----+ with | down its sides,
// a button stands between [ and ]. They are drawn on the terminal font's own grid (a 6px cell, 1px strokes) and shown at
// 1x, so a frame's dashes sit beside the text's as the same hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../src/ui/styles/img/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const hex = (c, a = 255) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), a];
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
function png(w, h, px) {
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px[y * w + x], y * (w * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** An image told as rows of characters: each character a colour (a space is the panel's fill). */
function art(rows, colours, fill) {
  const h = rows.length, w = rows[0].length, px = [];
  for (const row of rows) { if (row.length !== w) throw new Error(`ragged art: "${row}"`); for (const ch of row) px.push(colours[ch] ?? fill); }
  return png(w, h, px);
}

const GREEN = { dim: hex('#2f7a4a'), lit: hex('#5dff8a'), fill: hex('#03140a', 232) };
/**
 * A panel: `+` at each corner, `-` along the top and bottom (a 4px dash in a 6px cell), `|` down the sides (a 9px stroke in
 * a 12px line). 9-slice: corners 7x7, the top and bottom tiles 6px wide, the side tiles 12px tall (repeat: round).
 * `.` is the panel's fill, laid under the whole frame so the characters stand on the panel, not on the floor behind it.
 */
const panel = (c, open = false) => art([
  '....................',
  '...+............+...',
  '...+............+...',
  '.+++++..----..+++++.',
  '...+............+...',
  '...+............+...',
  '....................',
  '....................',
  '...|............|...',
  '...|............|...',
  '...|............|...',
  '...|............|...',
  '...|............|...',
  '...|............|...',
  '...|............|...',
  '...|............|...',
  '...|............|...',
  '....................',
  '....................',
  '....................',
  '...+............+...',
  '...+............+...',
  '.+++++..----..+++++.',
  '...+............+...',
  '...+............+...',
  '....................',
], { '+': c.lit, '-': c.dim, '|': c.dim, '.': open ? [0, 0, 0, 0] : c.fill }, c.fill);
writeFileSync(new URL('panel.png', OUT), panel(GREEN));
writeFileSync(new URL('panel-open.png', OUT), panel(GREEN, true));

/**
 * A button: it stands between brackets, as a gauge does. `[` and `]` are a stroke the button's whole height with a 3px
 * foot at top and bottom; the face between them is the fill. 9-slice: 5px left and right, 3px top and bottom.
 */
const button = (c) => art([
  '.............',
  '.###.....###.',
  '.#.........#.',
  '.#.........#.',
  '.#.........#.',
  '.###.....###.',
  '.............',
], { '#': c.lit, '.': c.fill }, c.fill);
writeFileSync(new URL('button.png', OUT), button({ lit: hex('#3fbf68'), fill: hex('#041a0c', 240) }));
// lit (hover, queued): the face bright, the brackets dark on it
writeFileSync(new URL('button-on.png', OUT), button({ lit: hex('#021006'), fill: hex('#5dff8a') }));
// the touch pad's keys keep their own colours: attack red, wait pale
writeFileSync(new URL('button-red.png', OUT), button({ lit: hex('#ff8a6a'), fill: hex('#1a0806', 240) }));
writeFileSync(new URL('button-pale.png', OUT), button({ lit: hex('#e6ffb0'), fill: hex('#0a1a08', 240) }));
console.log('ui frames written to', OUT.pathname);
