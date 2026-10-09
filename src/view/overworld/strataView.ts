import * as THREE from 'three';
import type { FloorRow } from '../../sim/base/floors';
import type { ZoneId } from '../../sim/grid/zones';

/** the cut face's measures, in cells: the topsoil over the first floor, a floor's height, the face's width and depth; and its paint's pixels per cell */
export const STRATA = { top: 1.5, floor: 4, width: 64, depth: 64, px: 16 };
/** how far below the ground a floor's ceiling lies */
export const floorTop = (n: number): number => STRATA.top + (n - 1) * STRATA.floor;

// (the dot look lifts the shadows and snaps to its palette: these are dark sources that land on its plum-brown, slate and red sandstone)
const ROCK: Record<ZoneId, { rock: string; dark: string; light: string; room: string; back: string; accent: string }> = {
  cave: { rock: '#22160f', dark: '#150d0a', light: '#3a2018', room: '#060508', back: '#0d0a0c', accent: '#0070c8' },
  crypt: { rock: '#0c0f1f', dark: '#07091a', light: '#181f3a', room: '#040409', back: '#0a0c18', accent: '#7a2a78' },
  ruins: { rock: '#471a16', dark: '#30120f', light: '#8a4a30', room: '#080506', back: '#160c0a', accent: '#e07a10' },
};
/** half a room's width, the room's ceiling and floor inside its band, the shaft's half-width (paint pixels) */
const ROOM = 80, CEIL = 12, FLOOR = 56, SHAFT = 9;

const rngOf = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const shade = (hex: string, k: number): string => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

/**
 * The ground under the base, seen cut open (spec 2026-10-09 §1, after Fallout Shelter): a wall standing in the cut, painted —
 * topsoil, then a band of rock per floor in its zone's colour; a room where someone has stood (lamps, what its zone keeps
 * there, its guardian), the lift's shaft down from under the core with a door at each stop and the car at the one chosen,
 * stairs from room to room below the last stop, a beacon on a kept floor. Repainted only when what is known changes.
 */
export class StrataView {
  readonly root = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private key = '';

  constructor() {
    this.canvas.width = STRATA.width * STRATA.px; this.canvas.height = STRATA.depth * STRATA.px;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.magFilter = THREE.NearestFilter; this.tex.minFilter = THREE.NearestFilter; this.tex.generateMipmaps = false;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(STRATA.width, STRATA.depth), new THREE.MeshBasicMaterial({ map: this.tex, fog: false }));
    wall.position.y = -STRATA.depth / 2;
    this.root.add(wall);
  }

  /** The wall stands in the cut under the core (`x`, `z` in the scene); `dest`: the floor the lift's car waits at. */
  sync(x: number, z: number, rows: FloorRow[], dest: number): void {
    this.root.position.set(x, 0, z);
    const key = rows.map((r) => `${+r.reached}${+r.passed}${+r.stop}${+r.kept}${+!!r.next}`).join('') + dest;
    if (key === this.key) return;
    this.key = key;
    this.paint(rows, dest);
    this.tex.needsUpdate = true;
  }

  private paint(rows: FloorRow[], dest: number): void {
    const g = this.canvas.getContext('2d')!, W = this.canvas.width, H = this.canvas.height, px = STRATA.px, cx = W / 2, fh = STRATA.floor * px;
    const rnd = rngOf(77), y0 = (n: number) => Math.round(floorTop(n) * px);
    const box = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const glow = (c: string, x: number, y: number, r: number) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, c); q.addColorStop(1, '#0000'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); };
    box('#120d08', 0, 0, W, H);
    // topsoil under a lip of grass
    box('#3a1814', 0, 0, W, y0(1)); box('#0f4a26', 0, 0, W, 3); box('#0a301a', 0, 3, W, 2);
    for (let k = 0; k < 500; k++) box(rnd() < 0.5 ? '#571f18' : '#22100e', rnd() * W, 5 + rnd() * (y0(1) - 6), 2 + rnd() * 3, 1 + rnd() * 2);
    for (const r of rows) {
      // (a floor nobody has stood on is the same rock, in the dark)
      const c = ROCK[r.zoneId], dim = r.reached ? 1 : 0.62, top = y0(r.floor);
      box(shade(c.rock, dim), 0, top, W, fh);
      for (let k = 0; k < 260; k++) box(shade(rnd() < 0.5 ? c.dark : c.light, dim), rnd() * W, top + rnd() * fh, 3 + rnd() * 9, 1 + rnd() * 3);
      box(shade(c.dark, dim * 0.7), 0, top + fh - 2, W, 2);
    }
    const stops = rows.filter((r) => r.stop).map((r) => r.floor), last = stops.at(-1) ?? 1, next = rows.find((r) => r.next)?.floor;
    // stairs from one room down to the next, on alternate sides
    for (const r of rows) if (r.reached && rows[r.floor]?.reached) { const x = cx + (r.floor % 2 ? 52 : -64); box('#060508', x, y0(r.floor) + FLOOR, 12, fh - FLOOR + CEIL); for (let k = 0; k < 5; k++) box('#3a4466', x + (r.floor % 2 ? k * 2 : 10 - k * 2), y0(r.floor) + FLOOR + 2 + k * 4, 3, 1); }
    for (const r of rows) {
      if (!r.reached && !r.stop) continue;
      const c = ROCK[r.zoneId], top = y0(r.floor), half = r.reached ? ROOM : 30, x0 = cx - half, w = half * 2;
      box(c.room, x0, top + CEIL, w, FLOOR - CEIL); box(shade(c.light, 1.3), x0, top + FLOOR, w, 3); box(shade(c.dark, 0.6), x0, top + CEIL - 2, w, 2);
      if (r.reached) this.furnish(g, r, c, cx, top, rnd, box);
      // lamps at the ceiling
      for (const lx of r.reached ? [cx - 46, cx + 46] : [cx + 18]) { glow('#ffb84060', lx, top + CEIL + 4, 26); box('#ffe9a0', lx - 1, top + CEIL, 3, 3); }
      if (r.kept) { glow('#ffc82080', cx - 30, top + FLOOR - 14, 22); box('#6a5a3a', cx - 31, top + FLOOR - 12, 2, 12); box('#ffd23a', cx - 33, top + FLOOR - 17, 6, 6); }
    }
    // the lift's shaft from under the core to its last stop; the stretch it could be driven on to, in outline
    const shaftTo = y0(last) + FLOOR;
    box('#050505', cx - SHAFT, 0, SHAFT * 2, shaftTo); box('#6a6a5e', cx - SHAFT, 0, 2, shaftTo); box('#6a6a5e', cx + SHAFT - 2, 0, 2, shaftTo);
    for (let y = 6; y < shaftTo; y += 8) box('#26261f', cx - SHAFT + 2, y, SHAFT * 2 - 4, 1);
    if (next) for (let y = shaftTo + 2; y < y0(next) + FLOOR; y += 6) { box('#1e7a40', cx - SHAFT, y, 2, 3); box('#1e7a40', cx + SHAFT - 2, y, 2, 3); }
    for (const n of stops) {
      const top = y0(n), on = n === dest;
      box('#a8a898', cx - SHAFT - 4, top + 28, SHAFT * 2 + 8, 2); box('#a8a898', cx - SHAFT - 4, top + 28, 2, FLOOR - 28); box('#a8a898', cx + SHAFT + 2, top + 28, 2, FLOOR - 28);
      box(on ? '#30ff80' : '#1a6a3a', cx - 2, top + 23, 4, 3);
      if (on) { glow('#ffd86060', cx, top + 42, 24); box('#181008', cx - 9, top + 31, 18, FLOOR - 31); box('#e08010', cx - 8, top + 32, 16, FLOOR - 33); box('#fff2b0', cx - 5, top + 35, 10, 8); box('#181008', cx - 1, top + 35, 2, 8); }
    }
  }

  /** What a room holds, by its zone: a cave's teeth of stone and ore, a crypt's niches and coffins, the ruins' pillars; and its guardian. */
  private furnish(g: CanvasRenderingContext2D, r: FloorRow, c: (typeof ROCK)[ZoneId], cx: number, top: number, rnd: () => number, box: (c: string, x: number, y: number, w: number, h: number) => void): void {
    const x0 = cx - ROOM, w = ROOM * 2;
    for (let k = 0; k < 40; k++) box(c.back, x0 + rnd() * (w - 8), top + CEIL + rnd() * (FLOOR - CEIL - 4), 3 + rnd() * 8, 2 + rnd() * 3);
    if (r.zoneId === 'cave') {
      for (let k = 0; k < 9; k++) { const x = x0 + 6 + rnd() * (w - 12), h = 3 + rnd() * 7, up = rnd() < 0.5; for (let i = 0; i < h; i++) box(c.dark, x - (h - i) / 3, up ? top + CEIL + i : top + FLOOR - 1 - i, 1 + ((h - i) * 2) / 3, 1); }
      for (let k = 0; k < 3; k++) { const x = x0 + 14 + rnd() * (w - 28); box(c.accent, x, top + FLOOR - 5, 3, 5); box(shade(c.accent, 1.5), x + 1, top + FLOOR - 7, 1, 3); }
    } else if (r.zoneId === 'crypt') {
      for (let y = top + CEIL + 7; y < top + FLOOR; y += 8) box(c.back, x0, y, w, 1);
      for (const dx of [-58, -34, 34, 58]) { box('#06070c', cx + dx - 7, top + 24, 14, FLOOR - 24); box('#06070c', cx + dx - 5, top + 21, 10, 3); box(c.light, cx + dx - 4, top + FLOOR - 9, 8, 9); box(c.accent, cx + dx - 1, top + FLOOR - 13, 2, 3); }
    } else {
      for (const dx of [-62, -38, 38, 62]) { box(c.light, cx + dx - 4, top + CEIL + 3, 8, FLOOR - CEIL - 3); box(shade(c.light, 1.25), cx + dx - 6, top + CEIL, 12, 3); box(shade(c.light, 1.25), cx + dx - 6, top + FLOOR - 3, 12, 3); }
      for (const dx of [-50, 50]) { box(c.accent, cx + dx - 2, top + 30, 4, 1); box(c.accent, cx + dx - 1, top + 28, 1, 6); }
    }
    if (!r.boss) return;
    // the zone's guardian, at the room's far side: awake (its eyes lit) until someone has gone on below it
    const bx = cx + 40;
    if (r.passed) { box('#3a3a3a', bx - 12, top + FLOOR - 4, 24, 4); box('#2a2a2a', bx - 6, top + FLOOR - 8, 10, 4); return; }
    box('#0a0507', bx - 11, top + 26, 22, FLOOR - 26); box('#0a0507', bx - 7, top + 19, 14, 8); box('#0a0507', bx - 15, top + 32, 4, 14); box('#0a0507', bx + 11, top + 32, 4, 14);
    box('#ff0030', bx - 5, top + 22, 3, 2); box('#ff0030', bx + 2, top + 22, 3, 2);
    const q = g.createRadialGradient(bx, top + 23, 0, bx, top + 23, 22); q.addColorStop(0, '#ff203050'); q.addColorStop(1, '#0000'); g.fillStyle = q; g.fillRect(bx - 22, top + 1, 44, 44);
  }

  dispose(): void { this.tex.dispose(); this.root.clear(); }
}
