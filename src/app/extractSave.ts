import type { XCompany } from '../sim/extract/company';
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

const KEY_V2 = 'projr.extract.v2';

const isCompany = (x: unknown): x is XCompany => {
  const c = x as Partial<XCompany> | null;
  if (!c || c.version !== 2 || typeof c.seed !== 'number' || typeof c.gold !== 'number') return false;
  if (!Array.isArray(c.mercs) || !c.mercs.every((m) => typeof m?.id === 'string' && typeof m.classId === 'string')) return false;
  if (!Array.isArray(c.stash) || !c.stash.every(isStack) || !Array.isArray(c.pack) || !c.pack.every(isStack)) return false;
  if (!c.gear || typeof c.gear !== 'object' || !Array.isArray(c.party) || !Array.isArray(c.tavern) || !Array.isArray(c.fallen)) return false;
  return c.pouch === null || isStack(c.pouch);
};

export function saveCompany(c: XCompany, kv: KV | null = defaultKV()): boolean {
  try {
    kv?.setItem(KEY_V2, JSON.stringify(c));
    return !!kv;
  } catch {
    return false;
  }
}

export function loadCompany(kv: KV | null = defaultKV()): XCompany | null {
  try {
    const raw = kv?.getItem(KEY_V2);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return isCompany(data) ? data : null;
  } catch {
    return null;
  }
}

export function clearCompany(kv: KV | null = defaultKV()): void {
  try {
    kv?.removeItem(KEY_V2);
  } catch {
    /* storage unavailable */
  }
}
