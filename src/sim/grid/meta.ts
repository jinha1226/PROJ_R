import { BASE_IDS, ENGRAVES, type EngraveId } from './engraveCore';
import type { GunGroup } from './items';
import type { FoeKind, GridState } from './types';

export type FacilityId = 'armory' | 'suitlab' | 'nav';
export interface MetaState {
  energy: number;
  facilities: { armoryShotgun: boolean; armoryRifle: boolean; suitSlots: 2 | 3 | 4; chargePlus: 0 | 1 | 2; navCrypt: boolean; navRuins: boolean };
  unlocked: EngraveId[];
  tasted: EngraveId[];
  records: EngraveId[];
  startCandidates: EngraveId[];
  suit?: { floor: number; ids: EngraveId[]; killer: { kind: string; elite?: boolean } };
  bossesKilled: number[];
  best: number;
  wins: number;
}
export function freshMeta(): MetaState {
  return {
    energy: 0, facilities: { armoryShotgun: false, armoryRifle: false, suitSlots: 2, chargePlus: 0, navCrypt: false, navRuins: false },
    unlocked: ['gunRelay', 'spinShot'], tasted: [],
    records: ['dash', 'rapid', 'chain', 'momentum'], startCandidates: [], bossesKilled: [], best: 0, wins: 0,
  };
}
export const SHOP: { id: string; name: string; cost: number; can(m: MetaState): boolean; apply(m: MetaState): void }[] = [
  { id: 'armoryShotgun', name: '산탄총 해금', cost: 80, can: m => !m.facilities.armoryShotgun, apply: m => { m.facilities.armoryShotgun = true; } },
  { id: 'armoryRifle', name: '소총 해금', cost: 120, can: m => !m.facilities.armoryRifle, apply: m => { m.facilities.armoryRifle = true; } },
  { id: 'suitSlots3', name: '시작 각인 칸 3', cost: 100, can: m => m.facilities.suitSlots === 2, apply: m => { m.facilities.suitSlots = 3; } },
  { id: 'suitSlots4', name: '시작 각인 칸 4', cost: 250, can: m => m.facilities.suitSlots === 3, apply: m => { m.facilities.suitSlots = 4; } },
  { id: 'chargePlus1', name: '충전 최대치 +2', cost: 60, can: m => m.facilities.chargePlus === 0, apply: m => { m.facilities.chargePlus = 1; } },
  { id: 'chargePlus2', name: '충전 최대치 +4', cost: 140, can: m => m.facilities.chargePlus === 1, apply: m => { m.facilities.chargePlus = 2; } },
  { id: 'navCrypt', name: '지하 묘지 지름길', cost: 150, can: m => !m.facilities.navCrypt && m.bossesKilled.includes(5), apply: m => { m.facilities.navCrypt = true; } },
  { id: 'navRuins', name: '고대 유적 지름길', cost: 300, can: m => !m.facilities.navRuins && m.bossesKilled.includes(10), apply: m => { m.facilities.navRuins = true; } },
];
export function engraveShop(m: MetaState): { id: string; name: string; cost: number }[] {
  return BASE_IDS.filter(id => !m.unlocked.includes(id)).map(id => ({
    id: `engrave:${id}`, name: ENGRAVES[id].name,
    cost: m.tasted.includes(id) ? Math.ceil(ENGRAVES[id].cost / 2) : ENGRAVES[id].cost,
  }));
}
export function buy(m: MetaState, id: string): boolean {
  if (id.startsWith('engrave:')) {
    const offer = engraveShop(m).find(e => e.id === id);
    if (!offer || m.energy < offer.cost) return false;
    const engraving = id.slice(8) as EngraveId;
    m.energy -= offer.cost;
    m.unlocked.push(engraving);
    m.tasted = m.tasted.filter(i => i !== engraving);
    return true;
  }
  const entry = SHOP.find(e => e.id === id);
  if (!entry || !entry.can(m) || m.energy < entry.cost) return false;
  m.energy -= entry.cost;
  entry.apply(m);
  return true;
}
export function energyFor(kind: FoeKind, floor: number, elite: boolean): number {
  if (kind === 'champion') return floor === 15 ? 150 : 60;
  const base = { minion: 2, ghoul: 3, archer: 3, brute: 4, mage: 4 }[kind];
  return Math.round(base * (1 + 0.15 * (floor - 1)) * (elite ? 3 : 1));
}
export function unlockedGuns(m: MetaState): GunGroup[] {
  const guns: GunGroup[] = ['pistol'];
  if (m.facilities.armoryShotgun) guns.push('shotgun');
  if (m.facilities.armoryRifle) guns.push('rifle');
  return guns;
}
/** Settlement returns independent meta data; the caller persists it once when the run ends. */
export function settleRun(meta: MetaState, s: GridState): MetaState {
  const m: MetaState = structuredClone(meta);
  m.energy += s.run.energy;
  m.records = [...new Set([...m.records, ...s.records])];
  m.best = Math.max(m.best, s.run.floor);
  m.wins += s.outcome === 'won' ? 1 : 0;
  m.bossesKilled = [...new Set([...m.bossesKilled, ...s.run.bossesKilled])];
  m.tasted = [...new Set([...m.tasted, ...(s.run.tasted ?? []), ...(s.run.recovered ?? [])])]
    .filter(id => BASE_IDS.includes(id) && !m.unlocked.includes(id));
  if (s.run.recovered) {
    m.energy += 10 * s.run.recovered.length;
    delete m.suit;
  }
  // an empty-handed death (say after a shortcut start) leaves the older suit where it lies
  if (s.outcome === 'dead' && s.hero.suit.length) {
    m.suit = { floor: s.run.floor, ids: [...s.hero.suit], killer: { ...(s.run.killedBy ?? { kind: 'self' }) } };
  }
  return m;
}
