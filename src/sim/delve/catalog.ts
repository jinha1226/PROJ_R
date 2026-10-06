import { addShield } from '../party/shield';
import type { Tag, WeaponFamily } from '../party/buildTypes';
import type { TriggerDef } from '../party/triggers';
import { status, cleave, stun, ward, hide, bloodFinish, emberGround, pilgrimage, bait, echo, guard, shatter, haste, wind, thunder, bones } from './catalogEffects';
export type { WeaponFamily } from '../party/buildTypes';
export interface ItemDef {
    id: string;
    name: string;
    slot: 'weapon' | 'armor' | 'accessory';
    family?: WeaponFamily;
    shield?: boolean;
    twoHand?: boolean;
    dual?: boolean;
    dmg?: [
        number,
        number
    ];
    range?: number;
    atk?: number;
    armor?: number;
    block?: number;
    weight: number;
    tags: Tag[];
    triggers: TriggerDef[];
    floors: [
        number,
        number
    ];
}
export interface Numbers {
    min: number;
    max: number;
    range: number;
    atk: number;
    armor: number;
    block: number;
    weight: number;
}
// Exact heterogeneous donations cannot be represented by a scalar multiplier alone.
export type GearItem = {
    id: string;
    def: string;
    power: number;
    bonus?: Partial<Numbers>;
};
export type ConsumableId = 'potion' | 'fireBomb' | 'iceBomb' | 'poisonJar' | 'smoke' | 'cleanse' | 'rage' | 'boltWand';
export type Item = GearItem | {
    id: string;
    consumable: ConsumableId;
    charges?: number;
};
export const CONSUMABLES: Record<ConsumableId, string> = { potion: '치유 물약', fireBomb: '화염 폭탄', iceBomb: '빙결 폭탄', poisonJar: '독 단지', smoke: '연막탄', cleanse: '정화 두루마리', rage: '분노 물약', boltWand: '번개 완드' };
const weapon = (id: string, name: string, family: WeaponFamily, dmg: [
    number,
    number
], range: number, atk: number, weight: number, tags: Tag[], triggers: TriggerDef[], floor = 1, extra: Partial<ItemDef> = {}): ItemDef => ({ id, name, slot: 'weapon', family, dmg, range, atk, weight, tags, triggers, floors: [floor, Infinity], ...extra });
const armor = (id: string, name: string, reduce: number, weight: number, tags: Tag[], triggers: TriggerDef[], floor = 1): ItemDef => ({ id, name, slot: 'armor', armor: reduce, weight, tags, triggers, floors: [floor, Infinity] });
const accessory = (id: string, name: string, tags: Tag[], triggers: TriggerDef[], floor = 1): ItemDef => ({ id, name, slot: 'accessory', weight: 0, tags, triggers, floors: [floor, Infinity] });
const defs: ItemDef[] = [
    weapon('swordShield', '방벽 방패와 검', 'sword', [7, 10], 1, 1, 3, ['근접', '방패'], [ward], 1, { shield: true, block: .1 }),
    weapon('sword', '수호검', 'sword', [8, 11], 1, .9, 2, ['근접'], [status('수호 베기', 'exposed', 'crit')]),
    weapon('flameSword', '화염검', 'sword', [10, 14], 1, 1, 2, ['근접', '화염'], [status('불꽃 칼날', 'burn')], 3),
    weapon('bloodGreat', '피 묻은 대검', 'great', [10, 14], 1, 1.4, 4, ['근접', '출혈'], [{ ...status('피의 날', 'bleed'), run: (p, c) => { status('피의 날', 'bleed').run(p, c); cleave.run(p, c); } }, bloodFinish], 2, { twoHand: true }),
    weapon('greataxe', '양손 도끼', 'great', [10, 14], 1, 1.4, 4, ['근접'], [cleave], 1, { twoHand: true }),
    weapon('stormAxe', '천둥 도끼', 'great', [15, 20], 1, 1.6, 5, ['근접', '전기'], [status('뇌격', 'shock'), cleave], 4, { twoHand: true }),
    weapon('mace', '순례 철퇴', 'mace', [6, 9], 1, 1.1, 2, ['근접', '치유'], [stun]),
    weapon('maceShield', '철퇴와 방패', 'mace', [7, 10], 1, 1.2, 3, ['근접', '방패'], [stun, ward], 2, { shield: true, block: .15 }),
    weapon('daggers', '쌍단검', 'dagger', [4, 6], 1, .6, 1, ['근접', '치명'], [status('급소', 'bleed', 'crit')], 1, { dual: true }),
    weapon('viper', '독사의 이빨', 'dagger', [5, 7], 1, .65, 1, ['독', '치명'], [status('독니', 'poison')], 2),
    weapon('viperPair', '독니 쌍단검', 'dagger', [6, 8], 1, .7, 1, ['독', '치명'], [status('쌍독니', 'poison', 'hit', 2)], 4, { dual: true }),
    weapon('longbow', '장궁', 'bow', [6, 9], 7, 1.1, 2, ['원거리'], [status('사냥의 흔적', 'mark', 'crit')]),
    weapon('iceBow', '얼음 박힌 장궁', 'bow', [8, 11], 7, 1.2, 2, ['원거리', '냉기'], [{ id: '서리 사격', when: 'still', test: (_p, c) => c.src.still > 0 && c.src.still % 3 === 0, run: status('서리', 'freeze').run }], 2),
    weapon('crossbow', '석궁', 'crossbow', [12, 16], 5, 1.9, 3, ['원거리', '치명'], [status('관통 상처', 'exposed', 'crit')], 1, { twoHand: true }),
    weapon('staff', '지팡이', 'staff', [5, 8], 5, 1.3, 2, ['원거리', '전기'], [status('잔류 전류', 'shock', 'crit')]),
    weapon('emberStaff', '잿불 지팡이', 'staff', [8, 12], 5, 1.4, 2, ['원거리', '화염'], [emberGround], 2),
    weapon('symbol', '성표', 'relic', [4, 6], 4, 1.2, 1, ['원거리', '치유'], [{ id: '작은 빛', when: 'hit', run: pilgrimage.healSelf }]),
    weapon('pilgrimRelic', '순례자의 성물', 'relic', [7, 10], 4, 1.2, 1, ['치유', '협공'], [pilgrimage.trigger], 3),
    armor('cloth', '천옷', 0, 1, ['생존'], [hide('숨 고르기', .25)]),
    armor('leather', '가죽 갑옷', .1, 2, ['생존'], [{ id: '가죽 보호', when: 'combatStart', run: (_p, c) => { addShield(c.src, 3); } }]),
    armor('ironPlate', '철갑 흉갑', .25, 5, ['방패'], [{ id: '철갑', when: 'still', test: (_p, c) => c.src.still >= 2, run: (_p,c) => { c.src.ironGuard = true; } }], 2),
    armor('hunterCloak', '사냥꾼의 망토', .05, 1, ['은신'], [hide('사냥 잠행', 1)], 2),
    armor('frostRobe', '서리 로브', .08, 1, ['냉기'], [status('서리 장막', 'chill', 'struck')], 2),
    armor('thornPlate', '가시 갑옷', .2, 4, ['근접', '방패'], [{ id: '가시', when: 'struck', run: guard.thorns }], 3),
    armor('pilgrimRobe', '순례복', .12, 2, ['치유'], [{ id: '순례의 빛', when: 'crisis', run: pilgrimage.crisis }], 3),
    armor('graveRobe', '망자의 수의', .15, 2, ['소환'], [bones], 4),
    accessory('deadNecklace', '망자의 목걸이', ['소환'], [bones], 2),
    accessory('berserkBracelet', '광전사의 팔찌', ['근접'], [haste], 2),
    accessory('windRing', '순풍의 반지', ['생존'], [wind]),
    accessory('thunderRing', '천둥의 반지', ['전기'], [thunder], 2),
    accessory('baitCharm', '미끼 부적', ['협공'], [bait]),
    accessory('markRing', '사냥 표식 반지', ['협공'], [status('사냥 표식', 'mark')]),
    accessory('shatterCharm', '공명 파쇄 부적', ['협공', '냉기'], [shatter], 2),
    accessory('guardOath', '수호 서약', ['협공', '방패'], [guard.trigger], 2),
    accessory('echoCharm', '메아리 부적', ['협공'], [echo], 3),
    accessory('vampireRing', '흡혈 반지', ['치유'], [{ id: '흡혈', when: 'hit', run: pilgrimage.leech }], 2),
];
export const CATALOG: Record<string, ItemDef> = Object.fromEntries(defs.map(d => [d.id, d]));
