import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { benchModel } from '../../src/ui/overworld/workbench/benchModel';
import { benchHtml } from '../../src/ui/overworld/workbench/benchHtml';
import { craft, dismantle, fit } from '../../src/sim/base/workshop';

const base = () => { const p = newSurface(3); p.ore = 200; p.crystal = 40; p.pack.push({ id: 'fs', def: 'flameSword', power: 0 }, { id: 'ip', def: 'ironPlate', power: 0 }, { id: 'wr', def: 'windRing', power: 0 }); return p; };

it('the bench model: two gun slots and one suit slot, dismantle rows for matching pack items, modules once a blueprint is open', () => {
  const p = base(), m = benchModel(p);
  expect(m.slots.map((s) => s.slot)).toEqual(['gun0', 'gun1', 'suit0']);
  expect(m.dismantle('gun').map((r) => r.itemId)).toEqual(['fs']);
  expect(m.dismantle('suit').map((r) => r.itemId)).toEqual(['ip']);
  expect(m.dismantle('gun')[0]!.gives).toContain('소이탄');
  expect(m.modules('gun')).toEqual([]);
  dismantle(p, 'fs');
  const rows = benchModel(p).modules('gun');
  expect(rows.map((r) => r.name)).toEqual(['소이탄']); expect(rows[0]!.state).toBe('craftable');
  craft(p, rows[0]!.id); fit(p, 'gun', 0, rows[0]!.id);
  expect(benchModel(p).modules('gun')[0]!.state).toBe('fitted');
  expect(benchModel(p).slots[0]!.fitted?.name).toBe('소이탄');
  expect(benchModel(p).soul).toMatchObject({ slots: 2, cost: 10, can: true });
});

it('the screen markup: the selected part rows with their buttons, the materials and the soul-slot upgrade', () => {
  const p = base();
  const html = benchHtml(benchModel(p), { part: 'gun', slot: 'gun0' });
  expect(html).toContain('data-act="dismantle" data-id="fs"');
  expect(html).not.toContain('data-id="ip"');
  expect(html).toContain('영혼 칸 2 → 3'); expect(html).toContain('마정석 10');
  expect(html).toContain('광석'); expect(html).toContain('data-close');
  dismantle(p, 'fs');
  expect(benchHtml(benchModel(p), { part: 'gun', slot: 'gun0' })).toContain('data-act="craft" data-id="sf-flameSword"');
  const suit = benchHtml(benchModel(p), { part: 'suit', slot: 'suit0' });
  expect(suit).toContain('data-act="dismantle" data-id="ip"');
});
