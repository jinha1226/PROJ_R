import { alive, type Unit } from '../../sim/party/partyCore';
import { POD_MAX } from '../../sim/base/buildings';
import { startRaid } from '../../sim/base/raids';
import type { GEvent } from '../../sim/grid/types';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { implant } from '../../sim/roam/roam';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';
import { CLASSES } from '../../sim/party/partyDefs';

const SIDE = ['서쪽', '동쪽', '북쪽', '남쪽'];

/** How many trips down are left before the next raid comes (0: tonight; null: none is on its way yet). */
export function tripsToRaid(p: WorldParty): number | null {
  if (p.raid || p.raidReady) return 0;
  if (p.raidClock === null) return null;
  return p.raidClock % 2 ? 1 : 2;
}
/** the day's line about the next raid, for the base's status */
export const raidCountdown = (p: WorldParty): string => { const n = tripsToRaid(p); return n ? `다음 습격까지 <b>${n}회</b>` : ''; };

/** the raiders left: out on the ground and still to come out of the dark */
export const raidersLeft = (p: WorldParty): number => (p.raid ? p.units.filter((u: Unit) => u.group === p.raid!.group && u.side === 'foe' && alive(p, u)).length + (p.raidQueue?.length ?? 0) : 0);

/**
 * The raid line under the top bar: a night that has come (where they will come from, how many; start it when the posts
 * and barricades are set), then the fight's state (the core's health, raiders left).
 */
export class RaidBar {
  readonly el = document.createElement('div');
  private html = '';

  constructor(private readonly p: () => WorldParty, private readonly live: (ev: GEvent[]) => void, private readonly screen: HTMLElement) {
    this.el.className = 'raid-bar';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-r]')?.dataset.r;
      if (k === 'start') this.live(startRaid(this.p()));
    });
  }

  update(): void {
    const p = this.p();
    let html = '';
    if (p.raidReady) {
      html = `<b class="rb-night">습격의 밤</b><span>${p.raidReady.sides.map((s) => SIDE[s]).join(' · ')}에서 <b>${p.raidReady.size}</b></span><button type="button" data-r="start">습격 시작</button>`;
    } else if (p.raid) {
      const hp = Math.max(0, Math.round(p.podHp)), cells = 12, full = Math.round((hp / POD_MAX) * cells);
      html = `<b class="rb-fight">습격</b><span>남은 적 <b>${raidersLeft(p)}</b></span><span class="rb-core${p.podHp < POD_MAX / 3 ? ' low' : ''}">코어 [<i>${'#'.repeat(full)}</i><s>${'#'.repeat(cells - full)}</s>] ${hp}</span>`;
    }
    // the land darkens while a raid is near or under way
    this.screen.classList.toggle('night', !!(p.raidReady || p.raid));
    if (html === this.html) return;
    this.html = html;
    this.el.innerHTML = html;
    this.el.hidden = !html;
  }
}

/** The result window's body after a raid: won or lost, the kills and what they paid, the injured clones, the buildings lost. */
export function raidResultHtml(p: WorldParty): string {
  const r = p.lastRaid;
  if (!r) return '';
  const name = (id: string) => { const u = p.units.find((x) => x.id === id); return u?.cls ? CLASSES[u.cls].name : id; };
  const rows = [`<div class="menu-row"><span>처치</span><span>${r.kills}</span></div>`,
    r.ore || r.crystal ? `<div class="menu-row"><span>얻은 자원</span><span>${[r.ore ? `광석 ${r.ore}` : '', r.crystal ? `마정석 ${r.crystal}` : ''].filter(Boolean).join(' · ')}</span></div>` : '',
    r.injured.length ? `<div class="menu-row"><span>부상</span><span>${r.injured.map(name).join(' · ')}</span></div>` : '',
    r.buildings.length ? `<div class="menu-row"><span>부서진 바리케이드</span><span>${r.buildings.length}</span></div>` : ''].join('');
  return `<div class="pip-frame menu-frame base-frame"><header><span class="pip-title">${r.won ? '습격 격퇴' : r.fell === 'down' ? '방어선 붕괴' : '코어 함락'}</span><button type="button" data-close>✕</button></header><div class="menu-body">${rows || '<div class="menu-row"><span>피해 없음</span></div>'}</div></div>`;
}

/** The log/toast line for a raid event, or undefined for other events. */
export function raidNote(e: GEvent, p: WorldParty): string | undefined {
  if (e.type === 'buff' && e.text === 'raidSoon') return `다음 귀환 때 습격 · 규모 ${e.amount}`;
  if (e.type === 'buff' && e.text === 'raidReady') return '습격의 밤 · 자리와 바리케이드를 잡고 시작';
  if (e.type === 'buff' && e.text === 'raidWon') return '습격 격퇴';
  if (e.type === 'dead' && e.text === 'raidLost') return p.lastRaid?.fell === 'down' ? '방어선 붕괴' : '코어 함락 · 수리 필요';
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

/** Address-bar switches for trying the base out: `?rich` stocks it, `?raid` sets a raid night waiting at the pod, `?lvl` makes the first clone a level-4 mage-archer with picks waiting, `?gear` puts fantasy gear in the pack (for the workshop). */
export function tryOutState(p: WorldParty): void {
  const q = new URLSearchParams(location.search);
  const first = p.units.find((u) => u.side === 'hero');
  if (q.has('lvl') && first?.cls === 'shell') { implant(p, first, { cls: 'mage', memory: 'burnt' }, []); implant(p, first, 'archer', []); gainXp(p, first, LEVEL_XP[3]!, []); }
  if (q.has('rich') && p.ore < 200) { p.ore = 300; p.crystal = 40; p.bio = 60; }
  if (q.has('gear') && !p.pack.some((it) => 'def' in it)) for (const def of ['flameSword', 'viper', 'ironPlate']) p.pack.push({ id: `item-${p.nextItem++}`, def, power: 0 });
  if (q.has('raid') && !p.raid && !p.raidReady) p.raidReady = { size: 40, sides: [0, 2] };
}
