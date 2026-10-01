import type { Vec2 } from '../../core/vec2';
import { xitem } from '../../data/extract';
import { addItem, equipFromBag, moveToQuick, removeAt, unequipToBag } from '../extract/loadout';
import { mergeAll, type Stack } from '../extract/inventory';
import { rollContainer, rollDrop } from '../extract/loot';
import type { GearSlot } from '../../data/extract';
import { WEAPON_TYPE_OF_CLASS } from '../../data/items';
import { NavGrid } from './nav';
import type { WorldState } from './types';
import { emitW, heroUnit } from './worldState';
import { refreshHero } from './heroRefresh';

export const REACH = 2.2;
const SEARCH_TICKS = 30;
const EQUIP_TICKS = 40;
const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export type Nearby = { kind: 'search' | 'loot' | 'door' | 'locked'; id: string } | null;

/** What the hero could interact with right now (drives the prompt). */
export function nearby(w: WorldState): Nearby {
  const h = heroUnit(w).pos;
  for (const p of w.region.pois) {
    if (!p.door || w.doorsOpen.includes(p.id) || d(h, p.door.box.pos) > REACH + 0.6) continue;
    return { kind: w.hero.loadout.bag.some((s) => s.id === p.door!.key) ? 'door' : 'locked', id: p.id };
  }
  const chests = w.region.containers.filter((c) => d(h, c.pos) <= REACH).sort((a, b) => d(h, a.pos) - d(h, b.pos));
  const c = chests[0];
  if (c) return { kind: w.containers[c.id]?.opened ? 'loot' : 'search', id: c.id };
  const pile = w.piles.find((p) => p.items.length && d(h, p.pos) <= REACH);
  return pile ? { kind: 'loot', id: pile.id } : null;
}

export function interact(w: WorldState): void {
  const n = nearby(w);
  if (!n) return;
  if (n.kind === 'search') w.hero.channel = { kind: 'search', ticks: 0, total: SEARCH_TICKS, target: n.id };
  else if (n.kind === 'door') openDoor(w, n.id);
  else if (n.kind === 'loot') emitW(w, 'loot', { id: n.id });
}

function openDoor(w: WorldState, poiId: string): void {
  const poi = w.region.pois.find((p) => p.id === poiId)!;
  const key = w.hero.loadout.bag.findIndex((s) => s.id === poi.door!.key);
  w.hero.loadout = removeAt(w.hero.loadout, 'bag', key, 1).loadout;
  const box = poi.door!.box;
  w.b.obstacles = w.b.obstacles.filter((o) => !(o.kind === 'box' && o.pos.x === box.pos.x && o.pos.y === box.pos.y && o.half?.x === box.half?.x));
  w.nav = new NavGrid(w.region.bounds, w.b.obstacles);
  w.doorsOpen.push(poiId);
  refreshHero(w);
  emitW(w, 'door', { id: poiId });
}

export function finishSearch(w: WorldState, id: string): void {
  const c = w.region.containers.find((x) => x.id === id)!;
  w.containers[id] = { opened: true, items: rollContainer(c, w.seed, w.b.tick / (60 * 20)) };
  emitW(w, 'loot', { id });
}

export function lootSource(w: WorldState, id: string): Stack[] | undefined {
  return w.containers[id]?.items ?? w.piles.find((p) => p.id === id)?.items;
}

/** Takes as much of one stack as the bag allows. */
export function lootTake(w: WorldState, id: string, index: number): boolean {
  const items = lootSource(w, id);
  const s = items?.[index];
  const pos = w.region.containers.find((c) => c.id === id)?.pos ?? w.piles.find((p) => p.id === id)?.pos;
  if (!items || !s || !pos || d(heroUnit(w).pos, pos) > REACH + 0.5) return false;
  const r = addItem(w.hero.loadout, s.id, s.n);
  if (!r.added) return false;
  w.hero.loadout = r.loadout;
  const left = s.n - r.added;
  if (left) items[index] = { id: s.id, n: left };
  else items.splice(index, 1);
  refreshHero(w);
  return true;
}

export function dropAt(w: WorldState, pos: Vec2, stacks: Stack[]): void {
  if (!stacks.length) return;
  const pile = w.piles.find((p) => d(p.pos, pos) < 1.2);
  if (pile) pile.items = mergeAll(pile.items, stacks);
  else w.piles.push({ id: `pile${w.piles.length}_${w.b.tick}`, pos: { ...pos }, items: mergeAll([], stacks) });
}

export function lootDrop(w: WorldState, where: 'bag' | 'quick', index: number): void {
  const r = removeAt(w.hero.loadout, where, index);
  w.hero.loadout = r.loadout;
  dropAt(w, heroUnit(w).pos, [r.taken]);
  refreshHero(w);
}

export function startEquip(w: WorldState, index: number): void {
  const s = w.hero.loadout.bag[index];
  if (!s || xitem(s.id).kind !== 'gear' || (w.hero.channel && w.hero.channel.kind !== 'search')) return;
  w.hero.channel = { kind: 'equip', ticks: 0, total: EQUIP_TICKS, target: s.id };
}

/** Puts on the item chosen when the equip began (the bag may have shifted meanwhile). */
export function finishEquip(w: WorldState, itemId: string): void {
  const index = w.hero.loadout.bag.findIndex((s) => s.id === itemId);
  if (index < 0) return void emitW(w, 'equip_failed');
  try {
    const r = equipFromBag(w.hero.loadout, index, WEAPON_TYPE_OF_CLASS[w.hero.merc.classId]);
    w.hero.loadout = r.loadout;
    dropAt(w, heroUnit(w).pos, r.dropped);
    refreshHero(w);
  } catch {
    emitW(w, 'equip_failed');
  }
}

export function unequip(w: WorldState, slot: GearSlot): void {
  const r = unequipToBag(w.hero.loadout, slot);
  w.hero.loadout = r.loadout;
  dropAt(w, heroUnit(w).pos, r.dropped);
  refreshHero(w);
}

export const toQuick = (w: WorldState, bagIndex: number, quickIndex: number): void => { w.hero.loadout = moveToQuick(w.hero.loadout, bagIndex, quickIndex); };

/** Moves one bag stack into the safe pouch (swapping what was there). */
export function toPouch(w: WorldState, bagIndex: number): void {
  const l = w.hero.loadout;
  const s = l.bag[bagIndex];
  if (!s) return;
  const bag = l.bag.filter((_, i) => i !== bagIndex);
  if (l.pouch) bag.splice(bagIndex, 0, l.pouch);
  w.hero.loadout = { ...l, bag, pouch: s };
}

/** A fallen enemy's body holds its drop. */
export function dropBody(w: WorldState, enemyId: string, unitId: string, stage: number, pos: Vec2): void {
  dropAt(w, pos, rollDrop(enemyId, stage, (w.seed ^ [...unitId].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) >>> 0));
}
