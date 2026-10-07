import { afterEach, expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { foeTurn } from '../../src/sim/party/partyFoeAi';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { damage, entOf, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { action, emit, type TriggerDef } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { card, inBranch } from '../../src/sim/party/traitTypes';
import { rollOffer } from '../../src/sim/party/traitPool';
import { implant } from '../../src/sim/roam/roam';
import { buildsNow } from '../../src/view/grid/gridActors';
import type { GEvent } from '../../src/sim/grid/types';

const added: string[] = [];
afterEach(() => { for (const id of added.splice(0)) delete TRAITS[id]; });

const scene = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!;
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = true; f.asleep = false; f.nextAt = 999; }
  return { p, u, foes };
};

it('a shocked unit (a state with no end) does not blind the change check', () => {
  const { p, u, foes } = scene();
  applyStatus(p, u, foes[foes.length - 1]!, 'shock', 0, []);
  u.triggers = [{ id: 'mark-it', when: 'hit', cd: 5, run: (pp, c) => applyStatus(pp, c.src, foes[0]!, 'mark', c.t, c.ev) }];
  const ev: GEvent[] = [];
  action(p, () => emit(p, 'hit', { t: 0, src: u, ev }));
  expect(ev.some((e) => e.text === 'mark-it')).toBe(true);
  expect(u.trig['mark-it']).toBe(5);
});

it('an on-damage effect hitting the foe that is dying does not kill it twice', () => {
  const { p, u, foes } = scene(), foe = foes[0]!;
  entOf(p, foe.id)!.hp = 5;
  u.triggers = [{ id: 'more', when: 'damage', run: (pp, c) => { if (c.target) damage(pp, c.t, u.id, c.target, 3, c.ev, true, false, 'fire'); } }];
  const ev: GEvent[] = [];
  action(p, () => damage(p, 0, u.id, foe, 10, ev, true, false, 'fire'));
  expect(ev.filter((e) => e.type === 'die' && e.dst === foe.id)).toHaveLength(1);
});

it("the warlord's slam is being hit", () => {
  const p = newDelve(2, 5), w = p.units.find((x) => x.foe === 'warlord')!, we = entOf(p, w.id)!, hero = entOf(p, 'hero')!;
  for (const x of p.units) { x.nextAt = 1000; if (x !== w && x.side === 'foe') { entOf(p, x.id)!.alive = false; x.reaped = true; } }
  w.asleep = false; w.nextAt = 0; hero.pos = { x: we.pos.x + 1, y: we.pos.y }; hero.hp = hero.maxHp = 10000;
  const u = unitOf(p, 'hero')! as Unit; u.level = 15; u.gear!.armor = null;
  let struck = 0;
  u.triggers = [{ id: 'spy', when: 'struck', repeat: true, run: () => { struck++; } } satisfies TriggerDef];
  // the slam lands this turn (no ordinary blow in the way)
  w.slamPending = true;
  foeTurn(p, w, p.time, []);
  expect(struck).toBeGreaterThan(0);
});

it('a figure is built only on a seen cell or near the camera (clones always)', () => {
  const seen = new Uint8Array(64 * 64); seen[10 * 64 + 10] = 1;
  const focus = { x: 5, y: 5 };
  expect(buildsNow({ id: 'f1', kind: 'minion', pos: { x: 10, y: 10 } }, seen, 64, focus)).toBe(true);
  expect(buildsNow({ id: 'f2', kind: 'minion', pos: { x: 50, y: 50 } }, seen, 64, focus)).toBe(false);
  expect(buildsNow({ id: 'f3', kind: 'minion', pos: { x: 12, y: 12 } }, seen, 64, focus)).toBe(true);
  expect(buildsNow({ id: 'hero', kind: 'hero', pos: { x: 60, y: 60 } }, seen, 64, focus)).toBe(true);
  expect(buildsNow({ id: 'f4', kind: 'minion', pos: { x: 50, y: 50 } }, seen, 64, null)).toBe(false);
});

it('the branch guarantee never pushes the other line out of the offer', () => {
  const p = newSurface(3), u = unitOf(p, 'hero')!;
  implant(p, u, 'warrior', []); implant(p, u, 'cleric', []);
  for (const id of ['zzw1', 'zzw2']) { TRAITS[id] = inBranch(card(id, id, 'law', ['근접'], 'warrior', '', {}, '+'), 'warrior:test'); added.push(id); }
  u.traits = { zzw1: 1 }; u.level = 5;
  for (let i = 0; i < 60; i++) {
    const pools = rollOffer(p, u).map((id) => TRAITS[id]!.pool);
    expect(pools).toContain('cleric');
  }
});
