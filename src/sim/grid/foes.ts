import type { Rng } from '../../core/rng';
import { FOES, type Cell, type Ent, type FoeKind, type GridState } from './types';

/** Stats per foe kind (with experience for a kill). */
export const FOE_TABLE = FOES;
export const FOE_XP: Record<FoeKind, number> = { minion: 3, brute: 6, ghoul: 4, archer: 4, mage: 6, champion: 30 };
const PER_FLOOR = 0.25;

/** Deeper floors: +25% health and damage per floor below the first (the champion is tuned as is). */
export function scaleFoe(kind: FoeKind, floor: number): { hp: number; dmg: [number, number]; power: number } {
  const power = kind === 'champion' ? 1 : 1 + PER_FLOOR * Math.max(0, floor - 1);
  const d = FOES[kind].dmg;
  return { hp: Math.round(FOES[kind].hp * power), dmg: [Math.round(d[0] * power), Math.round(d[1] * power)], power };
}

/** Who lives in a room: minion 45 · brute 20 · ghoul 15 · archer 12 · mage 8 (mages from floor 2). */
export function spawnKind(rng: Rng, floor: number): FoeKind {
  for (;;) {
    const r = rng.next();
    const k: FoeKind = r < 0.45 ? 'minion' : r < 0.65 ? 'brute' : r < 0.8 ? 'ghoul' : r < 0.92 ? 'archer' : 'mage';
    if (k !== 'mage' || floor >= 2) return k;
  }
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
