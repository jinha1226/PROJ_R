// Draws the HUD's pixel-art frames (9-slice PNGs) into src/ui/styles/img. Run: `node scripts/prepare-ui.mjs`.
// The frames keep the terminal's green; what changes is that a border is a drawn thing (an outline, a lit edge, a groove,
// corner brackets, a cut corner) instead of a 1px CSS line. They are drawn at 1x and shown at 2x, nearest-neighbour.
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

/**
 * A frame of `size` px a side whose border is told ring by ring from the outside in (`rings`), over `fill`.
 * `bracket`: the corner's lit bracket, this many px along each arm, on ring `on`. `cut`: outer corner px cut away.
 */
function frame({ size, rings, fill, bracket = 0, on = 1, lit, cut = 0, rivet }) {
  const px = [], last = size - 1, clear = [0, 0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.min(x, y, last - x, last - y), cx = Math.min(x, last - x), cy = Math.min(y, last - y);
    let c = d < rings.length ? rings[d] : fill;
    // a ring may be two colours: lit along the top and left, in shade along the bottom and right
    if (Array.isArray(c[0])) c = (d === y && y <= last - y) || (d === x && x <= last - x) ? c[0] : c[1];
    // the bracket: both arms of the corner on one ring, brighter than the line it sits on
    if (bracket && d === on && cx < bracket && cy < bracket) c = lit;
    if (rivet && cx === rivet[0] && cy === rivet[0]) c = rivet[1];
    // the cut corner: the outermost px of each corner are gone, and the outline steps in round them
    if (cx + cy < cut) c = clear; else if (cut && cx + cy === cut && d < 1) c = rings[0];
    px.push(c);
  }
  return png(size, size, px);
}

const ink = hex('#010603'), bright = hex('#5dff8a'), groove = hex('#0a2a14'), dim = hex('#124a26'), pale = hex('#9dffb8');

// a panel: outline, the green line (lit top-left, in shade bottom-right), a groove, a dim inner line; bright corner brackets
writeFileSync(new URL('panel.png', OUT), frame({ size: 24, rings: [ink, [hex('#2a9a50'), hex('#155a2c')], groove, dim], fill: hex('#03140a', 226), bracket: 7, on: 1, lit: bright, cut: 2, rivet: [3, pale] }));
// the same frame with nothing behind it (a panel that keeps its own background)
writeFileSync(new URL('panel-open.png', OUT), frame({ size: 24, rings: [ink, [hex('#2a9a50'), hex('#155a2c')], groove, dim], fill: [0, 0, 0, 0], bracket: 7, on: 1, lit: bright, cut: 2, rivet: [3, pale] }));
// a button: outline, a raised edge, a flat face
writeFileSync(new URL('button.png', OUT), frame({ size: 16, rings: [ink, [hex('#3fbf68'), hex('#0f4a22')], hex('#0a2a14')], fill: hex('#041a0c'), cut: 1 }));
// the same pressed in or lit (hover, queued): the edge reversed, the face bright
writeFileSync(new URL('button-on.png', OUT), frame({ size: 16, rings: [ink, [hex('#0f4a22'), hex('#9dffb8')], hex('#2a9a50')], fill: hex('#5dff8a'), cut: 1 }));
// a bar's trough (health, experience): outline, an edge in shade on top (it is sunk), a dark bed
writeFileSync(new URL('trough.png', OUT), frame({ size: 12, rings: [ink, [hex('#020c06'), hex('#1f7a3e')]], fill: hex('#06180c') }));
// the attack key: the same raised key in the attack's red, its face filled (the one key a thumb looks for)
writeFileSync(new URL('button-atk.png', OUT), frame({ size: 16, rings: [ink, [hex('#ff9a7a'), hex('#5a1410')], hex('#8a2a20')], fill: hex('#5a1812'), cut: 1 }));
// a slot (the quick slots): sunk, an edge in shade on top, a dark bed; a thing lies in it, a key is pressed
writeFileSync(new URL('slot.png', OUT), frame({ size: 16, rings: [ink, [hex('#020c06'), hex('#1f7a3e')], hex('#03100a')], fill: hex('#010804', 235) }));

// corners alone: a key with no edge, only a bracket at each corner, nothing between them. The bracket is a small drawn
// thing, lit from the top left: its corner dot cut away (a rounded turn), bright along the top and left of the key and
// in shade along the bottom and right, a darker line inside it for depth, a dark dot round it all so it reads over a lit floor
{
  const size = 20, arm = 6, hi = hex('#9dffc8'), mid = hex('#1bff80'), low = hex('#0f9a50'), deep = hex('#0b5a30'), dark = hex('#010603'), px = [];
  const at = (x, y) => {
    const cx = Math.min(x, size - 1 - x), cy = Math.min(y, size - 1 - y), top = y < size / 2, left = x < size / 2;
    if (cx === 1 && cy === 1) return null; // the corner dot, cut
    // the outer line: lit where it runs along the key's top or left edge
    if (cy === 1 && cx > 1 && cx <= arm) return top ? (left ? hi : mid) : low;
    if (cx === 1 && cy > 1 && cy <= arm) return left ? (top ? hi : mid) : low;
    // the line inside it, shorter and darker
    if ((cy === 2 && cx >= 2 && cx < arm) || (cx === 2 && cy >= 2 && cy < arm)) return deep;
    return null;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = at(x, y);
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near ||= x + dx >= 0 && y + dy >= 0 && x + dx < size && y + dy < size && !!at(x + dx, y + dy);
    px.push(c ?? (near ? dark : [0, 0, 0, 0]));
  }
  writeFileSync(new URL('corners.png', OUT), png(size, size, px));
}
// dither: shade told in dots, as the game's own picture is (an ordered 4x4 pattern), never a smooth fade
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dots = (w, h, color, cover) => { const px = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.push(BAYER[(y % 4) * 4 + (x % 4)] < cover(y) ? color : [0, 0, 0, 0]); return png(w, h, px); };
// a key's plate: three dots in four dark
writeFileSync(new URL('plate.png', OUT), dots(4, 4, hex('#041009'), () => 12));
// the shade under the top of the screen thinning out downward, band by band; and its mirror for the bottom
const BANDS = [15, 14, 12, 10, 8, 6, 4, 2, 1], BAND = 5, night = hex('#05060c');
writeFileSync(new URL('shade-down.png', OUT), dots(4, BANDS.length * BAND, night, (y) => BANDS[Math.floor(y / BAND)]));
writeFileSync(new URL('shade-up.png', OUT), dots(4, BANDS.length * BAND, night, (y) => BANDS[BANDS.length - 1 - Math.floor(y / BAND)]));
console.log('ui frames written to', OUT.pathname);
