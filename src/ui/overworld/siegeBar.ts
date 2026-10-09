import { domeMax, domeUp, raiders } from '../../sim/base/siege';
import { GATHER } from '../../sim/base/modules';
import type { GEvent } from '../../sim/grid/types';
import { alive } from '../../sim/party/partyCore';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { implant } from '../../sim/roam/roam';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';

const CELLS = 14;
/** game time per real second at normal speed (the surface's clock) */
const SEC = 3.6;

/**
 * The siege's two lines at the top of the base (spec 2026-10-09 "idle defence"): the wave now coming and the highest ever
 * reached, with how many of the horde are out; then the dome — its strength told in cells, or how long until it relights.
 */
export function siegeHtml(p: WorldParty): string {
  const s = p.siege;
  if (!s) return '';
  const out = raiders(p).filter((u) => alive(p, u)).length;
  const wave = `<span class="sg-wave">파도 <b>${s.wave}</b><small>최고 ${s.best}</small></span><span>적 <b>${out}</b></span>`;
  if (!domeUp(p)) return `${wave}<span class="sg-dome down">돔 재가동 <b>${Math.max(0, Math.ceil((s.downUntil - p.time) / SEC))}초</b></span>`;
  const max = domeMax(p), hp = Math.max(0, Math.round(s.domeHp)), full = Math.round((hp / max) * CELLS);
  return `${wave}<span class="sg-dome${hp < max / 3 ? ' low' : ''}">돔 [<i>${'#'.repeat(full)}</i><s>${'#'.repeat(CELLS - full)}</s>] ${hp}</span>`;
}

/** The siege's lines under the base's status. */
export class SiegeBar {
  readonly el = document.createElement('div');
  private html = '';
  constructor(private readonly p: () => WorldParty) { this.el.className = 'siege-bar'; this.el.hidden = true; }
  update(): void {
    const html = siegeHtml(this.p());
    if (html === this.html) return;
    this.html = html; this.el.innerHTML = html; this.el.hidden = !html;
  }
}

/** The log/toast line for a siege event, or undefined for other events. */
export function siegeNote(e: GEvent): string | undefined {
  if (e.type === 'buff' && e.text === 'domeBreak') return `돔 붕괴 · 에너지파가 무리를 밀어냈다 · 파도 ${e.amount}부터 다시`;
  if (e.type === 'buff' && e.text === 'domeUp') return '돔 재가동';
  if (e.type === 'buff' && e.text === 'gather') return `남은 클론이 광석 ${e.amount} · 생체 ${Math.round(((e.amount ?? 0) / GATHER.ore) * GATHER.bio)}를 모았다`;
  return undefined;
}

/** The run-over panel (no clone left, no bio-matter for a body): restart or back to the title, instead of a frozen field. */
export function overPanel(restart: () => void, quit?: () => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pip-win menu-win';
  el.hidden = true;
  el.innerHTML = '<div class="pip-frame menu-frame"><header><span class="pip-title">전멸</span></header><div class="menu-body"><div class="menu-row"><button type="button" data-over="restart">다시 시작</button><button type="button" data-over="quit">타이틀</button></div></div></div>';
  el.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('[data-over]')?.dataset.over;
    if (k === 'restart') { el.hidden = true; restart(); }
    if (k === 'quit') quit?.();
  });
  return el;
}

/** Address-bar switches for trying the base out: `?rich` stocks it, `?wave=N` starts the siege at wave N, `?lvl` makes the first clone a level-4 mage-archer with picks waiting, `?gear` puts fantasy gear in the pack (for the workshop). */
export function tryOutState(p: WorldParty): void {
  const q = new URLSearchParams(location.search);
  const first = p.units.find((u) => u.side === 'hero');
  if (q.has('lvl') && first?.cls === 'shell') { implant(p, first, { cls: 'mage', memory: 'burnt' }, []); implant(p, first, 'archer', []); gainXp(p, first, LEVEL_XP[3]!, []); }
  if (q.has('rich') && p.ore < 200) { p.ore = 300; p.crystal = 40; p.bio = 60; }
  if (q.has('gear') && !p.pack.some((it) => 'def' in it)) for (const def of ['flameSword', 'viper', 'ironPlate']) p.pack.push({ id: `item-${p.nextItem++}`, def, power: 0 });
  if (q.has('wave') && p.siege && !p.siege.wave) { p.siege.wave = Math.max(0, Number(q.get('wave')) - 1); p.siege.nextAt = p.time + 6; }
}
