import { dist, type Cell } from '../../sim/grid/types';
import { alive, entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { queueUltimate, ULT_NAMES, ULT_REACH, ultSlots } from '../../sim/party/ultimate';
import type { WorldParty } from '../../sim/overworld/worldSim';
import type { UltId } from '../../sim/party/classKit';
import { REVIVE } from '../../sim/base/siege';

/** the clones at the base, in the order they were made (the fallen too: their place in the bar stays, dimmed) */
export const raidClones = (p: WorldParty): string[] => p.units.filter((u) => u.side === 'hero' && !u.summoner).map((u) => u.id);
const CELLS = 6;
/** game time per real second at normal speed (the surface's clock) */
const SEC = 3.6;
/** an ultimate's name on its key where room is short (an upright phone): two or three letters, the key only */
export const ULT_SHORT: Record<UltId, string> = { earthSlam: '대지격', arrowRain: '화살비', teleport: '점멸', sanctum: '결계', shadowClone: '분신', golem: '골렘', gravity: '중력탄' };

/**
 * The clones' row under the dome's gauge: one tile per clone — its name and health (told in cells; a fallen one, how long
 * until it rises), then its ultimates, each with its cooldown (turns left); the one being aimed lit, one already on its way
 * marked. A tile is pressed as a whole: its ultimate that is ready (a clone of two souls has a key for each). At the row's
 * end, Auto: the clones fire their own ultimates.
 */
export function cloneRowHtml(p: WorldParty, aiming: { id: string; slot: number } | null): string {
  return raidClones(p).map((id) => {
    const u = unitOf(p, id)!, e = entOf(p, id), up = !!e?.alive, full = up ? Math.max(1, Math.round((e!.hp / e!.maxHp) * CELLS)) : 0;
    const keys = ultSlots(u).map((s) => {
      const left = Math.ceil(s.ready - p.time), on = aiming?.id === id && aiming.slot === s.slot, queued = u.ultQueued && (u.ultSlot ?? 0) === s.slot;
      return `<button type="button" data-ult="${id}:${s.slot}" class="${on ? 'on' : queued ? 'queued' : ''}" ${left > 0 || !up ? 'disabled' : ''}><span class="ub-full">${ULT_NAMES[s.ult]}</span><span class="ub-short">${ULT_SHORT[s.ult]}</span>${left > 0 && up ? `<em>${left}</em>` : ''}</button>`;
    }).join('');
    const rise = u.downAt === undefined ? '' : ` ${Math.max(0, Math.ceil((u.downAt + REVIVE - p.time) / SEC))}초`;
    return `<div class="ub-clone${up ? '' : ' down'}${up && e!.hp < e!.maxHp * 0.35 ? ' low' : ''}" data-clone="${id}"><div class="ub-who"><b><span class="ub-full">${CLASSES[u.cls!].name.slice(0, -1)}</span>${CLASSES[u.cls!].name.slice(-1)}</b><span class="ub-hp">${up ? `<i>${'#'.repeat(full)}</i><s>${'#'.repeat(CELLS - full)}</s>` : `쓰러짐${rise}`}</span></div><div class="ub-keys">${keys}</div></div>`;
  }).join('') + `<button type="button" data-auto class="ub-auto${p.siege?.auto ? ' on' : ''}">자동</button>`;
}

/**
 * The base's hands (spec 2026-10-09 "idle defence"): the fight runs itself. The player fires the clones' ultimates — a tap
 * on a clone's tile in the row at the top, then a tap on the ground within its reach — or leaves them to Auto. Nothing else
 * is on the screen to press: the speed and the pause are in the menu, the way down is the ground itself (floorSheet.ts).
 */
export class AbilityBar {
  /** the clones' row at the top */
  readonly row = document.createElement('div');
  aiming: { id: string; slot: number } | null = null;
  on = false;
  private rowHtml = '';

  constructor(private readonly p: () => WorldParty, private readonly view: { say: (text: string) => void }) {
    this.row.className = 'clone-row'; this.row.hidden = true;
    this.row.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, tile = t.closest<HTMLElement>('[data-clone]');
      this.rowHtml = '';
      if (t.closest('[data-auto]')) { const s = this.p().siege; if (s) { s.auto = !s.auto; this.aiming = null; } return; }
      // a key is that ultimate; anywhere else on the tile, the clone's first ultimate that is ready
      const key = t.closest<HTMLElement>('button[data-ult]') ?? tile?.querySelector<HTMLElement>('button[data-ult]:not(:disabled)');
      if (!key || key.hasAttribute('disabled')) return;
      const [id, slot] = key.dataset.ult!.split(':'), a = this.aiming;
      this.aiming = a && a.id === id && a.slot === Number(slot) ? null : { id: id!, slot: Number(slot) };
    });
    addEventListener('keydown', (e) => { if (this.on && e.key === 'Escape' && this.aiming) { this.aiming = null; this.rowHtml = ''; e.stopImmediatePropagation(); } });
  }

  /** the screen leaves the base: nothing aimed */
  reset(): void { this.aiming = null; this.rowHtml = ''; }

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
    this.aiming = null; this.rowHtml = '';
    return true;
  }

  update(): void {
    this.row.hidden = !this.on;
    if (!this.on) return;
    if (this.aiming && !this.reach) this.aiming = null;
    const row = cloneRowHtml(this.p(), this.aiming);
    if (row !== this.rowHtml) { this.rowHtml = row; this.row.innerHTML = row; }
  }
}
