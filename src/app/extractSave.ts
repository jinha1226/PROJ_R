import type { XProfile } from '../sim/extract/profile';
import type { KV } from './save';

const KEY = 'projr.extract.v1';

const defaultKV = (): KV | null => {
  try {
    return (globalThis as { localStorage?: KV }).localStorage ?? null;
  } catch {
    return null;
  }
};

const isStack = (s: unknown) => !!s && typeof (s as { id?: unknown }).id === 'string' && typeof (s as { n?: unknown }).n === 'number';
const isProfile = (x: unknown): x is XProfile => {
  const p = x as Partial<XProfile> | null;
  if (!p || p.version !== 1 || typeof p.seed !== 'number' || typeof p.gold !== 'number' || !p.hero || typeof p.hero.classId !== 'string') return false;
  if (!Array.isArray(p.stash) || !p.stash.every(isStack)) return false;
  const l = p.loadout;
  return !!l && typeof l.equipped === 'object' && Array.isArray(l.bag) && l.bag.every(isStack) && Array.isArray(l.quick) && (l.pouch === null || isStack(l.pouch));
};

export function saveProfile(p: XProfile, kv: KV | null = defaultKV()): boolean {
  try {
    kv?.setItem(KEY, JSON.stringify(p));
    return !!kv;
  } catch {
    return false;
  }
}

export function loadProfile(kv: KV | null = defaultKV()): XProfile | null {
  try {
    const raw = kv?.getItem(KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return isProfile(data) ? data : null;
  } catch {
    return null;
  }
}

export function clearProfile(kv: KV | null = defaultKV()): void {
  try {
    kv?.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
