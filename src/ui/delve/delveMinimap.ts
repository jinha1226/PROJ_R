import { idx } from '../../sim/grid/types';
import { entOf } from '../../sim/party/partyCore';
import { clones } from '../../sim/roam/roam';
import type { DelveParty } from '../../sim/delve/delveSim';
import { phoneUpright } from '../overworld/touchView';

const PX = 3;
const MARGIN = 2;
/** on an upright phone the map is a window round the clone, this many cells to each side (one dot of it lands on one dot of the screen) */
const NEAR = 14;
const C = { wall: '#1f7a3e', floor: '#0e3a1c', seen: '#08200f', door: '#34a85c', clone: '#e6ffb0', foe: '#ff5a4a', stairs: '#5dd3ff', soul: '#c8a8ff', lift: '#5ae0ff' };

/**
 * The floor seen so far in the terminal colours: walls, floor, doors, the stairs, the way back up (a ring), souls, foes in
 * sight and the clones. All of it, fitted to the panel — or, on an upright phone, the part round the chosen clone at a
 * fixed scale, with the stairs, the way up and souls out of the window held at its edge (which way they lie).
 */
export class DelveMinimap {
  readonly el = document.createElement('canvas');
  private key = '';

  constructor(private readonly p: () => DelveParty, private readonly focus?: () => string) { this.el.className = 'delve-mini'; }

  draw(): void {
    const p = this.p(), s = p.s, { w, h } = s.map;
    const me = phoneUpright() && this.focus ? entOf(p, this.focus())?.pos : undefined;
    const key = `${p.floor}|${s.time.toFixed(1)}|${p.souls.filter((x) => x.taken).length}|${me ? `${me.x},${me.y}` : ''}`;
    if (key === this.key) return;
    this.key = key;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < w * h; i++) if (s.seen[i]) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x0 > x1) { x0 = x1 = p.base.x; y0 = y1 = p.base.y; }
    // a square view so the panel keeps its shape as the floor opens up
    const side = me ? NEAR * 2 : Math.max(x1 - x0, y1 - y0, 20) + MARGIN * 2;
    const cx = me ? me.x : (x0 + x1) >> 1, cy = me ? me.y : (y0 + y1) >> 1;
    x0 = cx - (side >> 1); y0 = cy - (side >> 1);
    const size = (side + 1) * PX;
    if (this.el.width !== size) { this.el.width = size; this.el.height = size; }
    const g = this.el.getContext('2d');
    if (!g) return;
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    const dot = (x: number, y: number, color: string, k = PX) => { g.fillStyle = color; g.fillRect((x - x0) * PX + (PX - k) / 2, (y - y0) * PX + (PX - k) / 2, k, k); };
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y0 + side); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x0 + side); x++) {
      const i = y * w + x;
      if (!s.seen[i]) continue;
      const t = s.map.tiles[i];
      if (t === 'wall' || t === 'pillar') { if (t === 'pillar' || borders(p, x, y)) dot(x, y, C.wall); continue; }
      dot(x, y, t === 'door' || t === 'open' ? C.door : s.visible.has(i) ? C.floor : C.seen);
    }
    // (a place of note outside the window is held at its edge)
    const far = (x: number, y: number, color: string, k: number) => dot(Math.max(x0, Math.min(x0 + side, x)), Math.max(y0, Math.min(y0 + side, y)), color, k);
    if (s.map.stairs && s.seen[idx(s.map, s.map.stairs)]) far(s.map.stairs.x, s.map.stairs.y, C.stairs, PX + 2);
    far(p.base.x, p.base.y, C.lift, PX + 4); far(p.base.x, p.base.y, '#000', PX);
    for (const soul of p.souls) if (!soul.taken && s.seen[idx(s.map, soul.pos)]) far(soul.pos.x, soul.pos.y, C.soul, PX + 1);
    for (const u of p.units) {
      const e = entOf(p, u.id);
      if (u.side === 'foe' && e?.alive && s.visible.has(idx(s.map, e.pos))) dot(e.pos.x, e.pos.y, C.foe);
    }
    for (const u of clones(p)) { const e = entOf(p, u.id); if (e?.alive) dot(e.pos.x, e.pos.y, C.clone, PX + 1); }
  }
}

function borders(p: DelveParty, x: number, y: number): boolean {
  const s = p.s;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.map.w || ny >= s.map.h) continue;
    const i = ny * s.map.w + nx;
    if (s.seen[i] && s.map.tiles[i] !== 'wall') return true;
  }
  return false;
}
