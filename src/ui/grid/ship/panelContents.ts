import { ENGRAVES, type EngraveId } from '../../../sim/grid/engraveCore';
import { SHOP, unlockedGuns, type MetaState } from '../../../sim/grid/meta';
import type { RunOptions } from '../../../sim/grid/runSetup';
import { STATIONS, type StationId } from '../../../sim/grid/ship';
export const GUN_NAMES = { pistol: '권총', shotgun: '산탄총', rifle: '소총' };
export interface PanelChoice { id: string; label: string; enabled: boolean; selected: boolean }
export function launchOptions(m: MetaState, o: RunOptions): RunOptions {
  const start = o.start === 6 && m.facilities.navCrypt ? 6 : o.start === 11 && m.facilities.navRuins ? 11 : 1;
  return { gun: unlockedGuns(m).includes(o.gun) ? o.gun : 'pistol', start,
    startSuit: start === 1 ? [...new Set(o.startSuit)].filter(id => m.startCandidates.includes(id)).slice(0, m.facilities.suitSlots) : [] };
}
export function toggleStartSuit(m: MetaState, o: RunOptions, id: EngraveId): RunOptions {
  return launchOptions(m, { ...o, startSuit: o.startSuit.includes(id) ? o.startSuit.filter(i => i !== id) : [...o.startSuit, id] });
}
export function panelContents(m: MetaState, id: StationId, options: RunOptions, lastEnergy = 0) {
  const o = launchOptions(m, options);
  const shop = SHOP.filter(e => id === 'armory' ? e.id.startsWith('armory') : id === 'suitlab' ? /^(suitSlots|chargePlus)/.test(e.id) : id === 'nav' ? e.id.startsWith('nav') : false)
    .map(e => ({ id: e.id, label: `${e.name} · ⚡${e.cost}`, enabled: e.can(m) && m.energy >= e.cost }));
  const lines: string[] = [];
  let choices: PanelChoice[] = [];
  if (id === 'armory') choices = unlockedGuns(m).map(g => ({ id: g, label: GUN_NAMES[g], enabled: true, selected: o.gun === g }));
  if (id === 'nav') {
    choices = [1, ...(m.facilities.navCrypt ? [6] : []), ...(m.facilities.navRuins ? [11] : [])].map(n => ({ id: String(n), label: `${n}층 출발`, enabled: true, selected: o.start === n }));
    lines.push('지름길: 5층·10층 수호자 처치 필요');
  }
  if (id === 'records') lines.push(...m.records.map(i => `${ENGRAVES[i].name} — ${ENGRAVES[i].note}`));
  if (id === 'suitlab') lines.push(`시작 각인 ${m.facilities.suitSlots}칸 · 최대 충전 ${10 + m.facilities.chargePlus * 2}`, ...m.startCandidates.map(i => `${ENGRAVES[i].name} — ${ENGRAVES[i].note}`), ...(m.startCandidates.length ? [] : ['시작 각인 후보 없음']));
  if (id === 'core') lines.push(`보유 에너지 ⚡${m.energy}`, `지난 출격 전송 ⚡${lastEnergy}`);
  if (id === 'pod') lines.push(`최고 ${m.best}층 · 귀환 ${m.wins}회`);
  if (id === 'hatch') {
    lines.push(`${GUN_NAMES[o.gun]} · ${o.start}층 출발`, o.start === 1 ? `시작 각인 ${o.startSuit.length}/${m.facilities.suitSlots}` : '시작 각인 없음');
    if (o.start === 1) choices = m.startCandidates.map(i => ({ id: i, label: `${ENGRAVES[i].name} — ${ENGRAVES[i].note}`, selected: o.startSuit.includes(i), enabled: o.startSuit.includes(i) || o.startSuit.length < m.facilities.suitSlots }));
  }
  return { title: STATIONS[id], shop, lines, choices };
}
