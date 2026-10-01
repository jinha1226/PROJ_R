import { describe, it, expect } from 'vitest';
import {
  newProfile, claimStarterKit, reconcileWeapon, canSortie, settleSortie, sell, buy, stashToLoadout, loadoutToStash, STASH_SLOTS, MERCHANT_STOCK,
} from '../../src/sim/extract/profile';
import { saveProfile, loadProfile, clearProfile } from '../../src/app/extractSave';
import type { KV } from '../../src/app/save';
import { xitem } from '../../src/data/extract';
import { emptyLoadout, type Loadout } from '../../src/sim/extract/loadout';

const memKV = (): KV => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };

describe('extraction profile', () => {
  it('starts as a novice with the starter kit and some gold', () => {
    const p = newProfile(3);
    expect(p.version).toBe(1);
    expect(p.hero.classId).toBe('novice');
    expect(p.loadout.equipped.weapon).toBe('x_sword_shield_0');
    expect(p.loadout.equipped.chest).toBe('x_chest_0');
    expect(p.gold).toBe(50);
    expect(p.stash).toEqual([]);
  });

  it('the free kit only fills empty slots', () => {
    const p = { ...newProfile(3), loadout: { ...emptyLoadout(), equipped: { chest: 'x_chest_2' } } };
    const q = claimStarterKit(p);
    expect(q.loadout.equipped).toEqual({ chest: 'x_chest_2', weapon: 'x_sword_shield_0' });
  });

  it('extracting banks the bag into the stash and keeps the gear; xp levels the hero', () => {
    const p = newProfile(3);
    const out: Loadout = { ...p.loadout, bag: [{ id: 'x_crown', n: 1 }, { id: 'x_bone', n: 4 }], pouch: { id: 'x_idol', n: 1 } };
    const r = settleSortie(p, { outcome: 'extracted', loadout: out, xp: 500 });
    expect(r.profile.stash).toEqual([{ id: 'x_crown', n: 1 }, { id: 'x_bone', n: 4 }]);
    expect(r.profile.loadout.bag).toEqual([]);
    expect(r.profile.loadout.pouch).toEqual({ id: 'x_idol', n: 1 });
    expect(r.profile.loadout.equipped).toEqual(p.loadout.equipped);
    expect(r.gained).toEqual([{ id: 'x_crown', n: 1 }, { id: 'x_bone', n: 4 }]);
    expect(r.profile.hero.level).toBeGreaterThan(1);
    expect([r.profile.sorties, r.profile.extracted]).toEqual([1, 1]);
    expect(r.profile.bestHaul).toBe(xitem('x_crown').value + 4 * xitem('x_bone').value);
  });

  it('going down loses gear, bag and quick slots — only the pouch survives', () => {
    const p = newProfile(3);
    const out: Loadout = { ...p.loadout, bag: [{ id: 'x_crown', n: 1 }], quick: [{ id: 'x_potion_s', n: 1 }], pouch: { id: 'x_idol', n: 1 } };
    const r = settleSortie(p, { outcome: 'downed', loadout: out, xp: 40 });
    expect(r.profile.loadout).toEqual({ equipped: {}, bag: [], quick: [null], pouch: { id: 'x_idol', n: 1 } });
    expect(r.lost.map((s) => s.id).sort()).toEqual(['x_chest_0', 'x_crown', 'x_potion_s', 'x_sword_shield_0'].sort());
    expect(r.profile.extracted).toBe(0);
  });

  it('an overflowing stash is kept but blocks the next sortie', () => {
    const p = newProfile(3);
    const bag = Array.from({ length: STASH_SLOTS + 2 }, () => ({ id: 'x_lute', n: 1 }));
    const r = settleSortie(p, { outcome: 'extracted', loadout: { ...p.loadout, bag }, xp: 0 });
    expect(r.profile.stash.length).toBe(STASH_SLOTS + 2);
    expect(canSortie(r.profile).ok).toBe(false);
    expect(canSortie(sell(r.profile, 0)).ok).toBe(false);
    expect(canSortie(sell(sell(r.profile, 0), 0)).ok).toBe(true);
  });

  it('sells at value and buys at twice the value', () => {
    let p = { ...newProfile(3), stash: [{ id: 'x_bone', n: 3 }] };
    p = sell(p, 0, 2);
    expect(p.gold).toBe(50 + 2 * xitem('x_bone').value);
    expect(p.stash).toEqual([{ id: 'x_bone', n: 1 }]);
    const item = MERCHANT_STOCK[0]!;
    const q = buy({ ...p, gold: 1000 }, item);
    expect(q.gold).toBe(1000 - 2 * xitem(item).value);
    expect(q.stash.some((s) => s.id === item)).toBe(true);
    expect(() => buy({ ...p, gold: 0 }, item)).toThrow();
    expect(() => buy({ ...p, gold: 9999 }, 'x_idol')).toThrow();
  });

  it('moves things between the stash and the loadout', () => {
    let p = { ...newProfile(3), stash: [{ id: 'x_head_1', n: 1 }, { id: 'x_potion_m', n: 2 }, { id: 'x_crown', n: 1 }] };
    p = stashToLoadout(p, 0);
    expect(p.loadout.equipped.head).toBe('x_head_1');
    p = stashToLoadout(p, 0);
    expect(p.loadout.quick[0]).toEqual({ id: 'x_potion_m', n: 2 });
    p = stashToLoadout(p, 0);
    expect(p.loadout.bag).toEqual([{ id: 'x_crown', n: 1 }]);
    p = loadoutToStash(p, 'bag', 0);
    p = loadoutToStash(p, 'head', 0);
    expect(p.stash.map((s) => s.id).sort()).toEqual(['x_crown', 'x_head_1']);
  });

  it('after promotion an unusable weapon goes to the stash and the class starter weapon is worn', () => {
    const p = newProfile(3);
    const mage = { ...p, hero: { ...p.hero, classId: 'mage' as const }, loadout: { ...p.loadout, equipped: { ...p.loadout.equipped, weapon: 'x_sword_shield_2' } } };
    const q = reconcileWeapon(mage);
    expect(q.loadout.equipped.weapon).toBe('x_staff_0');
    expect(q.stash).toEqual([{ id: 'x_sword_shield_2', n: 1 }]);
    expect(reconcileWeapon(p)).toEqual(p);
  });

  it('saves and loads, rejecting broken saves', () => {
    const kv = memKV();
    const p = newProfile(9);
    expect(saveProfile(p, kv)).toBe(true);
    expect(loadProfile(kv)).toEqual(p);
    kv.setItem('projr.extract.v1', '{"version":1}');
    expect(loadProfile(kv)).toBeNull();
    clearProfile(kv);
    expect(loadProfile(kv)).toBeNull();
  });
});
