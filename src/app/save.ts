import type { RunState } from '../sim/run/types';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface HallEntry {
  companyName: string;
  protagonist: string;
  result: 'won' | 'lost';
  step: number;
  survivors: { name: string; level: number; title?: string }[];
  fallen: string[];
  date: string;
  seed: number;
}

const RUN_KEY = 'projr.run.v2';
const HALL_KEY = 'projr.hall.v1';
const HALL_MAX = 20;

const defaultKV = (): KV | null => {
  try {
    return (globalThis as { localStorage?: KV }).localStorage ?? null;
  } catch {
    return null;
  }
};

const isRun = (x: unknown): x is RunState => {
  const r = x as Partial<RunState> | null;
  if (!r || r.version !== 2 || typeof r.seed !== 'number' || typeof r.gold !== 'number' || typeof r.status !== 'string') return false;
  if (typeof r.week !== 'number' || typeof r.phase !== 'string') return false;
  const ro = r.roster;
  if (!ro || !Array.isArray(ro.mercs) || !Array.isArray(ro.relations) || !Array.isArray(ro.inventory) || !Array.isArray(ro.memorial)) return false;
  if (!r.formation || typeof r.formation !== 'object') return false;
  const e = r.exploration;
  return !e || (typeof e.rooms === 'object' && !!e.rooms && !!e.rooms[e.at]);
};

export function saveRun(run: RunState, kv: KV | null = defaultKV()): boolean {
  try {
    kv?.setItem(RUN_KEY, JSON.stringify(run));
    return !!kv;
  } catch {
    return false;
  }
}

export function loadRun(kv: KV | null = defaultKV()): RunState | null {
  try {
    const raw = kv?.getItem(RUN_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return isRun(data) ? data : null;
  } catch {
    return null;
  }
}

export function clearRun(kv: KV | null = defaultKV()): void {
  try {
    kv?.removeItem(RUN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function loadHall(kv: KV | null = defaultKV()): HallEntry[] {
  try {
    const raw = kv?.getItem(HALL_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as unknown[]).filter((e): e is HallEntry => !!e && typeof e === 'object' && typeof (e as HallEntry).companyName === 'string') : [];
  } catch {
    return [];
  }
}

export function addHall(e: HallEntry, kv: KV | null = defaultKV()): void {
  try {
    kv?.setItem(HALL_KEY, JSON.stringify([e, ...loadHall(kv)].slice(0, HALL_MAX)));
  } catch {
    /* storage unavailable */
  }
}
