import { bagSlots, carriedValue, carryLimit, totalWeight } from '../../sim/extract/loadout';
import { phaseOf, SEC } from '../../sim/world/clock';
import type { Nearby } from '../../sim/world/interact';
import type { WorldState } from '../../sim/world/types';
import { heroUnit } from '../../sim/world/worldState';
import { partyUnits } from '../../sim/world/party';
import { ALERT, CHANNEL_NAME, PHASE_NAME, POI_NAME, PROMPT } from './names';

const MAP_W = 180;
const MAP_H = 135;
const FOG_CELL = 6;

export type Order = 'focus' | 'retreat' | 'regroup' | 'pick';
const ORDERS: { k: Order; label: string; key: string }[] = [
  { k: 'focus', label: '집중 공격', key: 'F' }, { k: 'retreat', label: '후퇴', key: 'R' }, { k: 'regroup', label: '재집결', key: 'G' },
];
const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Sortie HUD: party status, carried value, clock, minimap, orders, channel bar, prompt and alerts. */
export class Hud {
  readonly el = document.createElement('div');
  private readonly map: HTMLCanvasElement;
  private readonly seen = new Set<number>();
  private lastEvent = 0;
  private alertTimer = 0;
  private partyKey = '';
  private readonly clicked = new Set<Order>();

  constructor() {
    this.el.className = 'xhud';
    this.el.innerHTML = `<div class="xhud-top">
        <div class="xhud-value" data-testid="carried-value"></div>
        <div class="xhud-clock" data-testid="clock"></div>
        <div class="xhud-mode" hidden>전투 중</div>
      </div>
      <div class="xhud-party" data-testid="party-status"></div>
      <canvas class="xhud-map" width="${MAP_W}" height="${MAP_H}"></canvas>
      <div class="xhud-channel" hidden><span></span><div><div></div></div></div>
      <div class="xhud-prompt" data-testid="prompt" hidden></div>
      <div class="xhud-alert" hidden></div>
      <div class="xhud-orders">${ORDERS.map((o) => `<button class="btn" data-order="${o.k}" data-testid="order-${o.k}"><b>${o.key}</b> ${o.label}</button>`).join('')}
        <button class="btn primary" data-order="pick" data-testid="order-pick" hidden><b>E</b> <span></span></button></div>
      <div class="xhud-help muted">WASD 리더 이동 · F 집중 · R 후퇴 · G 재집결 · E 조사 · Esc 짐/일시정지 · Z X 카메라</div>`;
    this.map = this.el.querySelector('canvas')!;
    this.el.querySelector('.xhud-orders')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-order]')?.dataset.order as Order | undefined;
      if (k) this.clicked.add(k);
    });
  }

  /** An order clicked on screen since the last frame (consumed once). */
  takeOrder(k: Order): boolean {
    return this.clicked.delete(k);
  }

  update(w: WorldState, nearby: Nearby, dt: number): void {
    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    const l = w.hero.loadout;
    q('.xhud-value').innerHTML = `들고 있는 가치 <b>${carriedValue(l)}G</b> <small>짐 ${l.bag.length}/${bagSlots(l)}칸 · 무게 ${totalWeight(l)} / ${carryLimit(l)}</small>`;
    const sec = Math.floor(w.b.tick / SEC);
    const phase = phaseOf(w.b.tick);
    q('.xhud-clock').innerHTML = `<b>${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}</b> ${PHASE_NAME[phase]}`;
    q('.xhud-clock').className = `xhud-clock ph-${phase}`;
    q('.xhud-mode').hidden = w.party.mode !== 'combat';
    this.party(w);
    const dr = w.hero.drink;
    const ch = w.hero.channel ?? (dr ? { kind: 'drink', ticks: dr.ticks, total: dr.total } : undefined);
    q('.xhud-channel').hidden = !ch;
    if (ch) {
      q('.xhud-channel span').textContent = 'waiting' in ch && ch.waiting ? '모두 탈출 지점 안으로 들어와야 한다' : CHANNEL_NAME[ch.kind] ?? '';
      q('.xhud-channel div div').style.width = `${(ch.ticks / ch.total) * 100}%`;
    }
    const prompt = !!nearby && !w.hero.channel;
    q('.xhud-prompt').hidden = !prompt;
    if (nearby) q('.xhud-prompt').innerHTML = `<b>E</b> / Ⓑ ${PROMPT[nearby.kind]}`;
    const pick = q('[data-order="pick"]');
    pick.hidden = !prompt;
    if (nearby) q('[data-order="pick"] span').textContent = PROMPT[nearby.kind] ?? '';
    this.alerts(w, dt);
    this.drawMap(w);
  }

  private party(w: WorldState): void {
    const rows = w.party.order.map((id) => {
      const u = w.b.units.find((x) => x.id === id);
      const m = w.party.mercs[id]!;
      const dead = !u?.alive;
      const hp = dead || !u ? 0 : u.downed ? 0 : u.hp / u.maxHp;
      return { id, name: m.name, color: m.color, dead, down: !!u?.downed, hp, lead: id === w.heroId };
    });
    const key = JSON.stringify(rows.map((r) => [r.id, r.dead, r.down, Math.round(r.hp * 40), r.lead]));
    if (key === this.partyKey) return;
    this.partyKey = key;
    this.el.querySelector('.xhud-party')!.innerHTML = rows.map((r) => `<div class="xp-row ${r.dead ? 'dead' : r.down ? 'down' : ''}" style="--c:${r.color}">
      <span class="xp-dot"></span><b>${esc(r.name)}${r.lead ? ' <i>리더</i>' : ''}</b><div class="xp-hp"><div style="width:${Math.round(r.hp * 100)}%"></div></div>
      <small>${r.dead ? '전사' : r.down ? '쓰러짐' : ''}</small></div>`).join('');
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
    for (const u of partyUnits(w)) {
      const [px, py] = at(u.pos.x, u.pos.y);
      g.fillStyle = u.downed ? '#d04a3a' : '#9fd0ff';
      g.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    const [hx, hy] = at(h.x, h.y);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(hx, hy, 3.5, 0, Math.PI * 2);
    g.fill();
  }
}
