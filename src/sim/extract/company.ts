import { createRng } from '../../core/rng';
import type { GearSlot } from '../../data/extract';
import { generateRecruit } from '../roster/generate';
import { addXp } from '../roster/leveling';
import type { Mercenary } from '../roster/types';
import { putInto, stackValue, type Stack } from './inventory';
import { emptyLoadout, partyPack } from './loadout';
import { bank } from './merchant';
import { claimStarterKit, loadoutToStash, reconcileWeapon, stashToLoadout, type XProfile } from './profile';
import type { SortieEnd, XCompany } from './companyTypes';

export * from './companyTypes';
export const MAX_MERCS = 8;
export const MAX_PARTY = 5;
const START_GOLD = 80;
const START_MERCS = 3;

export const canDeploy = (m: Mercenary): boolean => m.injury < 2;
export const isGameOver = (c: XCompany): boolean => c.mercs.length === 0;
export const fee = (m: Mercenary): number => 40 + 30 * (m.level - 1);

/** A mercenary seen through the old single-hero profile, so its stash/gear helpers can be reused as they are. */
function asProfile(c: XCompany, id: string): XProfile {
  const hero = c.mercs.find((m) => m.id === id);
  if (!hero) throw new Error(`no mercenary ${id}`);
  return { version: 1, seed: c.seed, hero, gold: c.gold, stash: c.stash, loadout: c.gear[id] ?? emptyLoadout(), sorties: c.sorties, extracted: c.extracted, bestHaul: c.bestHaul };
}
const fromProfile = (c: XCompany, p: XProfile): XCompany => ({
  ...c, gold: p.gold, stash: p.stash, gear: { ...c.gear, [p.hero.id]: p.loadout }, mercs: c.mercs.map((m) => (m.id === p.hero.id ? p.hero : m)),
});

/** Gives a mercenary the free class kit (and fixes the weapon family after a promotion). */
export const kitUp = (c: XCompany, id: string): XCompany => fromProfile(c, reconcileWeapon(claimStarterKit(asProfile(c, id))));
export const stashToMerc = (c: XCompany, id: string, stashIndex: number): XCompany => fromProfile(c, stashToLoadout(asProfile(c, id), stashIndex));
export const mercToStash = (c: XCompany, id: string, slot: GearSlot): XCompany => fromProfile(c, loadoutToStash(asProfile(c, id), slot, 0));

function rollTavern(seed: number, sorties: number, nextId: number, used: Set<string>): XCompany['tavern'] {
  const rng = createRng((seed * 6151 + sorties * 911 + 3) >>> 0);
  return Array.from({ length: rng.int(2, 3) }, (_, i) => {
    const merc = generateRecruit(rng, { level: 1 + Math.min(4, Math.floor(sorties / 3) + (rng.chance(0.3) ? 1 : 0)), usedNames: used, id: `x${nextId + i}` });
    return { merc, fee: fee(merc) };
  });
}

export function newCompany(seed: number): XCompany {
  const rng = createRng(seed ^ 0x51ed);
  const used = new Set<string>();
  const mercs = Array.from({ length: START_MERCS }, (_, i) => generateRecruit(rng, { level: 1, usedNames: used, id: `x${i}` }));
  let c: XCompany = {
    version: 2, seed, gold: START_GOLD, stash: [], pack: [], pouch: null, mercs, gear: {}, party: mercs.map((m) => m.id),
    tavern: [], fallen: [], sorties: 0, extracted: 0, bestHaul: 0, nextId: START_MERCS,
  };
  for (const m of mercs) c = kitUp(c, m.id);
  return refreshTavern(c);
}

export function refreshTavern(c: XCompany): XCompany {
  const tavern = rollTavern(c.seed, c.sorties, c.nextId, new Set(c.mercs.map((m) => m.name)));
  return { ...c, tavern, nextId: c.nextId + tavern.length };
}

export function hire(c: XCompany, i: number): XCompany {
  const t = c.tavern[i];
  if (!t) throw new Error('no such candidate');
  if (c.mercs.length >= MAX_MERCS) throw new Error('company is full');
  if (c.gold < t.fee) throw new Error('not enough gold');
  const next = { ...c, gold: c.gold - t.fee, mercs: [...c.mercs, t.merc], tavern: c.tavern.filter((_, k) => k !== i) };
  return kitUp(next, t.merc.id);
}

/** The next party: living, able to deploy, in the given order, at most five. */
export function setParty(c: XCompany, ids: string[]): XCompany {
  const ok = ids.filter((id, k) => ids.indexOf(id) === k && c.mercs.some((m) => m.id === id && canDeploy(m)));
  return { ...c, party: ok.slice(0, MAX_PARTY) };
}

/** Supplies go from the stash into the sortie pack (bounded by the party's bags). */
export function stashToPack(c: XCompany, stashIndex: number): XCompany {
  const s = c.stash[stashIndex];
  if (!s) throw new Error(`nothing at stash[${stashIndex}]`);
  const cap = partyPack(c.party.map((id) => c.gear[id] ?? emptyLoadout()), c.pack, null);
  const r = putInto(c.pack, s.id, s.n, cap.slots!, () => true);
  if (!r.added) throw new Error('no room in the pack');
  const left = s.n - r.added;
  return { ...c, pack: r.list, stash: left ? c.stash.map((x, i) => (i === stashIndex ? { id: x.id, n: left } : x)) : c.stash.filter((_, i) => i !== stashIndex) };
}

/** Applies a sortie's end to the company. */
export function settleCompany(c: XCompany, end: SortieEnd): { company: XCompany; lost: Stack[]; gained: Stack[]; died: string[] } {
  const byId = new Map(end.members.map((m) => [m.id, m]));
  const died = end.members.filter((m) => m.state === 'dead').map((m) => m.id);
  const fallen = [...c.fallen, ...c.mercs.filter((m) => died.includes(m.id)).map((m) => ({ name: m.name, level: m.level, classId: m.classId, sortie: c.sorties + 1 }))];
  const mercs = c.mercs.filter((m) => !died.includes(m.id)).map((m) => {
    const e = byId.get(m.id);
    if (!e) return { ...m, injury: Math.max(0, m.injury - 1) };
    const grown = addXp(m, e.xp);
    // carried out: badly hurt for the next two sorties (3 → 2 → 1); otherwise a step of recovery like everyone
    return e.state === 'carried' ? { ...grown, injury: 3 } : { ...grown, injury: Math.max(0, grown.injury - 1) };
  });
  const gear = Object.fromEntries(mercs.map((m) => [m.id, byId.get(m.id)?.gear ?? c.gear[m.id]!]));
  const ok = end.outcome === 'extracted';
  const haul = ok ? end.pack.reduce((a, s) => a + stackValue(s), 0) : 0;
  const lostGear: Stack[] = end.members.filter((m) => m.state === 'dead').flatMap((m) => Object.values(m.gear.equipped).filter((x): x is string => !!x).map((id) => ({ id, n: 1 })));
  let next: XCompany = {
    ...c, mercs, gear, fallen, pack: [], pouch: end.pouch, sorties: c.sorties + 1, extracted: c.extracted + (ok ? 1 : 0), bestHaul: Math.max(c.bestHaul, haul),
  };
  next = ok ? bank(next, end.pack) : next;
  next = setParty(next, c.party);
  return { company: refreshTavern(next), lost: [...(ok ? [] : end.pack), ...lostGear], gained: ok ? end.pack : [], died };
}


export function packToStash(c: XCompany, i: number): XCompany {
  const s = c.pack[i];
  if (!s) throw new Error(`nothing at pack[${i}]`);
  return bank({ ...c, pack: c.pack.filter((_, k) => k !== i) }, [s]);
}

/** One stash stack into the safe pouch (the previous pouch item returns to the stash). */
export function stashToPouch(c: XCompany, i: number): XCompany {
  const s = c.stash[i];
  if (!s) throw new Error(`nothing at stash[${i}]`);
  const next = { ...c, stash: c.stash.filter((_, k) => k !== i), pouch: s };
  return c.pouch ? bank(next, [c.pouch]) : next;
}

export const pouchToStash = (c: XCompany): XCompany => (c.pouch ? bank({ ...c, pouch: null }, [c.pouch]) : c);

/** Moves a member one place forward (-1) or back (+1) in the sortie order; the first is the leader. */
export function moveInParty(c: XCompany, id: string, dir: -1 | 1): XCompany {
  const i = c.party.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= c.party.length) return c;
  const party = [...c.party];
  [party[i], party[j]] = [party[j]!, party[i]!];
  return { ...c, party };
}
