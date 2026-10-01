import type { WeaponType } from '../types';
import type { GearSlot, Tier, XItemDef } from './types';

/** sell value by tier, scaled per slot; tiers never overlap within a slot */
const BASE_VALUE = [10, 45, 120, 300, 750];
const SLOT_VALUE: Record<GearSlot, number> = { weapon: 1.2, head: 0.9, chest: 1.1, hands: 0.7, feet: 0.7, belt: 0.6, trinket: 1.0, bag: 0.8 };
const value = (slot: GearSlot, tier: Tier, k = 1) => Math.round(BASE_VALUE[tier]! * SLOT_VALUE[slot] * k);

const gear = (slot: GearSlot, id: string, name: string, tier: Tier, weight: number, rest: Partial<XItemDef> = {}, k = 1): XItemDef =>
  ({ id, name, kind: 'gear', slot, tier, weight, stack: 1, value: value(slot, tier, k), ...rest });

const WEAPON_ATK = [0, 4, 8, 12, 18];
const WEAPONS: { type: WeaponType; visual: XItemDef['visual']; names: string[]; weight: number }[] = [
  { type: 'sword_shield', visual: { weapon: '1H_Sword', offhand: 'Round_Shield' }, names: ['낡은 검', '병사의 검', '기사의 검', '서약의 검', '여명의 검'], weight: 3 },
  { type: 'axe2h', visual: { weapon: '2H_Axe' }, names: ['녹슨 도끼', '벌목 도끼', '전투 도끼', '피의 도끼', '거인의 도끼'], weight: 4 },
  { type: 'daggers', visual: { weapon: 'Knife', offhand: 'Knife_Offhand' }, names: ['무딘 단검', '날 선 단검', '그림자 단검', '독사의 이빨', '밤의 송곳니'], weight: 1.5 },
  { type: 'crossbow', visual: { weapon: '1H_Crossbow' }, names: ['낡은 석궁', '사냥 석궁', '연발 석궁', '저격 석궁', '용사냥 석궁'], weight: 3 },
  { type: 'staff', visual: { weapon: 'Staff' }, names: ['나무 지팡이', '견습 지팡이', '원소 지팡이', '폭풍 지팡이', '대마법사의 지팡이'], weight: 2.5 },
  { type: 'wand', visual: { weapon: 'Wand' }, names: ['낡은 막대', '사제의 막대', '축복의 막대', '성인의 막대', '빛의 홀'], weight: 1.5 },
];
const WEAPON_UNIQUE: Partial<Record<WeaponType, XItemDef['unique']>> = {
  sword_shield: 'friendGuard', axe2h: 'knockdownBleed', daggers: 'markReset', crossbow: 'lastStand', staff: 'wetLightning', wand: 'friendGuard',
};

const weapons: XItemDef[] = WEAPONS.flatMap((w) => w.names.map((name, i) => {
  const tier = i as Tier;
  return gear('weapon', `x_${w.type}_${tier}`, name, tier, w.weight, {
    weaponType: w.type, stats: { atk: WEAPON_ATK[tier] }, visual: w.visual, unique: tier >= 3 ? WEAPON_UNIQUE[w.type] : undefined,
  });
}));

const HEAD = ['헌 두건', '가죽 모자', '쇠 투구', '기사 투구', '용비늘 투구'];
const CHEST = ['누더기', '누빔 조끼', '사슬 갑옷', '판금 갑옷', '용비늘 갑옷'];
const HANDS = ['헌 장갑', '가죽 장갑', '쇠사슬 장갑', '결투가의 장갑', '용사의 건틀릿'];
const FEET = ['헌 신발', '가죽 장화', '여행자 장화', '바람의 장화', '그림자 장화'];

const armor: XItemDef[] = [
  ...HEAD.map((name, i) => gear('head', `x_head_${i}`, name, i as Tier, [0.5, 1, 2, 3, 3][i]!, {
    stats: { maxHp: [0, 10, 20, 35, 55][i], def: [1, 2, 4, 6, 9][i] }, visual: { helmet: i >= 1 } })),
  ...CHEST.map((name, i) => gear('chest', `x_chest_${i}`, name, i as Tier, [1, 2.5, 5, 8, 7][i]!, {
    stats: { def: [2, 5, 9, 14, 20][i], maxHp: [5, 15, 25, 40, 60][i] }, visual: { cape: i >= 3 }, unique: i === 4 ? 'thorns' : undefined })),
  ...HANDS.map((name, i) => gear('hands', `x_hands_${i}`, name, i as Tier, [0.3, 0.5, 1, 1, 1][i]!, {
    stats: { atkSpeed: [0, 0.04, 0.07, 0.1, 0.14][i], crit: [0, 0.02, 0.04, 0.06, 0.08][i] } })),
  ...FEET.map((name, i) => gear('feet', `x_feet_${i}`, name, i as Tier, [0.5, 1, 1.2, 1, 1][i]!, {
    stats: { moveSpeed: [0, 0.15, 0.25, 0.35, 0.5][i], dodge: [0, 0.01, 0.02, 0.03, 0.05][i] } })),
];

const belts: XItemDef[] = (['끈 허리띠', '가죽 벨트', '포션 벨트', '연금술사의 벨트'] as const).map((name, i) =>
  gear('belt', `x_belt_${i}`, name, i as Tier, 0.5, { belt: { quickSlots: (i + 1) as 1 | 2 | 3 | 4 }, stats: { maxHp: [0, 5, 10, 15][i] } }));

const bags: XItemDef[] = ([['헌 자루', 6, 20], ['작은 배낭', 10, 30], ['모험가 배낭', 14, 40], ['원정대 배낭', 18, 55]] as const).map(([name, slots, carry], i) =>
  gear('bag', `x_bag_${i}`, name, i as Tier, [0.5, 1, 2, 3][i]!, { bag: { slots, carry } }));

const trinkets: XItemDef[] = [
  gear('trinket', 'x_charm_0', '조약돌 부적', 0, 0.1, { stats: { crit: 0.01 } }),
  gear('trinket', 'x_charm_1', '행운의 동전', 1, 0.1, { stats: { crit: 0.05 } }),
  gear('trinket', 'x_ring_1', '쇠 반지', 1, 0.1, { stats: { def: 3 } }, 1.05),
  gear('trinket', 'x_rune_2', '룬 돌', 2, 0.3, { stats: { atk: 3 } }),
  gear('trinket', 'x_horn_2', '전쟁 뿔피리', 2, 0.5, { unique: 'firstStrike' }, 1.05),
  gear('trinket', 'x_fang_3', '흡혈귀의 송곳니', 3, 0.2, { stats: { atk: 2 }, unique: 'lifesteal' }),
  gear('trinket', 'x_amulet_4', '폭풍 목걸이', 4, 0.2, { stats: { atk: 4 }, unique: 'wetLightning' }),
];

export const GEAR: XItemDef[] = [...weapons, ...armor, ...belts, ...bags, ...trinkets];

/** Free kit at the base, so losing everything never blocks the next sortie. */
export const STARTER_KIT = {
  weapon: Object.fromEntries(WEAPONS.map((w) => [w.type, `x_${w.type}_0`])) as Record<WeaponType, string>,
  chest: 'x_chest_0',
};
