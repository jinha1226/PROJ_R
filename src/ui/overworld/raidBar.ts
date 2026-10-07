import { alive, type Unit } from '../../sim/party/partyCore';
import { autoDefend, defencePower, startRaid } from '../../sim/base/raids';
import type { GEvent } from '../../sim/grid/types';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { implant } from '../../sim/roam/roam';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';

const SIDE = ['서쪽', '동쪽', '북쪽', '남쪽'];
/** auto-defence wins outright when the base outweighs the wave by this much (as the simulation rules) */
const AUTO_MARGIN = 1.2;
const POD_MAX = 200;

/**
 * The raid line under the top bar: a night that has come (where they will come from, their strength against ours,
 * start it or let the defences settle it), then the fight's state (the pod's health, raiders left).
 */
export class RaidBar {
  readonly el = document.createElement('div');
  private html = '';

  constructor(private readonly p: () => WorldParty, private readonly live: (ev: GEvent[]) => void, private readonly screen: HTMLElement) {
    this.el.className = 'raid-bar';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-r]')?.dataset.r, p = this.p();
      if (k === 'start') this.live(startRaid(p));
      if (k === 'auto') { const ev = startRaid(p); autoDefend(p, ev); this.live(ev); }
    });
  }

  update(): void {
    const p = this.p();
    let html = '';
    if (p.raidReady) {
      const def = Math.round(defencePower(p)), size = p.raidReady.size;
      html = `<b class="rb-night">습격의 밤</b><span>${p.raidReady.sides.map((s) => SIDE[s]).join(' · ')}에서</span><span>규모 <b>${size}</b> / 방어력 <b class="${def >= size ? 'ok' : 'low'}">${def}</b></span>
        <button type="button" data-r="start">습격 시작</button>${def >= size * AUTO_MARGIN ? '<button type="button" data-r="auto">자동 방어</button>' : ''}`;
    } else if (p.raid) {
      const left = p.units.filter((u: Unit) => u.group === p.raid!.group && alive(p, u)).length;
      html = `<b class="rb-fight">습격</b><span>포드 <b class="${p.podHp < POD_MAX / 3 ? 'low' : ''}">${Math.max(0, Math.round(p.podHp))}/${POD_MAX}</b></span><span>남은 적 <b>${left}</b></span>`;
    }
    // the land darkens while a raid is near or under way
    this.screen.classList.toggle('night', !!(p.raidReady || p.raid));
    if (html === this.html) return;
    this.html = html;
    this.el.innerHTML = html;
    this.el.hidden = !html;
  }
}

/** The log/toast line for a raid event, or undefined for other events. */
export function raidNote(e: GEvent, p: WorldParty): string | undefined {
  if (e.type === 'buff' && e.text === 'raidSoon') return `다음 귀환 때 습격 · 규모 ${e.amount} / 방어력 ${Math.round(defencePower(p))}`;
  if (e.type === 'buff' && e.text === 'raidReady') return '습격의 밤 · 준비되면 시작';
  if (e.type === 'buff' && e.text === 'raidWon') return '습격 격퇴';
  if (e.type === 'dead' && e.text === 'raidLost') return '포드 함락 · 자원과 건물 일부 잃음';
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

/** Address-bar switches for trying the base out: `?rich` stocks it, `?raid` sets a raid night waiting at the pod, `?lvl` makes the first clone a level-4 mage-archer with picks waiting. */
export function tryOutState(p: WorldParty): void {
  const q = new URLSearchParams(location.search);
  const first = p.units.find((u) => u.side === 'hero');
  if (q.has('lvl') && first?.cls === 'shell') { implant(p, first, { cls: 'mage', memory: 'burnt' }, []); implant(p, first, 'archer', []); gainXp(p, first, LEVEL_XP[3]!, []); }
  if (q.has('rich') && p.ore < 200) { p.ore = 300; p.crystal = 40; p.bio = 60; }
  if (q.has('raid') && !p.raid && !p.raidReady) p.raidReady = { size: 40, sides: [0, 2] };
}
