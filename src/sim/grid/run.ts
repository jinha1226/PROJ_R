import { placeDeathSuit } from './deathSuit';
import { energyFor } from './meta';
import { dropChance, zoneMaterial } from './materials';
import { absorbOffer, FAMILY } from './absorb';
import { scatterLoot } from './consumables';
import { upgradeOffer } from './upgrades';
import { FOE_XP, makeFoe, spawnFoe } from './foes';
import { generateMap } from './mapgen';
import { isBossFloor } from './zones';
import { refreshSight } from './state';
import { dist, idx, same, tileAt, type Cell, type FoeKind, type GridState } from './types';

export const FLOORS = 15;
/** Experience needed for levels 2, 3, 4, … */
export const XP_STEPS = [10, 25, 45, 100, 170, 260, 370, 500, 650, 820, 1010, 1220, 1450, 1700];
export const LEVEL_HP = 5;
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
  s.foes = map.spawns.map((sp, i) => makeFoe(`f${s.nextFoeId + i}`, sp.kind, sp.pos, sp.group, floor, s.hero.nextAt, sp.elite));
  s.nextFoeId += map.spawns.length;
  s.chests = map.chests.map((c) => ({ pos: { ...c }, opened: false }));
  s.barrels = (map.barrels ?? []).map((b) => ({ ...b }));
  s.traps = (map.traps ?? []).map((t) => ({ ...t, pos: { ...t.pos } }));
  s.tiles = [];
  s.telegraphs = [];
  s.floorItems = [];
  s.floorItems = scatterLoot(s);
  placeDeathSuit(s);
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
    const amount = energyFor(f.kind as FoeKind, s.run.floor, !!f.elite);
    s.run.energy += amount;
    s.events.push({ t: s.time, type: 'energy', amount, to: { ...f.pos } });
    if (f.kind === 'champion' && (s.run.floor === 5 || s.run.floor === 10) && !s.run.bossesKilled.includes(s.run.floor)) s.run.bossesKilled.push(s.run.floor);
    s.hero.xp += (FOE_XP[f.kind as FoeKind] ?? 3) * (f.elite ? 3 : 1);
    if (f.elite || f.kind === 'champion') {
      const family = FAMILY[f.kind as FoeKind];
      const offer = absorbOffer(s, family);
      if (offer.length) s.offers.push(offer);
      s.events.push({ t: s.time, type: 'absorb', src: s.hero.id, text: family });
      s.floorItems.push({ pos: { ...f.pos }, item: { kind: 'material', mat: 'remains', n: f.kind === 'champion' ? 3 : 1 } });
    } else if (s.rng.chance(dropChance({ materials: s.run.stock }, zoneMaterial(s.run.floor)))) {
      s.floorItems.push({ pos: { ...f.pos }, item: { kind: 'material', mat: zoneMaterial(s.run.floor), n: 1 } });
    }
    if (f.kind === 'champion' && !s.outcome) {
      const pos = { ...f.pos };
      // the final guardian leaves the energy source; a zone guardian opens the way down
      if (s.run.floor === FLOORS) s.floorItems.push({ pos, item: { kind: 'core', name: '에너지원' } });
      else if (isBossFloor(s.run.floor)) {
        s.map.stairs = pos;
        s.events.push({ t: s.time, type: 'stairs', to: { ...pos } });
      }
    }
  }
  while (s.hero.level - 1 < XP_STEPS.length && s.hero.xp >= XP_STEPS[s.hero.level - 1]!) {
    s.hero.level++;
    s.hero.maxHp += LEVEL_HP;
    s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + LEVEL_HP);
    s.events.push({ t: s.time, type: 'levelUp', src: s.hero.id, amount: s.hero.level });
    s.upgrades.push(upgradeOffer(s));
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
