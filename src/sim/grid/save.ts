import { createRng } from '../../core/rng';
import type { GridState } from './types';

type SavedState = Omit<GridState, 'rng' | 'seen' | 'visible' | 'fired'> & {
  rng: number; seen: number[]; visible: number[]; fired: string[];
};
export function toSave(s: GridState): string {
  return JSON.stringify({ version: 1, state: { ...s, rng: s.rng.getState(), seen: [...s.seen], visible: [...s.visible], fired: [...s.fired] } });
}
export function fromSave(text: string): GridState {
  const data = JSON.parse(text) as { version: number; state?: SavedState } | null;
  const s = data?.state;
  if (data?.version !== 1 || !s || !s.hero || !s.run || !s.map || !Number.isInteger(s.rng)
    || !Array.isArray(s.seen) || s.seen.length !== s.map.w * s.map.h
    || !Array.isArray(s.visible) || !Array.isArray(s.fired)
    || !Array.isArray(s.foes) || !Array.isArray(s.floorItems) || !Array.isArray(s.records)
    || !Array.isArray(s.run.bossesKilled) || !Number.isFinite(s.run.energy)) throw new Error('Invalid grid run save');
  s.hero.fx.free ??= false;
  s.hero.shield ??= 0;
  for (const { item } of s.floorItems) if (item.kind === 'echo') {
    const family: string = item.family;
    if (family === 'magic') item.family = 'element';
    if (family === 'any' || family === 'all') item.family = 'fusion';
  }
  // mulberry32's seed is its full state, so constructing from getState resumes the next draw.
  return { ...s, rng: createRng(s.rng), seen: new Uint8Array(s.seen), visible: new Set(s.visible), fired: new Set(s.fired) };
}
