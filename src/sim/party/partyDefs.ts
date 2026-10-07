export type AdvancedClass = 'berserker' | 'guardian' | 'sniper' | 'hunter' | 'elementalist' | 'inquisitor' | 'healer' | 'assassin' | 'toxicologist';
export type ClassId = 'shell' | BaseClass | AdvancedClass;
export type BaseClass = 'warrior' | 'archer' | 'mage' | 'cleric' | 'rogue' | 'necromancer';
export type WeaponId = 'fists' | 'pistol' | 'swordShield' | 'greataxe' | 'longbow' | 'crossbow' | 'staff' | 'wand' | 'mace' | 'symbol' | 'daggers' | 'knives';
/** a class's own rule, always on (the class engraving) */
export type Passive = 'none' | 'counter' | 'firstShot' | 'shatter' | 'guardian' | 'flank' | 'rage' | 'farShot';

export interface WeaponDef { name: string; dmg: [number, number]; range: number; atk: number; look: 'sword' | 'axe' | 'bow' | 'crossbow' | 'mace' | 'dagger' | 'staff' | 'wand' | 'symbol' | 'pistol' | 'none'; shield?: boolean; note: string; guard?: number; cleave?: boolean; splash?: boolean; stun?: number }
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fists: { name: '맨주먹', dmg: [2, 4], range: 1, atk: 1.0, look: 'none', note: '능력 없음' },
  pistol: { name: '권총', dmg: [5, 8], range: 6, atk: 1.0, look: 'pistol', note: '탄창 6' },
  swordShield: { name: '검과 방패', dmg: [7, 10], range: 1, atk: 1.0, look: 'sword', shield: true, guard: 0.75, note: '받는 피해 -25%' },
  greataxe: { name: '양손 도끼', dmg: [10, 14], range: 1, atk: 1.4, look: 'axe', cleave: true, note: '옆의 적도 벤다 · 느림' },
  longbow: { name: '장궁', dmg: [6, 9], range: 7, atk: 1.1, look: 'bow', note: '사거리 7' },
  crossbow: { name: '석궁', dmg: [12, 16], range: 5, atk: 1.9, look: 'crossbow', note: '강하지만 느림' },
  staff: { name: '지팡이', dmg: [5, 8], range: 5, atk: 1.3, look: 'staff', splash: true, note: '대상 주변에 튄다' },
  wand: { name: '완드', dmg: [3, 5], range: 6, atk: 0.7, look: 'wand', note: '약하지만 빠름' },
  mace: { name: '철퇴와 방패', dmg: [6, 9], range: 1, atk: 1.1, look: 'mace', shield: true, stun: 0.2, note: '가끔 기절' },
  symbol: { name: '성표', dmg: [4, 6], range: 4, atk: 1.2, look: 'symbol', note: '원거리 신성' },
  daggers: { name: '쌍단검', dmg: [4, 6], range: 1, atk: 0.6, look: 'dagger', note: '아주 빠름' },
  knives: { name: '투척 단검', dmg: [4, 7], range: 4, atk: 1.0, look: 'dagger', note: '원거리' },
};

export interface ClassDef { name: string; hp: number; move: number; weapons: WeaponId[]; passive: Passive; passiveName: string; magic?: boolean }
export const CLASSES: Record<ClassId, ClassDef> = {
  shell: { name: '빈 몸', hp: 40, move: 0.9, weapons: ['pistol'], passive: 'none', passiveName: '' },
  warrior: { name: '전사', hp: 80, move: 0.9, weapons: ['swordShield', 'greataxe'], passive: 'counter', passiveName: '맞으면 가끔 반격' },
  archer: { name: '궁수', hp: 40, move: 0.9, weapons: ['longbow', 'crossbow'], passive: 'firstShot', passiveName: '상처 없는 적에게 2배' },
  mage: { name: '마법사', hp: 45, move: 1.0, weapons: ['staff', 'wand'], passive: 'shatter', passiveName: '언 적에게 2배', magic: true },
  cleric: { name: '성직자', hp: 50, move: 0.95, weapons: ['mace', 'symbol'], passive: 'guardian', passiveName: '아군 위기 시 보호막', magic: true },
  rogue: { name: '도적', hp: 55, move: 0.75, weapons: ['daggers', 'knives'], passive: 'flank', passiveName: '다른 이를 노리는 적에게 1.6배' },
  berserker: { name: '광전사', hp: 85, move: 0.85, weapons: ['swordShield', 'greataxe'], passive: 'rage', passiveName: '체력 절반 이하 피해 1.5배' },
  sniper: { name: '저격수', hp: 45, move: 0.9, weapons: ['longbow', 'crossbow'], passive: 'farShot', passiveName: '사거리 +2 · 5칸 밖 2배' },
  guardian: { name: '수호기사', hp: 80, move: 0.9, weapons: ['swordShield', 'mace'], passive: 'none', passiveName: '수호기사' },
  hunter: { name: '사냥꾼', hp: 40, move: 0.9, weapons: ['longbow', 'crossbow', 'daggers'], passive: 'none', passiveName: '사냥꾼' },
  elementalist: { name: '원소술사', hp: 45, move: 1, weapons: ['staff'], passive: 'none', passiveName: '원소술사', magic: true },
  necromancer: { name: '강령술사', hp: 45, move: 1, weapons: ['staff'], passive: 'none', passiveName: '강령술사', magic: true },
  inquisitor: { name: '심판관', hp: 50, move: 0.95, weapons: ['mace', 'symbol'], passive: 'none', passiveName: '심판관', magic: true },
  healer: { name: '치유사', hp: 50, move: 0.95, weapons: ['mace', 'symbol'], passive: 'none', passiveName: '치유사', magic: true },
  assassin: { name: '암살자', hp: 55, move: 0.75, weapons: ['daggers'], passive: 'none', passiveName: '암살자' },
  toxicologist: { name: '독술사', hp: 55, move: 0.75, weapons: ['daggers'], passive: 'none', passiveName: '독술사' },
};
export const BASE_CLASSES: BaseClass[] = ['warrior', 'archer', 'mage', 'cleric', 'rogue', 'necromancer'];

export type FoeId = 'goblin' | 'archer' | 'brute' | 'ghoul' | 'shaman' | 'warlord';
export const FOES: Record<FoeId, { hp: number; dmg: [number, number]; range: number; atk: number; move: number }> = {
  ghoul: { hp: 23, dmg: [3, 5], range: 1, atk: 0.7, move: 0.55 },
  shaman: { hp: 26, dmg: [4, 7], range: 5, atk: 1.5, move: 1 },
  warlord: { hp: 200, dmg: [8, 12], range: 1, atk: 1.5, move: 1 },
  goblin: { hp: 29, dmg: [2, 5], range: 1, atk: 1.0, move: 0.8 },
  archer: { hp: 20, dmg: [3, 5], range: 6, atk: 1.3, move: 1.0 },
  brute: { hp: 62, dmg: [8, 12], range: 1, atk: 1.6, move: 1.0 },
};
/** each wave's band, entering from the right */
export const WAVES: FoeId[][] = [
  ['goblin', 'goblin', 'goblin', 'archer', 'archer'],
  ['goblin', 'goblin', 'goblin', 'goblin', 'archer', 'archer', 'brute'],
  ['goblin', 'goblin', 'goblin', 'archer', 'archer', 'archer', 'brute', 'brute'],
];

export interface Pick { cls: BaseClass; weapon: WeaponId }
export const DEFAULT_PICKS: Pick[] = [{ cls: 'warrior', weapon: 'swordShield' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }];
export const HERO_IDS = ['hero', 'ally-1', 'ally-2'];
