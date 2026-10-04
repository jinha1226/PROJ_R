import { weaponLabel } from './weaponInfo';
import { isGun } from '../../sim/grid/items';
import { XP_STEPS } from '../../sim/grid/run';
import type { GridState } from '../../sim/grid/types';

const CELLS = 10;

/** A text gauge: filled and empty cells, e.g. ■■■■■■□□□□. */
export function textBar(frac: number, cells = CELLS): string {
  const n = Math.round(Math.max(0, Math.min(1, frac)) * cells);
  return `<i>${'■'.repeat(n)}</i>${'□'.repeat(cells - n)}`;
}

const pad = (v: string | number, w: number) => String(v).padStart(w, ' ');

/** Monitor readout of the hero: health, charge and level as lines of text. */
export function termVitals(s: GridState): string {
  const h = s.hero;
  const lo = XP_STEPS[h.level - 2] ?? 0;
  const hi = XP_STEPS[h.level - 1] ?? lo + 1;
  const low = h.hp / Math.max(1, h.maxHp) < 0.35 ? ' low' : '';
  return `<div class="tv-hp${low}"><b>체력</b> ${pad(h.hp, 3)}/${pad(h.maxHp, 3)} ${textBar(h.hp / Math.max(1, h.maxHp))}</div>`
    + `<div class="tv-ch"><b>충전</b> ${pad(h.charge, 3)}/${pad(h.maxCharge, 3)} ${textBar(h.charge / Math.max(1, h.maxCharge))}</div>`
    + `<div class="tv-xp"><b>레벨</b> ${pad(h.level, 3)}     ${textBar((h.xp - lo) / Math.max(1, hi - lo))}</div>`;
}

/** Both hands as a numbered list; the one in use is marked. */
export function termArms(s: GridState): string {
  const g = s.hero.gear;
  return g.hands.map((w, i) => {
    const on = g.active === i;
    const state = !w ? '' : isGun(w.group) ? `${s.hero.charge}/${s.hero.maxCharge}` : '근접';
    return `<div class="${on ? 'on' : ''}">${on ? '▸' : ' '}${i + 1} ${w ? weaponLabel(w, s.hero) : '빈손'}<span>${state}</span></div>`;
  }).join('');
}
