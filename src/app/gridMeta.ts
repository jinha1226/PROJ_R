import { validElements } from '../sim/grid/rounds';
import { BASE_IDS, type EngraveId } from '../sim/grid/engraveCore';
import { freshMeta, type MetaState } from '../sim/grid/meta';
const KEY = 'projr.grid.meta.v1';
const nonnegative = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
export function loadMeta(): MetaState {
  try {
    const text = localStorage.getItem(KEY);
    if (text !== null) {
      const m = JSON.parse(text) as MetaState;
      if (!m || !m.facilities || !Array.isArray(m.records) || !Array.isArray(m.startCandidates) || !Array.isArray(m.bossesKilled)) return freshMeta();
      const defaults = freshMeta();
      const ids = (v: unknown, fallback: EngraveId[]): EngraveId[] => Array.isArray(v)
        ? [...new Set(v.filter((id): id is EngraveId => BASE_IDS.includes(id as EngraveId)))] : fallback;
      const legacy = !Object.hasOwn(m, 'unlocked');
      const slots = Number(m.facilities.suitSlots) + (legacy ? 1 : 0);
      const facilities = { ...defaults.facilities,
        chargePlus: m.facilities.chargePlus ?? 0, navCrypt: !!m.facilities.navCrypt, navRuins: !!m.facilities.navRuins,
        suitSlots: ([2, 3, 4].includes(slots) ? slots : 2) as 2 | 3 | 4 };
      return { ...defaults, ...m, facilities, rounds: validElements(m.rounds), records: ids(m.records, defaults.records),
        startCandidates: ids(m.startCandidates, []), suit: m.suit ? { ...m.suit, ids: ids(m.suit.ids, []) } : undefined, unlocked: ids(m.unlocked, defaults.unlocked), tasted: ids(m.tasted, []), energy: nonnegative(m.energy), best: nonnegative(m.best), wins: nonnegative(m.wins) };
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
