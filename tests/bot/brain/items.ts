import { buffOn } from '../../../src/sim/grid/buffs';
import { beltSlots, canThrow } from '../../../src/sim/grid/explosives';
import { isKnown, potionKey, POTIONS, scrollKey, SCROLLS, type PotionKind, type ScrollKind } from '../../../src/sim/grid/lore';
import { dist, type GAction, type GridState } from '../../../src/sim/grid/types';
import type { BotMemory } from './policy';
import { meleeFoe } from './tactics';
import { adjacentFoes, awakeThreats, direction, rangedReady, rangedWeapon, isChoke, safeSteps, visibleFoes } from './view';

const knownPotion = (s: GridState, p: PotionKind) => (s.hero.gear.potions[p] ?? 0) > 0 && isKnown(s, potionKey(p));
const knownScroll = (s: GridState, sc: ScrollKind) => (s.hero.gear.scrolls[sc] ?? 0) > 0 && isKnown(s, scrollKey(sc));
export function emergency(s: GridState, mem: BotMemory): GAction | null {
  const h = s.hero, threats = awakeThreats(s), adjacent = adjacentFoes(s);
  if (!(h.hp <= h.maxHp * 0.35 || h.hp <= h.maxHp * 0.5 && adjacent.length >= 2)) return null;
  if (h.gear.belt.potion > 0 && h.maxHp - h.hp >= 15) return { kind: 'use', item: 'potion' };
  if (threats.length && knownScroll(s, 'teleport')) return { kind: 'read', sc: 'teleport' };
  if (threats.filter(f => dist(f.pos, h.pos) <= 8).length >= 2 && knownScroll(s, 'fear')) return { kind: 'read', sc: 'fear' };
  if (threats.length && knownPotion(s, 'invis') && !buffOn(h, 'invis', h.nextAt)) return { kind: 'drink', p: 'invis' };
  if (h.hp <= h.maxHp * 0.35 && (h.status?.burn || h.status?.poison) && knownPotion(s, 'cure')) return { kind: 'drink', p: 'cure' };
  const melee = threats.filter(meleeFoe);
  if (!melee.length || mem.retreats >= 3) return null;
  const distance = (c: typeof h.pos) => Math.min(...melee.map(f => dist(c, f.pos)));
  const to = safeSteps(s).filter(c => distance(c) > distance(h.pos))
    .sort((a, b) => distance(b) - distance(a) || Number(isChoke(s, b)) - Number(isChoke(s, a)))[0];
  if (!to) return null;
  mem.retreats++;
  return { kind: 'move', dir: direction(h.pos, to), plain: true };
}

export function fightUtility(s: GridState, mem: BotMemory): GAction | null {
  const h = s.hero, foes = visibleFoes(s), awake = foes.filter(f => f.awake);
  if (rangedWeapon(s)?.group === 'staff' && !rangedReady(s) && awake.length >= 2 && knownScroll(s, 'recharge')) return { kind: 'read', sc: 'recharge' };
  const champion = foes.find(f => f.kind === 'champion' && !mem.bosses.includes(f.id));
  if (((champion && (h.hp >= h.maxHp * 0.8 || awakeThreats(s).length > 0)) || awake.length >= 3) && knownPotion(s, 'haste') && !buffOn(h, 'haste', h.nextAt)) return { kind: 'drink', p: 'haste' };
  if (!awake.length) return null;
  const targets = foes.filter(f => dist(h.pos, f.pos) > 1 && canThrow(s, f.pos))
    .map(f => ({ f, count: foes.filter(o => dist(o.pos, f.pos) <= 1).length }))
    .filter(({ f, count }) => count >= 2 || f.elite || f.kind === 'champion')
    .sort((a, b) => b.count - a.count);
  const at = targets[0]?.f.pos; if (!at) return null;
  for (const p of ['fire', 'frost', 'poison', 'confuse'] as const) if (knownPotion(s, p)) return { kind: 'throwPotion', p, at };
  const belt = beltSlots(h.gear.belt)[0];
  return belt ? { kind: 'use', item: belt.item, at } : null;
}

export function utility(s: GridState, mem: BotMemory): GAction | null {
  const h = s.hero;
  if (awakeThreats(s).length || h.hp < h.maxHp * 0.9) return null;
  if (knownPotion(s, 'strength')) return { kind: 'drink', p: 'strength' };
  if (knownScroll(s, 'engrave')) return { kind: 'read', sc: 'engrave' };
  if (knownScroll(s, 'map') && !mem.mappedFloors.includes(s.run.floor)) return { kind: 'read', sc: 'map' };
  // Pick unidentified items by their visible appearance, never by their hidden effect.
  const scroll = SCROLLS.filter(sc => (h.gear.scrolls[sc] ?? 0) > 0 && !isKnown(s, scrollKey(sc)))
    .sort((a, b) => s.lore.runes[a].localeCompare(s.lore.runes[b]))[0];
  if (scroll) return { kind: 'read', sc: scroll };
  if (h.hp === h.maxHp && !s.foes.some(f => f.alive && f.awake && dist(f.pos, h.pos) <= 12)) {
    const potion = POTIONS.filter(p => (h.gear.potions[p] ?? 0) > 0 && !isKnown(s, potionKey(p)))
      .sort((a, b) => s.lore.colors[a].localeCompare(s.lore.colors[b]))[0];
    if (potion) return { kind: 'drink', p: potion };
  }
  return null;
}
