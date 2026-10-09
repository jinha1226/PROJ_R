import { dist, type Cell } from '../../sim/grid/types';
import { alive, entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { queueUltimate, ULT_NAMES, ULT_REACH, ultSlots } from '../../sim/party/ultimate';
import type { WorldParty } from '../../sim/overworld/worldSim';
import type { UltId } from '../../sim/party/classKit';

/** the clones at the base, in the order they were made (the fallen too: their place in the bar stays, dimmed) */
export const raidClones = (p: WorldParty): string[] => p.units.filter((u) => u.side === 'hero' && !u.summoner).map((u) => u.id);
export const BASE_SPEEDS = [1, 2, 4];
const CELLS = 6;
/** an ultimate's name on its key where room is short (an upright phone): two or three letters, the key only */
export const ULT_SHORT: Record<UltId, string> = { earthSlam: '대지격', arrowRain: '화살비', teleport: '점멸', sanctum: '결계', shadowClone: '분신', golem: '골렘', gravity: '중력탄' };

/**
 * The base's bar: one group per clone — its name and health (told in cells), then its ultimates, each with its cooldown
 * (turns left); the one being aimed lit, one already on its way marked. Then the keys: send a clone down, Auto (the clones
 * fire their own ultimates), the speed, the pause.
 */
export function ultBarHtml(p: WorldParty, aiming: { id: string; slot: number } | null, speed: number, paused = false): string {
  const groups = raidClones(p).map((id) => {
    const u = unitOf(p, id)!, e = entOf(p, id), up = !!e?.alive, full = up ? Math.max(1, Math.round((e!.hp / e!.maxHp) * CELLS)) : 0;
    const keys = ultSlots(u).map((s) => {
      const left = Math.ceil(s.ready - p.time), on = aiming?.id === id && aiming.slot === s.slot, queued = u.ultQueued && (u.ultSlot ?? 0) === s.slot;
      return `<button type="button" data-ult="${id}:${s.slot}" class="${on ? 'on' : queued ? 'queued' : ''}" ${left > 0 || !up ? 'disabled' : ''}><span class="ub-full">${ULT_NAMES[s.ult]}</span><span class="ub-short">${ULT_SHORT[s.ult]}</span>${left > 0 && up ? `<em>${left}</em>` : ''}</button>`;
    }).join('');
    return `<div class="ub-clone${up ? '' : ' down'}${up && e!.hp < e!.maxHp * 0.35 ? ' low' : ''}"><div class="ub-who"><b><span class="ub-full">${CLASSES[u.cls!].name.slice(0, -1)}</span>${CLASSES[u.cls!].name.slice(-1)}</b><span class="ub-hp">${up ? `<i>${'#'.repeat(full)}</i><s>${'#'.repeat(CELLS - full)}</s>` : '쓰러짐'}</span></div><div class="ub-keys">${keys}</div></div>`;
  }).join('');
  return `<div class="ub-slots">${groups}</div><div class="ub-side"><button type="button" data-go>원정</button><button type="button" data-auto class="${p.siege?.auto ? 'on' : ''}">Auto</button>${BASE_SPEEDS.map((v) => `<button type="button" data-speed="${v}" class="${speed === v ? 'on' : ''}">${v}×</button>`).join('')}<button type="button" data-pause class="${paused ? 'on' : ''}">${paused ? '재개' : '정지'}</button></div>`;
}

/**
 * The base's hands (spec 2026-10-09 "idle defence"): the fight runs itself. The player fires the clones' ultimates — a tap
 * on one in the bar, then a tap on the ground within its reach — or leaves them to Auto; sends a clone down; sets the speed.
 */
export class AbilityBar {
  readonly bar = document.createElement('div');
  aiming: { id: string; slot: number } | null = null;
  on = false;
  private html = '';

  constructor(private readonly p: () => WorldParty, private readonly view: { speed: () => number; setSpeed: (v: number) => void; paused: () => boolean; pause: () => void; say: (text: string) => void; go: () => void }) {
    this.bar.className = 'ult-bar'; this.bar.hidden = true;
    this.bar.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
      if (b.dataset.ult) { const [id, slot] = b.dataset.ult.split(':'), a = this.aiming; this.aiming = a && a.id === id && a.slot === Number(slot) ? null : { id: id!, slot: Number(slot) }; }
      // the speed that is on, pressed again, steps to the next (an upright phone shows only that one key)
      if (b.dataset.speed) { const v = Number(b.dataset.speed); this.view.setSpeed(v === this.view.speed() ? BASE_SPEEDS[(BASE_SPEEDS.indexOf(v) + 1) % BASE_SPEEDS.length]! : v); }
      if (b.hasAttribute('data-pause')) this.view.pause();
      if (b.hasAttribute('data-go')) this.view.go();
      if (b.hasAttribute('data-auto')) { const s = this.p().siege; if (s) { s.auto = !s.auto; this.aiming = null; } }
      this.html = '';
    });
    addEventListener('keydown', (e) => { if (this.on && e.key === 'Escape' && this.aiming) { this.aiming = null; this.html = ''; e.stopImmediatePropagation(); } });
  }

  /** the screen leaves the base: nothing aimed */
  reset(): void { this.aiming = null; this.html = ''; }

  /** the ultimate being aimed: who casts it, from where, how far it reaches (null: none, or its caster fell) */
  get reach(): { from: Cell; r: number } | null {
    const p = this.p(), a = this.aiming, u = a && unitOf(p, a.id), s = u && ultSlots(u).find((x) => x.slot === a!.slot);
    if (!a || !u || !s || !alive(p, u)) return null;
    return { from: entOf(p, u.id)!.pos, r: ULT_REACH[s.ult] };
  }

  /** A tap on the ground while aiming: the ultimate is fired there (a cell out of reach is refused and the aim kept). True when the tap was used. */
  tap(c: Cell): boolean {
    const reach = this.reach;
    if (!this.on || !this.aiming) return false;
    if (!reach) { this.aiming = null; return true; }
    if (dist(reach.from, c) > reach.r) { this.view.say('사거리 밖'); return true; }
    queueUltimate(this.p(), this.aiming.id, c, this.aiming.slot);
    this.aiming = null; this.html = '';
    return true;
  }

  update(): void {
    const p = this.p();
    this.bar.hidden = !this.on;
    if (!this.on) return;
    if (this.aiming && !this.reach) this.aiming = null;
    const html = ultBarHtml(p, this.aiming, this.view.speed(), this.view.paused());
    if (html !== this.html) { this.html = html; this.bar.innerHTML = html; }
  }
}
