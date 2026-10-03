import { ENGRAVES, type EngraveId } from '../../sim/grid/engraveCore';
import { activeWeapon } from '../../sim/grid/gear';
import { isBossFloor, zoneOf } from '../../sim/grid/zones';
import { FLOORS, XP_STEPS } from '../../sim/grid/run';
import type { GEvent, GridState } from '../../sim/grid/types';
import { icon, weaponIcon } from './icons';
import { weaponState } from './weaponInfo';

const LOG: Partial<Record<GEvent['type'], string>> = {
  alarm: '발소리가 늘었다 — 잠든 해골들이 깨어난다', reinforce: '묘지 깊은 곳에서 증원이 몰려온다!', exitClosed: '탈출 지점 하나가 무너졌다',
};
export const TRAP_NAME: Record<string, string> = { spike: '가시', alarm: '경보', poison: '독가스', fire: '화염', teleport: '순간이동', net: '그물' };
const BUFF_NAME: Record<string, string> = { haste: '신속', invis: '투명', confuse: '혼란', root: '그물' };

/** "붉은 물약은 신속 물약이었다" from the identify event's "old|new" names. */
export function identifyLine(text: string): string {
  const [was = '', is = ''] = text.split('|');
  return `${was}${batchim(was) ? '은' : '는'} ${is}${batchim(is) ? '이었다' : '였다'}`;
}

/** Does the word end in a final consonant (decides 은/는, 이었다/였다)? */
function batchim(word: string): boolean {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 !== 0;
}

/** Log lines for traps, searching and learning what a potion or scroll is. */
function eventLine(e: GEvent): string | undefined {
  if (e.type === 'absorb') return '잔향을 흡수했다';
  if (e.type === 'record') return `새 각인 기록 — ${ENGRAVES[e.text as EngraveId]?.name ?? e.text ?? ''}`;
  if (e.type === 'stairs') return '계단이 열렸다';
  if (e.type === 'core') return '에너지원을 손에 넣었다';
  if (e.type === 'identify') return identifyLine(e.text ?? '|');
  if (e.type === 'trap' && e.src === 'hero') return `함정 작동 — ${TRAP_NAME[e.text ?? ''] ?? ''}`;
  if (e.type === 'trapFound') return `함정을 발견했다 — ${TRAP_NAME[e.text ?? ''] ?? ''}`;
  if (e.type === 'root') return '그물에 걸려 움직일 수 없다';
  if (e.type === 'stumble') return '비틀거렸다';
  return undefined;
}
const KIND: Record<string, string> = { minion: '해골 졸개', archer: '해골 석궁병', brute: '해골 전사', ghoul: '구울', mage: '해골 마법사', champion: '해골 챔피언' };

/** Top bar (level badge, health, charge/potions/turn, weapon in hand), target card, danger line, toasts. */
export class GridHud {
  readonly el = document.createElement('div');
  private logTimer = 0;
  private key = '';

  constructor() {
    this.el.className = 'ghud';
    this.el.innerHTML = `<div class="gh-top">
        <div class="gh-badge"><b></b><small></small></div>
        <div class="gh-main">
          <div class="gh-hp">${icon('heart', 'gh-hp-ic')}<div class="gh-hp-bar"><div class="gh-hp-fill"></div><div class="gh-hp-lag"></div></div><span class="gh-hp-num"></span></div>
          <div class="gh-res" data-testid="grid-stats"></div>
          <div class="gh-xp"><div></div></div>
        </div>
        <div class="gh-weapon"></div>
      </div>
      <div class="gh-target" hidden></div>
      <div class="gh-danger"></div>
      <div class="ghud-log" hidden></div>
      <div class="ghud-help muted">WASD·QEZC 이동(꾹 누르면 연속) · F 사격 · X 교체 · I 가방 · Tab 표적 · Space 쉬기 · V 살피기(자신 탭) · 1 물약 · 클릭 이동 · 휠 확대</div>`;
  }

  cue(e: GEvent): void {
    const text = e.type === 'pickup' ? `${e.text} 획득` : e.type === 'full' ? `가방이 가득 찼다 — ${e.text}은(는) 바닥에` : e.type === 'equip' || e.type === 'swap' ? `${e.text} 듦` : e.type === 'loot' && e.text && !e.amount ? `${e.text} 획득` : eventLine(e) ?? LOG[e.type];
    if (!text) return;
    const el = this.el.querySelector<HTMLElement>('.ghud-log')!;
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('warn', !!LOG[e.type]);
    this.logTimer = 2.6;
  }

  update(s: GridState, target: { id: string; chance: number } | null, dt: number): void {
    const h = s.hero;
    const g = h.gear;
    const w = activeWeapon(g);
    const t = target ? s.foes.find((f) => f.id === target.id) : undefined;
    const key = JSON.stringify([h.hp, h.maxHp, h.level, h.xp, h.status, h.buffs, g.hands, g.active, h.charge, h.maxCharge, g.belt.potion, Math.floor(s.time), target, t?.hp, t?.elite, s.run]);
    if (key !== this.key) {
      this.key = key;
      const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
      q('.gh-badge b').textContent = `${h.level}`;
      q('.gh-badge small').textContent = '요원';
      const frac = Math.max(0, h.hp / h.maxHp);
      q('.gh-hp-fill').style.width = `${frac * 100}%`;
      q('.gh-hp-fill').classList.toggle('low', frac < 0.35);
      q('.gh-hp-lag').style.width = `${frac * 100}%`;
      q('.gh-hp-num').textContent = `${h.hp} / ${h.maxHp}`;
      const st = h.status;
      const chips = st ? [st.burn > 0 ? `<span class="gh-st burn">화상 ${st.burn}</span>` : '', st.freeze > 0 ? `<span class="gh-st frost">빙결 ${st.freeze}</span>` : '', st.poison > 0 ? `<span class="gh-st poison">중독 ${st.poison}</span>` : ''].join('') : '';
      const buffs = Object.entries(h.buffs ?? {}).filter(([k, until]) => BUFF_NAME[k] && until! > s.time).map(([k, until]) => `<span class="gh-st ${k}">${BUFF_NAME[k]} ${Math.ceil(until! - s.time)}</span>`).join('');
      q('.gh-res').innerHTML = `<span title="충전">${icon('charge')}<b>${h.charge}/${h.maxCharge}</b><i>충전</i></span><span title="물약">${icon('potion')}<b>${g.belt.potion}</b><i>물약</i></span><span title="턴">${icon('hourglass')}<b>${Math.floor(s.time)}</b><i>턴</i></span>${chips}${buffs}`;
      const lo = XP_STEPS[h.level - 2] ?? 0;
      const hi = XP_STEPS[h.level - 1] ?? lo + 1;
      q('.gh-xp div').style.width = `${Math.min(1, (h.xp - lo) / Math.max(1, hi - lo)) * 100}%`;
      q('.gh-weapon').innerHTML = w ? `${weaponIcon(w.group)}<div><b>${w.name}</b><small>${weaponState(w, h) || '근접'}</small></div>` : `${icon('swap')}<div><b>빈손</b></div>`;
      const card = q('.gh-target');
      card.hidden = !t;
      if (t) card.innerHTML = `${icon('skull')}<b>${t.elite ? '정예 ' : ''}${KIND[t.kind] ?? '적'}</b><div class="gh-t-bar"><div style="width:${(t.hp / t.maxHp) * 100}%"></div></div><span>${Math.round(target!.chance * 100)}%</span>`;
      q('.gh-danger').textContent = `${s.run.floor}층 / ${FLOORS} · ${zoneOf(s.run.floor).name} · 처치 ${s.run.kills}${isBossFloor(s.run.floor) ? s.run.floor === 15 ? ' · 에너지원을 지키는 수호자' : ' · 구간 수호자가 기다린다' : ''}`;
    }
    this.logTimer -= dt;
    if (this.logTimer <= 0) this.el.querySelector<HTMLElement>('.ghud-log')!.hidden = true;
  }
}
