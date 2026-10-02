import { createRng } from '../../core/rng';
import { computeFov } from './fov';
import { HERO, FOES, type GridMap, type GridState } from './types';

/** A fresh sortie on a map: the hero at the start, every spawn asleep, chests shut. */
export function newState(map: GridMap, seed: number): GridState {
  const s: GridState = {
    seed, time: 0, map: { ...map, tiles: [...map.tiles] },
    hero: {
      id: 'hero', kind: 'hero', pos: { ...map.start }, hp: HERO.hp, maxHp: HERO.hp, nextAt: 0, alive: true, awake: true, group: 0,
      loaded: true, bolts: HERO.bolts, potions: HERO.potions, value: 0, loot: [], exitTime: 0,
    },
    foes: map.spawns.map((sp, i) => ({ id: `f${i + 1}`, kind: sp.kind, pos: { ...sp.pos }, hp: FOES[sp.kind].hp, maxHp: FOES[sp.kind].hp, nextAt: 0, alive: true, awake: false, group: sp.group })),
    chests: map.chests.map((c) => ({ pos: { ...c }, opened: false })),
    seen: new Uint8Array(map.w * map.h), visible: new Set(), rng: createRng(seed), events: [], closedExits: [], danger: 0, nextFoeId: map.spawns.length + 1,
  };
  refreshSight(s);
  return s;
}

/** Recomputes what the hero sees and remembers. */
export function refreshSight(s: GridState): void {
  s.visible = computeFov(s.map, s.hero.pos, HERO.sight);
  for (const k of s.visible) s.seen[k] = 1;
}
