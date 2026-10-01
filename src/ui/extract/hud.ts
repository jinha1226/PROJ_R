import { carriedValue, carryLimit, quickSlots, totalWeight } from '../../sim/extract/loadout';
import { phaseOf, SEC } from '../../sim/world/clock';
import type { Nearby } from '../../sim/world/interact';
import type { WorldState } from '../../sim/world/types';
import { heroUnit } from '../../sim/world/worldState';
import { itemCell } from './itemCell';
import { ALERT, CHANNEL_NAME, PHASE_NAME, POI_NAME, PROMPT } from './names';

const MAP_W = 180;
const MAP_H = 135;
const FOG_CELL = 6;

/** Sortie HUD: health, carried value, clock, minimap, quick slots, channel bar, prompt and alerts. */
export class Hud {
  readonly el = document.createElement('div');
  private readonly map: HTMLCanvasElement;
  private readonly seen = new Set<number>();
  private lastEvent = 0;
  private alertTimer = 0;
  private quickKey = '';

  constructor() {
    this.el.className = 'xhud';
    this.el.innerHTML = `<div class="xhud-top">
        <div class="xhud-hp"><div class="xhud-hpbar"><div></div></div><span></span></div>
        <div class="xhud-value" data-testid="carried-value"></div>
        <div class="xhud-clock" data-testid="clock"></div>
        <div class="xhud-auto" hidden>자동 전투</div>
      </div>
      <canvas class="xhud-map" width="${MAP_W}" height="${MAP_H}"></canvas>
      <div class="xhud-channel" hidden><span></span><div><div></div></div></div>
      <div class="xhud-prompt" data-testid="prompt" hidden></div>
      <div class="xhud-alert" hidden></div>
      <div class="xhud-quick"></div>
      <div class="xhud-help muted">WASD 이동 · J 공격 · K/L 기술 · ; 궁극기 · 1~4 물약 · E 줍기 · Tab 자동 · Esc 일시정지</div>`;
    this.map = this.el.querySelector('canvas')!;
  }

  update(w: WorldState, nearby: Nearby, auto: boolean, dt: number): void {
    const h = heroUnit(w);
    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    q('.xhud-hpbar > div').style.width = `${Math.max(0, (h.hp / h.maxHp) * 100)}%`;
    q('.xhud-hp span').textContent = `${Math.max(0, Math.ceil(h.hp))} / ${h.maxHp}`;
    const l = w.hero.loadout;
    q('.xhud-value').innerHTML = `들고 있는 가치 <b>${carriedValue(l)}G</b> <small>무게 ${totalWeight(l)} / ${carryLimit(l)}</small>`;
    const sec = Math.floor(w.b.tick / SEC);
    const phase = phaseOf(w.b.tick);
    q('.xhud-clock').innerHTML = `<b>${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}</b> ${PHASE_NAME[phase]}`;
    q('.xhud-clock').className = `xhud-clock ph-${phase}`;
    q('.xhud-auto').hidden = !auto;
    const dr = w.hero.drink;
    const ch = w.hero.channel ?? (dr ? { kind: 'drink', ticks: dr.ticks, total: dr.total } : undefined);
    q('.xhud-channel').hidden = !ch;
    if (ch) {
      q('.xhud-channel span').textContent = CHANNEL_NAME[ch.kind] ?? '';
      q('.xhud-channel div div').style.width = `${(ch.ticks / ch.total) * 100}%`;
    }
    q('.xhud-prompt').hidden = !nearby || !!ch;
    if (nearby) q('.xhud-prompt').innerHTML = `<b>E</b> / Ⓑ ${PROMPT[nearby.kind]}`;
    const quickKey = JSON.stringify(l.quick) + quickSlots(l);
    if (quickKey !== this.quickKey) {
      this.quickKey = quickKey;
      q('.xhud-quick').innerHTML = Array.from({ length: quickSlots(l) }, (_, i) => `<div class="xq"><small>${i + 1}</small>${itemCell(l.quick[i], { small: true })}</div>`).join('');
    }
    this.alerts(w, dt);
    this.drawMap(w);
  }

  private alerts(w: WorldState, dt: number): void {
    const el = this.el.querySelector<HTMLElement>('.xhud-alert')!;
    for (; this.lastEvent < w.events.length; this.lastEvent++) {
      const e = w.events[this.lastEvent]!;
      const text = ALERT[e.type];
      if (!text) continue;
      el.textContent = text;
      el.className = `xhud-alert a-${e.type}`;
      el.hidden = false;
      this.alertTimer = 3;
    }
    this.alertTimer -= dt;
    if (this.alertTimer <= 0) el.hidden = true;
  }

  private drawMap(w: WorldState): void {
    const g = this.map.getContext('2d');
    if (!g) return;
    const b = w.region.bounds;
    const sx = MAP_W / (b.maxX - b.minX);
    const sy = MAP_H / (b.maxY - b.minY);
    const at = (x: number, y: number): [number, number] => [(x - b.minX) * sx, (y - b.minY) * sy];
    const h = heroUnit(w).pos;
    const cols = Math.ceil((b.maxX - b.minX) / FOG_CELL);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      const cx = Math.floor((h.x - b.minX) / FOG_CELL) + dx;
      const cy = Math.floor((h.y - b.minY) / FOG_CELL) + dy;
      if (cx >= 0 && cy >= 0) this.seen.add(cy * cols + cx);
    }
    g.fillStyle = '#10131a';
    g.fillRect(0, 0, MAP_W, MAP_H);
    g.fillStyle = '#3b4a33';
    for (const k of this.seen) g.fillRect((k % cols) * FOG_CELL * sx, Math.floor(k / cols) * FOG_CELL * sy, FOG_CELL * sx + 0.5, FOG_CELL * sy + 0.5);
    g.font = '9px sans-serif';
    for (const p of w.region.pois) {
      const [x, y] = at(p.center.x, p.center.y);
      g.fillStyle = p.risk === 3 ? '#e06040' : p.risk === 2 ? '#e0b040' : '#c8c8c8';
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d8d0c0';
      g.fillText(POI_NAME[p.kind].slice(0, 4), x + 4, y + 3);
    }
    for (const e of w.region.extracts) {
      const [x, y] = at(e.pos.x, e.pos.y);
      g.strokeStyle = w.closed.includes(e.id) ? '#d04a3a' : '#5fe08a';
      g.lineWidth = 2;
      g.strokeRect(x - 4, y - 4, 8, 8);
    }
    const [hx, hy] = at(h.x, h.y);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(hx, hy, 3.5, 0, Math.PI * 2);
    g.fill();
  }
}
