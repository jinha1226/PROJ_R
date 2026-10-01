import { describe, it, expect } from 'vitest';
import {
  newCompany, canDeploy, setParty, hire, settleCompany, isGameOver, stashToMerc, mercToStash, stashToPack, MAX_MERCS,
  packToStash, stashToPouch, pouchToStash, moveInParty,
} from '../../src/sim/extract/company';
import { saveCompany, loadCompany } from '../../src/app/extractSave';
import type { KV } from '../../src/app/save';
import { WEAPON_TYPE_OF_CLASS } from '../../src/data/items';
import { xitem } from '../../src/data/extract';

const memKV = (): KV => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };
const home = (c: ReturnType<typeof newCompany>, id: string, state: 'home' | 'carried' | 'dead' = 'home', xp = 0) => ({ id, state, xp, gear: c.gear[id]! });

describe('extraction company', () => {
  it('starts with three equal mercenaries in the party, each in their class kit', () => {
    const c = newCompany(5);
    expect(c.version).toBe(2);
    expect(c.mercs.length).toBe(3);
    expect(c.party).toEqual(c.mercs.map((m) => m.id));
    for (const m of c.mercs) {
      expect(m.protagonist).toBeFalsy();
      expect(xitem(c.gear[m.id]!.equipped.weapon!).weaponType).toBe(WEAPON_TYPE_OF_CLASS[m.classId]);
    }
    expect(c.tavern.length).toBeGreaterThanOrEqual(2);
  });

  it('badly hurt mercenaries cannot deploy; the party holds at most five', () => {
    let c = newCompany(5);
    c = { ...c, mercs: c.mercs.map((m, i) => (i === 0 ? { ...m, injury: 2 } : m)) };
    expect(canDeploy(c.mercs[0]!)).toBe(false);
    expect(setParty(c, c.mercs.map((m) => m.id)).party).toEqual(c.mercs.slice(1).map((m) => m.id));
  });

  it('hires from the tavern for gold, up to the company limit', () => {
    let c = { ...newCompany(5), gold: 10_000 };
    const fee = c.tavern[0]!.fee;
    c = hire(c, 0);
    expect(c.mercs.length).toBe(4);
    expect(c.gold).toBe(10_000 - fee);
    expect(() => hire({ ...c, gold: 0 }, 0)).toThrow();
    const full = { ...c, mercs: Array.from({ length: MAX_MERCS }, (_, i) => ({ ...c.mercs[0]!, id: `x${i}` })) };
    expect(() => hire(full, 0)).toThrow();
  });

  it('settles a sortie: home gains xp, carried is badly hurt, dead is gone with their gear, loot banks only on extraction', () => {
    const c = newCompany(5);
    const [a, b, d] = c.mercs.map((m) => m.id) as [string, string, string];
    const r = settleCompany(c, { outcome: 'extracted', pack: [{ id: 'x_crown', n: 1 }], pouch: null, members: [home(c, a, 'home', 400), home(c, b, 'carried'), home(c, d, 'dead')] });
    const ids = r.company.mercs.map((m) => m.id);
    expect(ids).toEqual([a, b]);
    expect(r.company.mercs[0]!.level).toBeGreaterThan(1);
    expect(r.company.mercs[1]!.injury).toBe(2);
    expect(r.died).toEqual([d]);
    expect(r.company.fallen.map((f) => f.name)).toEqual([c.mercs[2]!.name]);
    expect(r.company.stash).toEqual([{ id: 'x_crown', n: 1 }]);
    expect(r.company.party).toEqual([a]);
    const failed = settleCompany(c, { outcome: 'failed', pack: [{ id: 'x_crown', n: 1 }], pouch: { id: 'x_idol', n: 1 }, members: [home(c, a, 'dead')] });
    expect(failed.company.stash).toEqual([]);
    expect(failed.company.pouch).toEqual({ id: 'x_idol', n: 1 });
  });

  it('those who stayed home recover a step', () => {
    let c = newCompany(5);
    c = { ...c, mercs: c.mercs.map((m, i) => (i === 2 ? { ...m, injury: 2 } : m)) };
    const [a] = c.mercs.map((m) => m.id) as [string];
    const r = settleCompany(c, { outcome: 'extracted', pack: [], pouch: null, members: [home(c, a)] });
    expect(r.company.mercs[2]!.injury).toBe(1);
  });

  it('the company is over when nobody is left alive', () => {
    const c = newCompany(5);
    const r = settleCompany(c, { outcome: 'failed', pack: [], pouch: null, members: c.mercs.map((m) => home(c, m.id, 'dead')) });
    expect(isGameOver(r.company)).toBe(true);
  });

  it('moves gear between the stash and a mercenary, and supplies into the sortie pack', () => {
    let c = { ...newCompany(5), stash: [{ id: 'x_head_1', n: 1 }, { id: 'x_potion_s', n: 3 }] };
    const id = c.mercs[0]!.id;
    c = stashToMerc(c, id, 0);
    expect(c.gear[id]!.equipped.head).toBe('x_head_1');
    c = stashToPack(c, 0);
    expect(c.pack).toEqual([{ id: 'x_potion_s', n: 3 }]);
    c = mercToStash(c, id, 'head');
    expect(c.stash).toEqual([{ id: 'x_head_1', n: 1 }]);
  });

  it('saves and loads; old v1 saves are ignored', () => {
    const kv = memKV();
    const c = newCompany(9);
    expect(saveCompany(c, kv)).toBe(true);
    expect(loadCompany(kv)).toEqual(c);
    kv.setItem('projr.extract.v2', '{"version":1}');
    expect(loadCompany(kv)).toBeNull();
  });
  it('moves supplies back, uses the safe pouch, and reorders the party', () => {
    let c = { ...newCompany(5), stash: [{ id: 'x_potion_s', n: 2 }, { id: 'x_idol', n: 1 }] };
    c = stashToPack(c, 0);
    c = packToStash(c, 0);
    expect(c.pack).toEqual([]);
    expect(c.stash).toEqual([{ id: 'x_idol', n: 1 }, { id: 'x_potion_s', n: 2 }]);
    c = stashToPouch(c, 0);
    expect(c.pouch).toEqual({ id: 'x_idol', n: 1 });
    c = pouchToStash(c);
    expect(c.pouch).toBeNull();
    const [a, b] = c.party;
    c = moveInParty(c, b!, -1);
    expect(c.party.slice(0, 2)).toEqual([b, a]);
  });
});
