import { BOSS_POWER, isBossFloor, zoneOf, type ZoneId } from './zones';
import type { Rng } from '../../core/rng';
import { FOES, type Cell, type Ent, type FoeKind, type GridState } from './types';

/** Stats per foe kind (with experience for a kill). */
export const FOE_TABLE = FOES;
export const FOE_XP: Record<FoeKind, number> = { minion: 3, brute: 6, ghoul: 4, archer: 4, mage: 6, champion: 30 };
const PER_FLOOR = 0.12;

/** Deeper floors add 12% health and damage; champions use zone power. */
export function scaleFoe(kind: FoeKind, floor: number): { hp: number; dmg: [number, number]; power: number } {
  const power = kind === 'champion' ? (isBossFloor(floor) ? BOSS_POWER[floor as 5 | 10 | 15] : 1) : 1 + PER_FLOOR * Math.max(0, floor - 1);
  const d = FOES[kind].dmg;
  return { hp: Math.round(FOES[kind].hp * power), dmg: [Math.round(d[0] * power), Math.round(d[1] * power)], power };
}

const SPAWN_CUTOFFS: Record<ZoneId, readonly number[]> = {
  cave: [0.35, 0.5, 0.85, 1], crypt: [0.45, 0.65, 0.8, 0.92], ruins: [0.2, 0.5, 0.6, 0.8],
};

/** One draw from the current zone's minion, brute, ghoul, archer and mage weights. */
export function spawnKind(rng: Rng, floor: number): FoeKind {
  const r = rng.next();
  const [minion, brute, ghoul, archer] = SPAWN_CUTOFFS[zoneOf(floor).id] as readonly [number, number, number, number];
  return r < minion ? 'minion' : r < brute ? 'brute' : r < ghoul ? 'ghoul' : r < archer ? 'archer' : 'mage';
}

export function makeFoe(id: string, kind: FoeKind, pos: Cell, group: number, floor: number, time: number): Ent {
  const sc = scaleFoe(kind, floor);
  return { id, kind, pos: { ...pos }, hp: sc.hp, maxHp: sc.hp, nextAt: time, alive: true, awake: false, group, power: sc.power };
}

/** A foe's damage roll range (scaled by depth). */
export function foeDmg(f: Ent): [number, number] {
  const d = FOES[f.kind as FoeKind].dmg;
  const p = f.power ?? 1;
  return [Math.round(d[0] * p), Math.round(d[1] * p)];
}

export function spawnFoe(s: GridState, kind: FoeKind, pos: Cell, awake: boolean): Ent {
  const f = makeFoe(`f${s.nextFoeId++}`, kind, pos, -1, s.run.floor, s.time);
  f.awake = awake;
  if (awake) f.lastSeen = { ...s.hero.pos };
  s.foes.push(f);
  return f;
}
