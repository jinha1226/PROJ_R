import { createRng, type Rng } from '../../core/rng';
import { addBuff, clearBuff } from './buffs';
import { noise } from './danger';
import { offerFor } from './engrave';
import { canThrow } from './explosives';
import { type Consumable, type Element } from './items';
import { identify, isKnown, potionKey, POTIONS, scrollKey, SCROLLS, type PotionKind, type ScrollKind } from './lore';
import { addStatus, applyElement, areaCells, entsAt } from './status';
import { teleport } from './traps';
import { dist, idx, same, tileAt, type Cell, type FloorItem, type GridState } from './types';

const INVIS_TURNS = 10;
const HASTE_TURNS = 5;
const CONFUSE_TURNS = 5;
const FEAR_TURNS = 5;
const FEAR_RANGE = 8;
const LURE_RANGE = 15;
const POTION_SHARE = 0.6;
const THROWN: Partial<Record<PotionKind, { el: Element; dmg: [number, number] | null }>> = {
  fire: { el: 'fire', dmg: [3, 6] }, poison: { el: 'poison', dmg: null }, frost: { el: 'frost', dmg: [2, 4] },
};

export function rollConsumable(rng: Rng): Consumable {
  return rng.chance(POTION_SHARE) ? { kind: 'potion', p: rng.pick(POTIONS), name: '물약' } : { kind: 'scroll', sc: rng.pick(SCROLLS), name: '주문서' };
}

/** Puts a potion or scroll in the hero's pack (no bag limit). */
export function stow(s: GridState, c: Consumable): void {
  const g = s.hero.gear;
  if (c.kind === 'potion') g.potions[c.p] = (g.potions[c.p] ?? 0) + 1;
  else g.scrolls[c.sc] = (g.scrolls[c.sc] ?? 0) + 1;
}

/** Drinks a potion (one turn); it is known from then on. null with none to drink. */
export function drink(s: GridState, t: number, p: PotionKind): number | null {
  const h = s.hero;
  const g = h.gear;
  if (!((g.potions[p] ?? 0) > 0)) return null;
  g.potions[p]!--;
  s.events.push({ t, type: 'drink', src: h.id, text: p, to: { ...h.pos } });
  identify(s, potionKey(p), t);
  if (p === 'strength') h.str++;
  if (p === 'cure') { if (h.status) h.status = { burn: 0, freeze: 0, poison: 0 }; clearBuff(h, 'confuse'); }
  if (p === 'invis') addBuff(s, h, 'invis', INVIS_TURNS, t);
  if (p === 'haste') addBuff(s, h, 'haste', HASTE_TURNS, t);
  if (p === 'confuse') addBuff(s, h, 'confuse', CONFUSE_TURNS, t);
  const el = THROWN[p]?.el;
  if (el) addStatus(s, t, h, el, 'potion');
  return 1;
}

/** Throws a potion (one turn): harmful ones break over the cell and are known by it, the rest just shatter. */
export function throwPotion(s: GridState, t: number, p: PotionKind, at: Cell): number | null {
  const g = s.hero.gear;
  if (!((g.potions[p] ?? 0) > 0) || !canThrow(s, at)) return null;
  g.potions[p]!--;
  s.events.push({ t, type: 'use', src: s.hero.id, to: { ...at }, text: `potion:${p}` });
  const el = THROWN[p];
  if (el) { applyElement(s, t, el.el, at, 1, el.dmg, s.hero.id); identify(s, potionKey(p), t); }
  if (p === 'confuse') {
    for (const c of areaCells(s, at, 1)) for (const e of entsAt(s, c)) addBuff(s, e, 'confuse', CONFUSE_TURNS, t);
    identify(s, potionKey(p), t);
  }
  for (const e of [s.hero, ...s.foes]) if (e.alive && dist(e.pos, at) <= 1) e.awake = true;
  return 1;
}

/** Reads a scroll (one turn); it is known from then on. */
export function readScroll(s: GridState, t: number, sc: ScrollKind): number | null {
  const h = s.hero;
  const g = h.gear;
  if (!((g.scrolls[sc] ?? 0) > 0)) return null;
  g.scrolls[sc]!--;
  s.events.push({ t, type: 'read', src: h.id, text: sc, to: { ...h.pos } });
  identify(s, scrollKey(sc), t);
  switch (sc) {
    case 'identify': {
      const all = [...POTIONS.map(potionKey), ...SCROLLS.map(scrollKey)].filter((k) => !isKnown(s, k));
      const held = all.filter((k) => { const [type, kind] = k.split(':'); return ((type === 'potion' ? g.potions[kind as PotionKind] : g.scrolls[kind as ScrollKind]) ?? 0) > 0; });
      const pool = held.length ? held : all;
      if (pool.length) identify(s, s.rng.pick(pool), t);
      break;
    }
    case 'engrave': s.offers.push(offerFor(s, false)); break;
    case 'teleport': teleport(s, h, t); break;
    case 'map':
      s.seen.fill(1);
      for (const tr of s.traps) if (!tr.found) { tr.found = true; s.events.push({ t, type: 'trapFound', src: h.id, to: { ...tr.pos }, text: tr.kind }); }
      break;
    case 'fear':
      for (const f of s.foes) if (f.alive && dist(f.pos, h.pos) <= FEAR_RANGE && s.visible.has(idx(s.map, f.pos))) addBuff(s, f, 'fear', FEAR_TURNS, t);
      break;
    case 'lure':
      noise(s, h.pos, LURE_RANGE, true);
      for (const f of s.foes) if (f.alive && f.awake) f.lastSeen = { ...h.pos };
      break;
    case 'recharge':
      h.charge = h.maxCharge;
      break;
  }
  return 1;
}

/** A couple of potions or scrolls lying in the rooms of a floor (its own dice; not the start room). */
export function scatterLoot(s: GridState): FloorItem[] {
  const rng = createRng((s.seed * 13 + s.run.floor * 7) >>> 0);
  const cells: Cell[] = [];
  for (const r of s.map.rooms.slice(1)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const c = { x, y };
    if (tileAt(s.map, c) !== 'floor' || s.chests.some((ch) => same(ch.pos, c)) || s.barrels.some((b) => same(b, c)) || s.traps.some((tr) => same(tr.pos, c))) continue;
    if (s.foes.some((f) => same(f.pos, c)) || (s.map.stairs && same(c, s.map.stairs)) || s.floorItems.some((f) => same(f.pos, c))) continue;
    cells.push(c);
  }
  return rng.shuffle(cells).slice(0, 2 + Math.floor((s.run.floor - 1) / 5)).map((pos) => ({ pos, item: rollConsumable(rng) }));
}
