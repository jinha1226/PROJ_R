import type { Cell, FoeKind } from '../grid/types';

/** Shapes a strike can cover, relative to where the striker faces. */
export type Shape = 'front1' | 'line2' | 'arc3' | 'area3';

export interface Strike {
  name: string;
  shape: Shape;
  /** time from the start of the action (or the declaration, for foes) to the blow */
  at: number;
  dmg: number;
  poise: number;
  stamina: number;
}

export type WeaponId = 'dagger' | 'longsword' | 'greataxe';
export interface Weapon { id: WeaponId; name: string; group: 'dagger' | 'sword' | 'axe'; light: Strike & { cost: number }; heavy: Strike & { cost: number }; backstab: number; armor: number }

/** Three weapons: speed, reach and poise damage tell them apart more than raw damage. */
export const WEAPONS: Record<WeaponId, Weapon> = {
  dagger: { id: 'dagger', name: '단검', group: 'dagger', backstab: 2.4, armor: 0,
    light: { name: '찌르기', shape: 'front1', cost: 0.6, at: 0.2, dmg: 9, poise: 6, stamina: 12 },
    heavy: { name: '깊게 찌르기', shape: 'front1', cost: 1.0, at: 0.5, dmg: 15, poise: 12, stamina: 22 } },
  longsword: { id: 'longsword', name: '장검', group: 'sword', backstab: 1.6, armor: 0,
    light: { name: '베기', shape: 'front1', cost: 1.0, at: 0.4, dmg: 15, poise: 14, stamina: 18 },
    heavy: { name: '내려베기', shape: 'line2', cost: 1.4, at: 0.8, dmg: 26, poise: 26, stamina: 30 } },
  greataxe: { id: 'greataxe', name: '대도끼', group: 'axe', backstab: 1.4, armor: 25,
    light: { name: '휘두르기', shape: 'arc3', cost: 1.4, at: 0.7, dmg: 24, poise: 26, stamina: 26 },
    heavy: { name: '내려찍기', shape: 'arc3', cost: 1.9, at: 1.2, dmg: 42, poise: 48, stamina: 40 } },
};

/** The hero's other actions: time cost, when they take effect, stamina. */
export const MOVES = {
  move: { cost: 1.0 },
  dodge: { cost: 0.8, stamina: 22 },
  guard: { cost: 0.8, stamina: 0 },
  parry: { cost: 0.6, window: 0.25, stamina: 10 },
  heal: { cost: 1.6, amount: 45 },
};
export const HERO = { hp: 100, stamina: 100, poise: 30, flasks: 3, regen: 40, regenDelay: 0.5, poiseRegen: 12 };

/** A foe's attack: what it is, where it lands, how long it is shown before, whether it can be parried, what follows it. */
export interface FoeStrike extends Omit<Strike, 'stamina'> { parry: boolean; recover: number; then?: FoeStrike }
export interface FoeDef { name: string; kind: FoeKind; hp: number; poise: number; move: number; reach: number; shield: boolean; patterns: FoeStrike[] }

const slash = (at: number, then?: FoeStrike): FoeStrike => ({ name: '베기', shape: 'arc3', at, dmg: 14, poise: 14, parry: true, recover: 0.8, then });

export type FoeId = 'soldier' | 'knight' | 'brute';
export const FOES: Record<FoeId, FoeDef> = {
  // a plain swing shown once, then it lands
  soldier: { name: '병사', kind: 'minion', hp: 40, poise: 24, move: 1.0, reach: 1, shield: false, patterns: [slash(0.9)] },
  // shield in front; a thrust that runs into a slash, or a slow overhead it holds back
  knight: { name: '기사', kind: 'champion', hp: 70, poise: 45, move: 1.1, reach: 2, shield: true, patterns: [
    { name: '찌르기', shape: 'line2', at: 0.6, dmg: 16, poise: 14, parry: true, recover: 0.2, then: slash(0.5) },
    { name: '지연 내려찍기', shape: 'front1', at: 1.6, dmg: 28, poise: 30, parry: true, recover: 1.0 },
  ] },
  // slow and wide; cannot be parried — guard it or get out of the way
  brute: { name: '브루트', kind: 'brute', hp: 90, poise: 70, move: 1.4, reach: 1, shield: false, patterns: [
    { name: '내려찍기', shape: 'area3', at: 1.4, dmg: 30, poise: 40, parry: false, recover: 1.3 },
  ] },
};

/** The cells a shape covers from `pos` facing `f` (one of the eight directions). */
export function shapeCells(pos: Cell, f: Cell, shape: Shape): Cell[] {
  const at = (k: number) => ({ x: pos.x + f.x * k, y: pos.y + f.y * k });
  const front = at(1);
  // the two cells beside the front cell, turned a quarter each way
  const side = (s: 1 | -1): Cell => (f.x && f.y ? (s > 0 ? { x: pos.x + f.x, y: pos.y } : { x: pos.x, y: pos.y + f.y }) : { x: front.x + (f.y ? s : 0), y: front.y + (f.x ? s : 0) });
  if (shape === 'front1') return [front];
  if (shape === 'line2') return [front, at(2)];
  if (shape === 'arc3') return [side(-1), front, side(1)];
  // a square round the front cell
  const out: Cell[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ x: front.x + dx, y: front.y + dy });
  return out;
}
