import type { XItemDef } from './types';

const item = (kind: XItemDef['kind'], id: string, name: string, tier: XItemDef['tier'], value: number, weight: number, stack: XItemDef['stack'], rest: Partial<XItemDef> = {}): XItemDef =>
  ({ id, name, kind, tier, value, weight, stack, ...rest });

export const GOODS: XItemDef[] = [
  // consumables
  item('consumable', 'x_potion_s', '작은 체력 물약', 0, 12, 0.3, 3, { use: { kind: 'heal', frac: 0.3 } }),
  item('consumable', 'x_potion_m', '체력 물약', 1, 30, 0.4, 3, { use: { kind: 'heal', frac: 0.55 } }),
  item('consumable', 'x_antidote', '해독제', 1, 25, 0.2, 3, { use: { kind: 'antidote', sec: 60 } }),
  item('consumable', 'x_smoke', '연막탄', 2, 45, 0.5, 3, { use: { kind: 'smoke', radius: 12 } }),
  item('consumable', 'x_recall', '귀환 두루마리', 3, 220, 0.1, 1, { use: { kind: 'recall', sec: 10 } }),
  // monster parts (skeletons and bandits roam this region)
  item('part', 'x_bone', '뼈 조각', 0, 6, 0.3, 5),
  item('part', 'x_bonedust', '해골 가루', 1, 18, 0.2, 5),
  item('part', 'x_soulstone', '흐린 영혼석', 2, 70, 0.3, 3),
  item('part', 'x_badge', '산적 휘장', 0, 10, 0.1, 5),
  item('part', 'x_chief_seal', '두목의 인장', 2, 90, 0.2, 1),
  item('part', 'x_ash_core', '잿빛 심장', 4, 600, 1, 1),
  // junk
  item('junk', 'x_candle', '녹슨 촛대', 0, 8, 1, 3),
  item('junk', 'x_spoon', '은수저', 1, 20, 0.2, 5),
  item('junk', 'x_cup', '구리 잔', 0, 9, 0.6, 3),
  item('junk', 'x_coins', '동전 주머니', 1, 35, 0.4, 5),
  item('junk', 'x_gem_shard', '보석 조각', 2, 60, 0.1, 5),
  item('junk', 'x_lute', '부서진 류트', 0, 14, 2, 1),
  item('junk', 'x_tapestry', '빛바랜 태피스트리', 1, 40, 3, 1),
  // relics: very valuable, heavy — the classic "is it worth the risk" pickup
  item('relic', 'x_crown', '고대 왕관', 3, 420, 3, 1),
  item('relic', 'x_grail', '봉인된 성배', 3, 380, 4, 1),
  item('relic', 'x_idol', '황금 우상', 4, 800, 6, 1),
  item('relic', 'x_tome', '금지된 서책', 3, 350, 3, 1),
  item('relic', 'x_reliquary', '성자의 유골함', 4, 950, 7, 1),
  // keys
  item('key', 'x_vault_key', '보물방 열쇠', 2, 50, 0.1, 1),
];
