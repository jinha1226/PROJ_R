import { bodyAt, shotClear } from './combat';
import { activeWeapon, addToBag, equipFromBag, swapHands, wearFromBag } from './gear';
import { rollEquipment, type Weapon } from './items';
import { add, canStep, COST, dist, HERO, idx, same, tileAt, type Cell, type GAction, type GridState } from './types';
import { meleeAttack, pickUp, rangedAttack, reachTarget, reload, weaponRange } from './weapons';

export const chestAt = (s: GridState, c: Cell) => s.chests.find((ch) => same(ch.pos, c));

/** A chest holds maybe a piece of equipment (bag, or the floor when full) and some supplies. */
function openChest(s: GridState, t: number, c: Cell): void {
  const ch = chestAt(s, c)!;
  ch.opened = true;
  const g = s.hero.gear;
  s.events.push({ t, type: 'open', src: 'hero', to: { ...c } });
  if (s.rng.chance(0.6)) {
    const e = rollEquipment(s.rng, s.run.floor);
    if (addToBag(g, e)) s.events.push({ t, type: 'loot', src: 'hero', to: { ...c }, text: e.name });
    else { s.floorItems.push({ pos: { ...s.hero.pos }, item: e }); s.events.push({ t, type: 'full', src: 'hero', text: e.name }); }
  }
  const arrows = s.rng.int(2, 5);
  g.arrows += arrows;
  s.events.push({ t, type: 'loot', src: 'hero', to: { ...c }, text: '화살', amount: arrows });
  const supply = s.rng.pick(['potion', 'potion', 'bomb', 'fireFlask', 'frostFlask', 'shockFlask', 'poisonFlask', null] as const);
  if (supply) { g.belt[supply]++; s.events.push({ t, type: 'loot', src: 'hero', to: { ...c }, text: SUPPLY_NAME[supply], amount: 1 }); }
}
const SUPPLY_NAME = { potion: '물약', bomb: '폭탄', fireFlask: '화염병', frostFlask: '냉기병', shockFlask: '번개병', poisonFlask: '독병' } as const;

/** Foes the weapon in hand could hit from here (in sight, in range, line clear). */
export function shootable(s: GridState): string[] {
  const h = s.hero;
  const range = weaponRange(activeWeapon(h.gear));
  return s.foes.filter((f) => f.alive && s.visible.has(idx(s.map, f.pos)) && dist(h.pos, f.pos) <= range && shotClear(s, h.pos, f.pos)).map((f) => f.id);
}

/** Keeps the current target while it can be shot, else the nearest shootable foe. */
export function autoTarget(s: GridState): string | undefined {
  const ok = shootable(s);
  if (s.hero.target && ok.includes(s.hero.target)) return s.hero.target;
  const byDist = ok.map((id) => s.foes.find((f) => f.id === id)!).sort((a, b) => dist(s.hero.pos, a.pos) - dist(s.hero.pos, b.pos));
  return byDist[0]?.id;
}

export interface ActHooks { noise(at: Cell, r: number): void; cast(w: Weapon, at: Cell): void; use(a: Extract<GAction, { kind: 'use' }>): number | null }

/** Resolves the hero's action; returns its time cost, or null when it cannot be done (nothing happens, no time passes). */
export function heroAct(s: GridState, a: GAction, hooks: ActHooks): number | null {
  const h = s.hero;
  const g = h.gear;
  const t = h.nextAt;
  switch (a.kind) {
    case 'move': {
      const to = add(h.pos, a.dir);
      const foe = s.foes.find((f) => f.alive && same(f.pos, to));
      if (foe && (Math.abs(a.dir.x) + Math.abs(a.dir.y) === 1 || canStep(s.map, h.pos, a.dir))) return meleeAttack(s, t, a.dir, foe);
      const ch = chestAt(s, to);
      if (ch && !ch.opened && canStep(s.map, h.pos, a.dir)) { openChest(s, t, to); return COST.open; }
      const far = reachTarget(s, a.dir);
      if (far) return meleeAttack(s, t, a.dir, far);
      // an opened chest can be stepped over (a chest in a doorway must never seal the way)
      if (!canStep(s.map, h.pos, a.dir) || bodyAt(s, to)) return null;
      if (tileAt(s.map, to) === 'door') {
        s.map.tiles[idx(s.map, to)] = 'open';
        s.events.push({ t, type: 'door', src: h.id, to: { ...to } });
      }
      s.events.push({ t, type: 'move', src: h.id, from: { ...h.pos }, to: { ...to } });
      h.pos = to;
      pickUp(s, t);
      return COST.move;
    }
    case 'shoot': {
      const foe = s.foes.find((f) => f.id === (a.target ?? autoTarget(s)) && f.alive);
      if (!foe || !shootable(s).includes(foe.id)) return null;
      return rangedAttack(s, t, foe, hooks.cast, hooks.noise);
    }
    case 'reload': {
      const cost = reload(s);
      if (cost !== null) s.events.push({ t, type: 'reload', src: h.id });
      return cost;
    }
    case 'swap':
      if (!g.hands[g.active === 0 ? 1 : 0]) return null;
      swapHands(g);
      s.events.push({ t, type: 'swap', src: h.id, text: activeWeapon(g)?.name });
      return COST.swap;
    case 'equip':
      if (!equipFromBag(g, a.bag)) return null;
      s.events.push({ t, type: 'equip', src: h.id, text: activeWeapon(g)?.name });
      return COST.equip;
    case 'wear':
      if (!wearFromBag(g, a.bag)) return null;
      s.events.push({ t, type: 'wear', src: h.id, text: g.armor?.name });
      return COST.equip;
    case 'drop': {
      const e = g.bag[a.bag];
      if (!e) return null;
      g.bag.splice(a.bag, 1);
      s.floorItems.push({ pos: { ...h.pos }, item: e });
      s.events.push({ t, type: 'drop', src: h.id, text: e.name, to: { ...h.pos } });
      return COST.drop;
    }
    case 'use':
      if (a.item === 'potion') {
        if (g.belt.potion <= 0) return null;
        g.belt.potion--;
        const before = h.hp;
        h.hp = Math.min(h.maxHp, h.hp + HERO.heal);
        s.events.push({ t, type: 'heal', src: h.id, dst: h.id, amount: h.hp - before });
        return COST.potion;
      }
      return hooks.use(a);
    default:
      s.events.push({ t, type: 'wait', src: h.id });
      return COST.wait;
  }
}

