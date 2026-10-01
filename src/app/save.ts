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

const RUN_KEY = 'projr.run.v1';
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
  return !!r && r.version === 1 && typeof r.seed === 'number' && typeof r.gold === 'number' && !!r.roster
    && Array.isArray(r.roster.mercs) && !!r.map && typeof r.map.nodes === 'object' && Array.isArray(r.visited) && typeof r.status === 'string';
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
    return Array.isArray(data) ? (data as HallEntry[]) : [];
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
