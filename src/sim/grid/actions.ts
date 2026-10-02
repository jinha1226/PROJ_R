import { bodyAt, hitChance, shotClear, strike } from './combat';
import { add, canStep, COST, dist, HERO, idx, same, tileAt, type Cell, type GAction, type GridState } from './types';

const LOOT = [
  { name: '녹슨 금화 주머니', value: 25 }, { name: '은 촛대', value: 40 }, { name: '해골 반지', value: 55 },
  { name: '봉인된 두루마리', value: 70 }, { name: '보석 박힌 단검', value: 95 }, { name: '고대 성배', value: 140 },
];

export const chestAt = (s: GridState, c: Cell) => s.chests.find((ch) => same(ch.pos, c));

function openChest(s: GridState, t: number, c: Cell): void {
  const ch = chestAt(s, c)!;
  ch.opened = true;
  s.events.push({ t, type: 'open', src: 'hero', to: { ...c } });
  for (let n = s.rng.int(1, 3); n > 0; n--) {
    const item = s.rng.pick(LOOT);
    s.hero.loot.push(item);
    s.hero.value += item.value;
    s.events.push({ t, type: 'loot', src: 'hero', to: { ...c }, text: item.name, amount: item.value });
  }
  const bolts = s.rng.int(0, 4);
  if (bolts) { s.hero.bolts += bolts; s.events.push({ t, type: 'loot', src: 'hero', to: { ...c }, text: '볼트', amount: bolts }); }
  if (s.rng.chance(0.25)) { s.hero.potions++; s.events.push({ t, type: 'loot', src: 'hero', to: { ...c }, text: '물약', amount: 1 }); }
}

/** Foes the hero could shoot right now: alive, in sight, in range, nothing in the way. */
export function shootable(s: GridState): string[] {
  const h = s.hero;
  return s.foes.filter((f) => f.alive && s.visible.has(idx(s.map, f.pos)) && dist(h.pos, f.pos) <= HERO.range && shotClear(s, h.pos, f.pos)).map((f) => f.id);
}

/** Keeps the current target while it can be shot, else the nearest shootable foe. */
export function autoTarget(s: GridState): string | undefined {
  const ok = shootable(s);
  if (s.hero.target && ok.includes(s.hero.target)) return s.hero.target;
  const byDist = ok.map((id) => s.foes.find((f) => f.id === id)!).sort((a, b) => dist(s.hero.pos, a.pos) - dist(s.hero.pos, b.pos));
  return byDist[0]?.id;
}

/** Resolves the hero's action; returns its time cost, or null when it cannot be done (nothing happens, no time passes). */
export function heroAct(s: GridState, a: GAction, onNoise: (at: Cell, r: number) => void): number | null {
  const h = s.hero;
  const t = h.nextAt;
  if (a.kind === 'move') {
    const to = add(h.pos, a.dir);
    const foe = s.foes.find((f) => f.alive && same(f.pos, to));
    if (foe && (Math.abs(a.dir.x) + Math.abs(a.dir.y) === 1 || canStep(s.map, h.pos, a.dir))) {
      s.events.push({ t, type: 'bump', src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...to } });
      foe.awake = true;
      h.target = foe.id;
      strike(s, t, h, foe, HERO.meleeHit, HERO.melee);
      return COST.melee;
    }
    const ch = chestAt(s, to);
    if (ch && !ch.opened && canStep(s.map, h.pos, a.dir)) { openChest(s, t, to); return COST.open; }
    // an opened chest can be stepped over (a chest in a doorway must never seal the way)
    if (!canStep(s.map, h.pos, a.dir) || bodyAt(s, to)) return null;
    if (tileAt(s.map, to) === 'door') {
      s.map.tiles[idx(s.map, to)] = 'open';
      s.events.push({ t, type: 'door', src: h.id, to: { ...to } });
    }
    s.events.push({ t, type: 'move', src: h.id, from: { ...h.pos }, to: { ...to } });
    h.pos = to;
    return COST.move;
  }
  if (a.kind === 'shoot') {
    const id = a.target ?? autoTarget(s);
    const foe = s.foes.find((f) => f.id === id);
    if (!h.loaded || h.bolts <= 0 || !foe || !shootable(s).includes(foe.id)) return null;
    h.loaded = false;
    h.bolts--;
    h.target = foe.id;
    s.events.push({ t, type: 'shoot', src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...foe.pos } });
    foe.awake = true;
    strike(s, t, h, foe, hitChance(s.map, h.pos, foe.pos, HERO.boltHit), HERO.bolt);
    onNoise(h.pos, 6);
    return COST.shoot;
  }
  if (a.kind === 'reload') {
    if (h.loaded || h.bolts <= 0) return null;
    h.loaded = true;
    s.events.push({ t, type: 'reload', src: h.id });
    return COST.reload;
  }
  if (a.kind === 'potion') {
    if (h.potions <= 0) return null;
    h.potions--;
    const before = h.hp;
    h.hp = Math.min(h.maxHp, h.hp + HERO.heal);
    s.events.push({ t, type: 'heal', src: h.id, dst: h.id, amount: h.hp - before });
    return COST.potion;
  }
  s.events.push({ t, type: 'wait', src: h.id });
  return COST.wait;
}
