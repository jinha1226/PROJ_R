import { FAMILIES, FAMILY_NAMES } from '../../../sim/grid/resonance';
import { ENGRAVES, type EngraveId } from '../../../sim/grid/engraveCore';
import { SHOP, engraveShop, type MetaState } from '../../../sim/grid/meta';
import type { RunOptions } from '../../../sim/grid/runSetup';
import { STATIONS, type StationId } from '../../../sim/grid/ship';
import { ROUND_NAMES } from '../../../sim/grid/rounds';
export const GUN_NAMES = { pistol: '권총' };
export interface PanelChoice { id: string; label: string; enabled: boolean; selected: boolean }
export function launchOptions(m: MetaState, o: RunOptions): RunOptions {
  const start = o.start === 6 && m.facilities.navCrypt ? 6 : o.start === 11 && m.facilities.navRuins ? 11 : 1;
  return { gun: 'pistol', round: o.round && o.round !== 'plain' && m.rounds.includes(o.round) ? o.round : 'plain', start,
    startSuit: start === 1 ? [...new Set(o.startSuit.length ? o.startSuit : m.unlocked)].filter(id => m.unlocked.includes(id)).slice(0, m.facilities.suitSlots) : [] };
}
export function toggleStartSuit(m: MetaState, o: RunOptions, id: EngraveId): RunOptions {
  const selected = launchOptions(m, o).startSuit;
  return launchOptions(m, { ...o, startSuit: selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id] });
}
export function panelContents(m: MetaState, id: StationId, options: RunOptions, lastEnergy = 0) {
  const o = launchOptions(m, options);
  const shop = SHOP.filter(e => id === 'armory' ? e.id.startsWith('round:') && !m.rounds.some(el => e.id === `round:${el}`) : id === 'suitlab' ? /^(suitSlots|chargePlus)/.test(e.id) : id === 'nav' ? e.id.startsWith('nav') : false)
    .map(e => ({ id: e.id, label: `${e.name} · ⚡${e.cost}`, enabled: e.can(m) && m.energy >= e.cost }));
  const engravings = id === 'suitlab' ? engraveShop(m) : [];
  const groups = id === 'suitlab' ? FAMILIES.map(family => ({ id: family, label: FAMILY_NAMES[family],
    shop: engravings.filter(e => ENGRAVES[e.id.slice('engrave:'.length) as EngraveId].family === family)
      .map(e => ({ id: e.id, label: `${e.name} ⚡${e.cost}`, enabled: m.repairs.includes('suitlab') && m.energy >= e.cost })),
  })) : [];
  shop.push(...groups.flatMap(g => g.shop));
  const lines: string[] = [];
  let choices: PanelChoice[] = [];
  if (id === 'armory') choices = (['plain', ...m.rounds] as const).map(r => ({ id: r, label: `${ROUND_NAMES[r]}탄`, enabled: true, selected: o.round === r }));
  if (id === 'nav') {
    choices = [1, ...(m.facilities.navCrypt ? [6] : []), ...(m.facilities.navRuins ? [11] : [])].map(n => ({ id: String(n), label: `${n}층 출발`, enabled: true, selected: o.start === n }));
    lines.push('지름길: 5층·10층 수호자 처치 필요');
  }
  if (id === 'records') lines.push(...m.records.map(i => `${ENGRAVES[i].name} — ${ENGRAVES[i].note}`));
  if (id === 'suitlab') lines.push(`시작 각인 ${m.facilities.suitSlots}칸 · 최대 충전 ${10 + m.facilities.chargePlus * 2}`);
  if (id === 'core') lines.push(`보유 에너지 ⚡${m.energy}`, `지난 출격 전송 ⚡${lastEnergy}`);
  if (id === 'pod') lines.push(`최고 ${m.best}층 · 귀환 ${m.wins}회`);
  if (id === 'hatch') {
    lines.push(`${GUN_NAMES[o.gun]} · ${ROUND_NAMES[o.round ?? 'plain']}탄 · ${o.start}층 출발`, o.start === 1 ? `시작 각인 ${o.startSuit.length}/${m.facilities.suitSlots}` : '시작 각인 없음');
    if (o.start === 1) choices = m.unlocked.map(i => ({ id: i, label: `${ENGRAVES[i].name} — ${ENGRAVES[i].note}`, selected: o.startSuit.includes(i), enabled: o.startSuit.includes(i) || o.startSuit.length < m.facilities.suitSlots }));
  }
  return { title: STATIONS[id], shop, groups, lines, choices };
}
