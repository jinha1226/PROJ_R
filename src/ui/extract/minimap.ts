import type { Region } from '../../sim/extract/regionTypes';
import type { HudState } from './hudState';
import { POI_NAME } from './names';

const MAP_W = 180;
const MAP_H = 135;
const FOG_CELL = 6;

/** The region map: explored ground (remembered here), places, exits, the party and the leader. */
export class Minimap {
  readonly el = document.createElement('canvas');
  private readonly seen = new Set<number>();

  constructor(private readonly bounds: Region['bounds']) {
    this.el.className = 'xhud-map';
    this.el.width = MAP_W;
    this.el.height = MAP_H;
  }

  draw(m: HudState['minimap']): void {
    const g = this.el.getContext('2d');
    if (!g) return;
    const b = this.bounds;
    const sx = MAP_W / (b.maxX - b.minX);
    const sy = MAP_H / (b.maxY - b.minY);
    const at = (x: number, y: number): [number, number] => [(x - b.minX) * sx, (y - b.minY) * sy];
    const cols = Math.ceil((b.maxX - b.minX) / FOG_CELL);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      const cx = Math.floor((m.hero.x - b.minX) / FOG_CELL) + dx;
      const cy = Math.floor((m.hero.y - b.minY) / FOG_CELL) + dy;
      if (cx >= 0 && cy >= 0) this.seen.add(cy * cols + cx);
    }
    g.fillStyle = '#10131a';
    g.fillRect(0, 0, MAP_W, MAP_H);
    g.fillStyle = '#3b4a33';
    for (const k of this.seen) g.fillRect((k % cols) * FOG_CELL * sx, Math.floor(k / cols) * FOG_CELL * sy, FOG_CELL * sx + 0.5, FOG_CELL * sy + 0.5);
    g.font = '9px sans-serif';
    for (const p of m.pois) {
      const [x, y] = at(p.x, p.y);
      g.fillStyle = p.risk === 3 ? '#e06040' : p.risk === 2 ? '#e0b040' : '#c8c8c8';
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d8d0c0';
      g.fillText(POI_NAME[p.kind].slice(0, 4), x + 4, y + 3);
    }
    for (const e of m.extracts) {
      const [x, y] = at(e.x, e.y);
      g.strokeStyle = e.closed ? '#d04a3a' : '#5fe08a';
      g.lineWidth = 2;
      g.strokeRect(x - 4, y - 4, 8, 8);
    }
    for (const u of m.party) {
      const [px, py] = at(u.x, u.y);
      g.fillStyle = u.down ? '#d04a3a' : '#9fd0ff';
      g.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    const [hx, hy] = at(m.hero.x, m.hero.y);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(hx, hy, 3.5, 0, Math.PI * 2);
    g.fill();
  }
}
