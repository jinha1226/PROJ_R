import { idx, type GridState } from '../../sim/grid/types';

/** pixels per cell on the small map (the canvas is drawn at this size and scaled with hard pixels by CSS) */
const PX = 3;
/** cells of margin round what has been seen */
const MARGIN = 2;
const C = { wall: '#1f7a3e', floor: '#0e3a1c', seen: '#08200f', door: '#34a85c', hero: '#e6ffb0', foe: '#ff5a4a', stairs: '#5dd3ff', chest: '#ffc94a', item: '#c77dff' };

/** A small map of what the hero has seen, in the terminal colours: walls, floor, the hero, foes in sight, the stairs, chests and finds. */
export class MiniMap {
  readonly el = document.createElement('canvas');
  private key = '';

  constructor() {
    this.el.className = 'grid-minimap';
    this.el.dataset.testid = 'grid-minimap';
  }

  /** the widest it may get: the HUD column in landscape, narrower on a phone held upright */
  private maxWidth(): number { return this.el.closest('.landscape') ? 216 : 132; }

  draw(s: GridState): void {
    // only when something it shows has changed
    const key = `${s.map.w}x${s.map.h}|${s.time}|${s.hero.pos.x},${s.hero.pos.y}|${s.foes.filter((f) => f.alive).length}|${s.floorItems.length}`;
    if (key === this.key) return;
    this.key = key;
    const { w, h } = s.map;
    // only the part seen so far (with a margin), so the map grows as the floor is explored
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < w * h; i++) if (s.seen[i]) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x0 > x1) { x0 = x1 = s.hero.pos.x; y0 = y1 = s.hero.pos.y; }
    x0 = Math.max(0, x0 - MARGIN); y0 = Math.max(0, y0 - MARGIN); x1 = Math.min(w - 1, x1 + MARGIN); y1 = Math.min(h - 1, y1 + MARGIN);
    const cw = (x1 - x0 + 1) * PX, ch = (y1 - y0 + 1) * PX;
    if (this.el.width !== cw || this.el.height !== ch) { this.el.width = cw; this.el.height = ch; }
    // shown at a fixed cell size until it reaches the panel's width
    this.el.style.width = `${Math.min(this.maxWidth(), cw * 2)}px`;
    const g = this.el.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, cw, ch);
    const dot = (x: number, y: number, color: string, size = PX) => { g.fillStyle = color; g.fillRect((x - x0) * PX + (PX - size) / 2, (y - y0) * PX + (PX - size) / 2, size, size); };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (!s.seen[i]) continue;
      const t = s.map.tiles[i];
      // a wall is only drawn where it borders floor the hero has seen
      if (t === 'wall') { if (bordersFloor(s, x, y)) dot(x, y, C.wall); continue; }
      dot(x, y, t === 'door' || t === 'open' ? C.door : s.visible.has(i) ? C.floor : C.seen);
    }
    for (const c of s.chests) if (!c.opened && s.seen[idx(s.map, c.pos)]) dot(c.pos.x, c.pos.y, C.chest);
    for (const f of s.floorItems) if (s.seen[idx(s.map, f.pos)]) dot(f.pos.x, f.pos.y, C.item, PX - 1);
    if (s.map.stairs && s.seen[idx(s.map, s.map.stairs)]) dot(s.map.stairs.x, s.map.stairs.y, C.stairs);
    for (const f of s.foes) if (f.alive && s.visible.has(idx(s.map, f.pos))) dot(f.pos.x, f.pos.y, C.foe);
    dot(s.hero.pos.x, s.hero.pos.y, C.hero);
  }
}

function bordersFloor(s: GridState, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.map.w || ny >= s.map.h) continue;
    const i = ny * s.map.w + nx;
    if (s.seen[i] && s.map.tiles[i] !== 'wall') return true;
  }
  return false;
}
