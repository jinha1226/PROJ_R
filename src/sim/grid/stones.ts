import { applyStatDelta, effectiveMods, MODS, replaceMods, type ModSlot } from './mods';
import type { Family } from './engraveDefs';
import type { StoneItem } from './items';
import type { GridState } from './types';

export const GUARDIANS: Record<string, { floor: 5 | 10; mod: string; name: string }> = {
  guardian5: { floor: 5, mod: 'whirlHeart', name: '동굴 수호자의 핵' },
  guardian10: { floor: 10, mod: 'undyingHeart', name: '묘지 수호자의 핵' },
};
export const guardian = (id: string) => Object.hasOwn(GUARDIANS, id) ? GUARDIANS[id] : undefined;
export const STONE_DROPS = { elite: 0.35, chest: 0.1 };
const POOLS: Record<Family, ModSlot[]> = {
  melee: ['arms', 'legs', 'chest'], ranged: ['barrel', 'sight'], element: ['mag', 'back'],
  fusion: ['grip', 'barrel', 'mag', 'sight', 'chest', 'arms', 'legs', 'back'],
};
export const stoneMod = (id: string) => MODS.find(m => m.id === (guardian(id)?.mod ?? id) && m.stone);
export const stoneItem = (id: string): StoneItem => ({ kind: 'stone', id, name: guardian(id)?.name ?? `${stoneMod(id)!.name} 마석` });
export function rollStone(s: GridState, family?: Family): StoneItem {
  const pool = MODS.filter(m => m.stone && m.slot !== 'heart' && (!family || POOLS[family].includes(m.slot)));
  const fresh = pool.filter(m => !(s.run.modsUnlocked ?? []).includes(m.id));
  return stoneItem(s.rng.pick(fresh.length ? fresh : pool).id);
}
export function takeStone(s: GridState, t: number, id: string): void {
  (s.run.stones ??= []).push(id); s.stonePrompt = id;
  s.events.push({ t, type: 'stone', text: id });
}
export function socketStone(s: GridState, id: string | null): number | null {
  if (id === null) { delete s.stonePrompt; return 0; }
  const mod = stoneMod(id), h = s.hero;
  if (!mod || !s.run.stones.includes(id) || Object.values(h.sockets ?? {}).includes(id)) return null;
  const legacy = h.legacyMods?.[mod.slot];
  if (legacy) { applyStatDelta(h, legacy, {}); delete h.legacyMods![mod.slot]; }
  const sockets = h.sockets ??= {}, old = sockets[mod.slot];
  const before = effectiveMods(h.baseMods ?? {}, sockets);
  if (old) {
    const at = s.run.stones.indexOf(old); if (at >= 0) s.run.stones.splice(at, 1);
    delete sockets[mod.slot]; s.events.push({ t: h.nextAt, type: 'stoneBreak', text: old });
  }
  sockets[mod.slot] = id;
  replaceMods(h, before, effectiveMods(h.baseMods ?? {}, sockets));
  delete s.stonePrompt;
  s.events.push({ t: h.nextAt, type: 'buff', text: id });
  return 0;
}

export function openPortal(s: GridState, id: string): number | null {
  const g = guardian(id), at = s.run.stones.indexOf(id);
  if (!g || at < 0 || Object.values(s.hero.sockets ?? {}).includes(id)) return null;
  s.run.stones.splice(at, 1); s.run.portal = g.floor; s.outcome = 'returned';
  delete s.stonePrompt;
  s.events.push({ t: s.hero.nextAt, type: 'portal', text: String(g.floor) });
  return 0;
}
