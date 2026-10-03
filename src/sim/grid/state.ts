import { createRng } from '../../core/rng';
import { computeFov } from './fov';
import { CLASS_BONUS, startGear, type ClassId } from './gear';
import { makeWeapon, type Element, type WeaponGroup } from './items';
import { add, DIRS, same, tileAt, type Cell, type FloorItem } from './types';
import { makeFoe } from './foes';
import { HERO, type GridMap, type GridState } from './types';

/** A fresh sortie on a map: the hero at the start, every spawn asleep, chests shut. */
export function newState(map: GridMap, seed: number, cls: ClassId = 'warrior', floor = 1): GridState {
  const maxHp = HERO.hp + CLASS_BONUS[cls].maxHp;
  const s: GridState = {
    seed, time: 0, map: { ...map, tiles: [...map.tiles] },
    hero: {
      id: 'hero', kind: 'hero', pos: { ...map.start }, hp: maxHp, maxHp, nextAt: 0, alive: true, awake: true, group: 0,
      level: 1, xp: 0, value: 0, loot: [], exitTime: 0, gear: startGear(cls),
    },
    foes: map.spawns.map((sp, i) => makeFoe(`f${i + 1}`, sp.kind, sp.pos, sp.group, floor, 0)),
    chests: map.chests.map((c) => ({ pos: { ...c }, opened: false })),
    seen: new Uint8Array(map.w * map.h), visible: new Set(), rng: createRng(seed), events: [], closedExits: [], danger: 0, nextFoeId: map.spawns.length + 1, floorItems: [], run: { floor, kills: 0, won: false, floorStart: 0, waves: 0 }, tiles: [], telegraphs: [], barrels: (map.barrels ?? []).map((b) => ({ ...b })),
  };
  refreshSight(s);
  return s;
}

/** Recomputes what the hero sees and remembers. */
export function refreshSight(s: GridState): void {
  s.visible = computeFov(s.map, s.hero.pos, HERO.sight, s);
  for (const k of s.visible) s.seen[k] = 1;
}

const RACK: WeaponGroup[] = ['dagger', 'sword', 'axe', 'spear', 'mace', 'bow', 'crossbow', 'throwing', 'staff'];
const RACK_STAFF: Element[] = ['frost', 'shock', 'poison'];

/** Prototype aid: one of every weapon group the hero is not already holding, laid on the floor around the start. */
export function weaponRack(s: GridState): FloorItem[] {
  const held = new Set(s.hero.gear.hands.map((w) => w?.group));
  const spots: Cell[] = [];
  for (let r = 1; r <= 3 && spots.length < RACK.length; r++) for (const d of DIRS) {
    const c = add(s.hero.pos, { x: d.x * r, y: d.y * r });
    if (tileAt(s.map, c) === 'floor' && !s.chests.some((ch) => same(ch.pos, c)) && !s.foes.some((f) => same(f.pos, c)) && !spots.some((p) => same(p, c))) spots.push(c);
  }
  return RACK.filter((gp) => !held.has(gp)).slice(0, spots.length).map((gp, i) => ({ pos: spots[i]!, item: makeWeapon(gp, 1, gp === 'staff' ? RACK_STAFF[s.seed % 3] : undefined) }));
}
