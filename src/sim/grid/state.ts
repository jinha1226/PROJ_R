import { createRng } from '../../core/rng';
import { computeFov } from './fov';
import { startGear } from './gear';
import type { GunGroup } from './items';
import { makeFoe } from './foes';
import { freshFx } from './engraveCore';
import { newLore } from './lore';
import { HERO, type GridMap, type GridState } from './types';

/** A fresh sortie on a map: the hero at the start, every spawn asleep, chests shut. */
export function newState(map: GridMap, seed: number, gun: GunGroup = 'pistol', floor = 1): GridState {
  const maxHp = HERO.hp;
  const s: GridState = {
    seed, time: 0, map: { ...map, tiles: [...map.tiles] },
    hero: {
      id: 'hero', kind: 'hero', pos: { ...map.start }, hp: maxHp, maxHp, nextAt: 0, alive: true, awake: true, group: 0,
      bonus: { killCharge: 0, evasion: 0, gunDmg: 0, meleeDmg: 0 },
      level: 1, xp: 0, value: 0, loot: [], exitTime: 0, suit: [], rounds: [], roundIdx: 0, shield: 0, charge: 10, maxCharge: 10, gear: startGear(gun), fx: freshFx(), str: 10,
    },
    foes: map.spawns.map((sp, i) => makeFoe(`f${i + 1}`, sp.kind, sp.pos, sp.group, floor, 0, sp.elite)),
    chests: map.chests.map((c) => ({ pos: { ...c }, opened: false })),
    seen: new Uint8Array(map.w * map.h), visible: new Set(), rng: createRng(seed), events: [], closedExits: [], danger: 0, nextFoeId: map.spawns.length + 1, floorItems: [], run: { energy: 0, bossesKilled: [], floor, kills: 0, won: false, floorStart: 0, waves: 0 }, tiles: [], telegraphs: [], fired: new Set(), offers: [], upgrades: [], records: ['dash', 'rapid', 'chain', 'momentum'], traps: (map.traps ?? []).map((t) => ({ ...t, pos: { ...t.pos } })), lore: newLore(seed), barrels: (map.barrels ?? []).map((b) => ({ ...b })),
  };
  refreshSight(s);
  return s;
}

/** Recomputes what the hero sees and remembers. */
export function refreshSight(s: GridState): void {
  s.visible = computeFov(s.map, s.hero.pos, HERO.sight, s);
  for (const k of s.visible) s.seen[k] = 1;
}
