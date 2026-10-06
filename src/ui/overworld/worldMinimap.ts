import { entOf } from '../../sim/party/partyCore';
import type { Cell } from '../../sim/grid/types';
import type { Ground } from '../../sim/overworld/worldGen';
import { clones, type WorldParty } from '../../sim/overworld/worldSim';

const SHADE: Record<Ground, [number, number, number]> = {
  grass: [70, 110, 50], forest: [45, 75, 38], tree: [30, 60, 30], rock: [100, 96, 90], water: [40, 80, 130], ford: [80, 120, 140],
  dirt: [120, 96, 66], ruin: [110, 100, 88], ruinWall: [90, 84, 76], ship: [150, 200, 230], camp: [120, 90, 56],
  boulder: [120, 116, 108], log: [100, 76, 50], lowWall: [130, 122, 110], barricade: [110, 80, 50], wreck: [200, 110, 50], totem: [200, 40, 40], obelisk: [220, 40, 60], brazier: [90, 220, 140], drill: [255, 200, 90], cloner: [90, 220, 255],
};

/** The explored land at a glance: ground, claimed land, camps (red awake, cyan taken), the party; a click asks for a walk there. */
export class WorldMinimap {
  readonly el = document.createElement('canvas');
  private readonly img: ImageData;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly p: WorldParty, onPick: (c: Cell) => void) {
    const m = p.s.map;
    this.el.className = 'wd-mini';
    this.el.width = m.w; this.el.height = m.h;
    this.ctx = this.el.getContext('2d')!;
    this.img = this.ctx.createImageData(m.w, m.h);
    this.el.addEventListener('pointerup', (e) => {
      const r = this.el.getBoundingClientRect();
      onPick({ x: Math.floor(((e.clientX - r.left) / r.width) * m.w), y: Math.floor(((e.clientY - r.top) / r.height) * m.h) });
    });
  }

  draw(): void {
    const p = this.p, m = p.s.map, d = this.img.data;
    for (let i = 0; i < m.w * m.h; i++) {
      const [r, g, b] = p.s.seen[i] ? SHADE[p.ground[i]!] : [6, 8, 10];
      const lit = p.s.visible.has(i) ? 1.15 : 0.7, own = p.claimed[i] && p.s.seen[i] ? 1 : 0;
      d[i * 4] = Math.min(255, r * lit * (own ? 0.8 : 1)); d[i * 4 + 1] = Math.min(255, g * lit + own * 18); d[i * 4 + 2] = Math.min(255, b * lit + own * 40); d[i * 4 + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    for (const c of p.camps) {
      if (!p.s.seen[c.pos.y * m.w + c.pos.x]) continue;
      this.ctx.fillStyle = c.cleared ? '#5ae0ff' : '#ff4a3a';
      this.ctx.fillRect(c.pos.x - 1, c.pos.y - 1, 3, 3);
    }
    this.ctx.fillStyle = '#c8a8ff';
    for (const s of p.souls) if (!s.taken && p.s.seen[s.pos.y * m.w + s.pos.x]) this.ctx.fillRect(s.pos.x - 1, s.pos.y - 1, 2, 2);
    this.ctx.fillStyle = '#e6ffb0';
    for (const u of clones(p)) { const e = entOf(p, u.id); if (e?.alive) this.ctx.fillRect(e.pos.x - 1, e.pos.y - 1, 2, 2); }
  }
}
