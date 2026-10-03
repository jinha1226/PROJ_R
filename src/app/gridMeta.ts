import { freshMeta, type MetaState } from '../sim/grid/meta';
const KEY = 'projr.grid.meta.v1';
const nonnegative = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
export function loadMeta(): MetaState {
  try {
    const text = localStorage.getItem(KEY);
    if (text !== null) {
      const m = JSON.parse(text) as MetaState;
      if (!m || !m.facilities || !Array.isArray(m.records) || !Array.isArray(m.startCandidates) || !Array.isArray(m.bossesKilled)) return freshMeta();
      return { ...freshMeta(), ...m, energy: nonnegative(m.energy), best: nonnegative(m.best), wins: nonnegative(m.wins) };
    }
    const old = JSON.parse(localStorage.getItem('projr.grid.v1') ?? 'null') as { best?: number; wins?: number } | null;
    const m = { ...freshMeta(), best: nonnegative(old?.best), wins: nonnegative(old?.wins) };
    saveMeta(m);
    return m;
  } catch { return freshMeta(); }
}
export function saveMeta(m: MetaState): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage unavailable */ }
}
