import type { Cell, GEvent } from '../../sim/grid/types';
import { alive, entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { queueUltimate, ULT_NAMES, ultSlots } from '../../sim/party/ultimate';
import type { WorldParty } from '../../sim/overworld/worldSim';

const KEYS: Record<string, [number, number]> = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0], arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0] };

/** the clones at the base, in the order they were made (keys 1 2 3 …) */
export const raidClones = (p: WorldParty): string[] => p.units.filter((u) => u.side === 'hero' && !u.summoner && alive(p, u)).map((u) => u.id);

/** The ultimate bar: each clone's ultimate with its cooldown (turns left), the one being aimed lit; the speed buttons. */
export function ultBarHtml(p: WorldParty, aiming: { id: string; slot: number } | null, speed: number): string {
  const slots = raidClones(p).flatMap((id) => ultSlots(unitOf(p, id)!).map((s) => ({ id, s })));
  const btn = slots.map(({ id, s }) => {
    const left = Math.ceil(s.ready - p.time), on = aiming?.id === id && aiming.slot === s.slot;
    return `<button type="button" data-ult="${id}:${s.slot}" class="${on ? 'on' : ''}" ${left > 0 ? 'disabled' : ''}><b>${CLASSES[unitOf(p, id)!.cls!].name}</b><span>${ULT_NAMES[s.ult]}</span>${left > 0 ? `<em>${left}</em>` : ''}</button>`;
  }).join('');
  return `<div class="ub-slots">${btn}</div><div class="ub-side">${aiming ? '<small>칸 선택 · Esc 취소</small>' : ''}${[1, 2].map((v) => `<button type="button" data-speed="${v}" class="${speed === v ? 'on' : ''}">${v}×</button>`).join('')}</div>`;
}

/**
 * Raid mode's hands (spec 2026-10-08 §3): pick clones (click, shift-click, drag a box), right-click the ground to send them
 * there (they hold it) or a foe to set on it; a number key or a double-click drives that clone with WASD (again to let go);
 * the ultimate bar fires any clone's ultimate at a cell. On touch: tap a clone, then tap the ground or a foe.
 */
export class RaidControl {
  readonly bar = document.createElement('div');
  readonly box = document.createElement('div');
  readonly selected = new Set<string>();
  aiming: { id: string; slot: number } | null = null;
  driving: string | null = null;
  on = false;
  private readonly held = new Set<string>();
  private down: { x: number; y: number; box: boolean } | null = null;
  private lastTap = { id: '', at: 0 };
  private html = '';

  constructor(private readonly p: () => WorldParty, private readonly view: {
    cellAt: (x: number, y: number) => Cell | null; screenOf: (id: string) => { left: number; top: number } | null;
    speed: () => number; setSpeed: (v: number) => void; live: (ev: GEvent[]) => void;
  }) {
    this.bar.className = 'ult-bar'; this.bar.hidden = true;
    this.box.className = 'sel-box'; this.box.hidden = true;
    this.bar.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
      if (b.dataset.ult) { const [id, slot] = b.dataset.ult.split(':'); this.aiming = { id: id!, slot: Number(slot) }; }
      if (b.dataset.speed) this.view.setSpeed(Number(b.dataset.speed));
      this.html = '';
    });
    addEventListener('keydown', (e) => this.key(e));
    addEventListener('keyup', (e) => { this.held.delete(e.key.toLowerCase()); });
  }

  attach(stage: HTMLElement): void {
    stage.addEventListener('pointerdown', (e) => { if (this.on && e.button === 0) this.down = { x: e.clientX, y: e.clientY, box: false }; });
    addEventListener('pointermove', (e) => {
      const d = this.down; if (!d || !this.on || e.pointerType === 'touch') return;
      if (!d.box && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
      d.box = true; this.box.hidden = false;
      Object.assign(this.box.style, { left: `${Math.min(d.x, e.clientX)}px`, top: `${Math.min(d.y, e.clientY)}px`, width: `${Math.abs(e.clientX - d.x)}px`, height: `${Math.abs(e.clientY - d.y)}px` });
    });
    stage.addEventListener('pointerup', (e) => {
      const d = this.down; this.down = null; this.box.hidden = true;
      if (!this.on || e.button !== 0) return;
      if (d?.box) { this.pickBox(d.x, d.y, e.clientX, e.clientY, e.shiftKey); return; }
      this.tap(e.clientX, e.clientY, e.shiftKey, e.pointerType === 'touch');
    });
    stage.addEventListener('contextmenu', (e) => { if (!this.on) return; e.preventDefault(); this.order(e.clientX, e.clientY); });
  }

  /** the raid is over (or the screen leaves it): no clone driven, nothing aimed or picked */
  reset(): void {
    const p = this.p();
    if (this.driving) { p.drive = undefined; if (p.manual === this.driving) p.manual = undefined; }
    this.driving = null; this.aiming = null; this.selected.clear(); this.held.clear(); this.html = '';
  }

  update(): void {
    const p = this.p();
    this.bar.hidden = !this.on;
    if (!this.on) return;
    for (const id of [...this.selected]) if (!entOf(p, id)?.alive) this.selected.delete(id);
    if (this.driving && !entOf(p, this.driving)?.alive) this.drive(this.driving);
    if (this.driving) {
      let x = 0, y = 0;
      for (const k of this.held) { x += KEYS[k]![0]; y += KEYS[k]![1]; }
      p.drive = { id: this.driving, dir: x || y ? { x: Math.sign(x), y: Math.sign(y) } : null };
    }
    const html = ultBarHtml(p, this.aiming, this.view.speed());
    if (html !== this.html) { this.html = html; this.bar.innerHTML = html; }
  }

  /** take a clone under the hand, or let it go */
  drive(id: string): void {
    const p = this.p();
    if (this.driving === id || !entOf(p, id)?.alive) { p.drive = undefined; if (p.manual === id) p.manual = undefined; this.driving = null; return; }
    this.driving = id; p.manual = id; p.drive = { id, dir: null }; this.selected.clear(); this.selected.add(id);
  }

  private key(e: KeyboardEvent): void {
    if (!this.on) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' && this.aiming) { this.aiming = null; this.html = ''; e.stopImmediatePropagation(); return; }
    if (KEYS[k] && this.driving) { this.held.add(k); e.preventDefault(); return; }
    const id = raidClones(this.p())[Number(k) - 1];
    if (/^[1-9]$/.test(k) && id) this.drive(id);
  }

  private hereAt(c: Cell) {
    const p = this.p();
    return p.units.find((u) => alive(p, u) && !u.swarm && entOf(p, u.id)!.pos.x === c.x && entOf(p, u.id)!.pos.y === c.y)
      ?? p.units.find((u) => u.swarm && alive(p, u) && entOf(p, u.id)!.pos.x === c.x && entOf(p, u.id)!.pos.y === c.y);
  }

  private tap(x: number, y: number, add: boolean, touch: boolean): void {
    const p = this.p(), c = this.view.cellAt(x, y);
    if (!c) return;
    if (this.aiming) { queueUltimate(p, this.aiming.id, c, this.aiming.slot); this.aiming = null; this.html = ''; return; }
    const who = this.hereAt(c);
    if (who?.side === 'hero' && !who.summoner) {
      const now = performance.now();
      if (this.lastTap.id === who.id && now - this.lastTap.at < 320) { this.drive(who.id); this.lastTap = { id: '', at: 0 }; return; }
      this.lastTap = { id: who.id, at: now };
      if (!add) this.selected.clear();
      this.selected.add(who.id);
      return;
    }
    // a phone has no right button: with clones picked, a tap is their order
    if (touch && this.selected.size) this.order(x, y);
    else if (!add) this.selected.clear();
  }

  /** the picked clones go to the cell and hold it, or set on the foe there */
  private order(x: number, y: number): void {
    const p = this.p(), c = this.view.cellAt(x, y);
    if (!c) return;
    const foe = this.hereAt(c);
    for (const id of this.selected) {
      const u = unitOf(p, id); if (!u || id === this.driving) continue;
      u.order = foe && foe.side === 'foe' ? { kind: 'attack', target: foe.id } : { kind: 'move', cell: c };
    }
  }

  private pickBox(x0: number, y0: number, x1: number, y1: number, add: boolean): void {
    const [l, r, t, b] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    if (!add) this.selected.clear();
    for (const id of raidClones(this.p())) { const s = this.view.screenOf(id); if (s && s.left >= l && s.left <= r && s.top >= t && s.top <= b) this.selected.add(id); }
  }
}
