import { offerFor } from './engrave';
import { FOE_XP, makeFoe, spawnFoe } from './foes';
import { generateMap } from './mapgen';
import { refreshSight } from './state';
import { dist, idx, same, tileAt, type Cell, type GridState } from './types';

export const FLOORS = 3;
/** Experience needed for levels 2, 3, 4, … */
export const XP_STEPS = [10, 25, 45, 70, 100, 140, 190];
const LEVEL_HP = 5;
const WANDER_EVERY = 150;

/** Down the stairs: the hero (health, gear, level, statuses) goes on; the floor, its foes, fire, items and marks are new. */
export function nextFloor(s: GridState): void {
  const floor = s.run.floor + 1;
  const map = generateMap(s.seed * 31 + floor, floor);
  s.map = { ...map, tiles: [...map.tiles] };
  s.run.floor = floor;
  s.run.floorStart = s.time;
  s.run.waves = 0;
  s.hero.pos = { ...map.start };
  s.hero.target = undefined;
  s.foes = map.spawns.map((sp, i) => makeFoe(`f${s.nextFoeId + i}`, sp.kind, sp.pos, sp.group, floor, s.hero.nextAt));
  s.nextFoeId += map.spawns.length;
  s.chests = map.chests.map((c) => ({ pos: { ...c }, opened: false }));
  s.barrels = (map.barrels ?? []).map((b) => ({ ...b }));
  s.tiles = [];
  s.telegraphs = [];
  s.floorItems = [];
  s.seen = new Uint8Array(map.w * map.h);
  s.events.push({ t: s.time, type: 'floor', amount: floor });
  refreshSight(s);
}

/** Foes that died during this action: count them, give experience, level up. */
export function settleKills(s: GridState, aliveBefore: Set<string>): void {
  for (const f of s.foes) {
    if (f.alive || !aliveBefore.has(f.id)) continue;
    aliveBefore.delete(f.id);
    s.run.kills++;
    s.hero.xp += FOE_XP[f.kind as keyof typeof FOE_XP] ?? 3;
    if (f.kind === 'champion' && !s.outcome) {
      s.outcome = 'won';
      s.run.won = true;
      s.events.push({ t: s.time, type: 'victory', src: s.hero.id });
    }
  }
  while (s.hero.level - 1 < XP_STEPS.length && s.hero.xp >= XP_STEPS[s.hero.level - 1]!) {
    s.hero.level++;
    s.hero.maxHp += LEVEL_HP;
    s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + LEVEL_HP);
    s.events.push({ t: s.time, type: 'levelUp', src: s.hero.id, amount: s.hero.level });
    s.offers.push(offerFor(s));
  }
}

/** Lingering: every 150 turns on a floor one or two minions arrive out of sight. */
export function updateWanderers(s: GridState): void {
  if (s.time - s.run.floorStart < WANDER_EVERY * (s.run.waves + 1)) return;
  s.run.waves++;
  const spots: Cell[] = [];
  for (let y = 0; y < s.map.h; y++) for (let x = 0; x < s.map.w; x++) {
    const c = { x, y };
    if (tileAt(s.map, c) === 'floor' && !s.visible.has(idx(s.map, c)) && dist(c, s.hero.pos) >= 10 && !s.foes.some((f) => f.alive && same(f.pos, c))
      && !s.chests.some((ch) => same(ch.pos, c)) && !s.barrels.some((b) => same(b, c))) spots.push(c);
  }
  for (let n = s.rng.int(1, 2); n > 0 && spots.length; n--) spawnFoe(s, 'minion', spots.splice(s.rng.int(0, spots.length - 1), 1)[0]!, true);
}
