import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { bagHtml } from '../../src/ui/overworld/pipBag';
import { pipTabs } from '../../src/ui/overworld/pipWindow';
import { clones } from '../../src/sim/roam/roam';

it('the bag is one grid of everything carried: what the base counts, soul stones, gear and consumables; no list under it', () => {
  const p = newSurface(2);
  p.bio = 12; p.ore = 0; p.crystal = 3;
  p.carried = [{ cls: 'mage', memory: 'burnt', unknown: true }];
  p.pack = [{ id: 'c1', consumable: 'potion' }, { id: 'c2', consumable: 'potion' }, { id: 'c3', consumable: 'fireBomb' }];
  const html = bagHtml(p, clones(p)[0], '', false);
  // the grid comes first; a count of nothing is not a thing in the bag
  expect(html).toMatch(/^<section class="pip-bag"><div class="pip-grid">/);
  expect(html).toContain('data-pick="bio"'); expect(html).toContain('<b>12</b>'); expect(html).toContain('data-pick="crystal"'); expect(html).not.toContain('data-pick="ore"');
  expect(html).toContain('data-pick="soul:0"');
  // two draughts stack in one slot with their count; another kind takes its own
  expect(html).toMatch(/data-pick="item:c1"><span>[^<]+<\/span><b>2<\/b>/); expect(html).not.toContain('data-pick="item:c2"'); expect(html).toContain('data-pick="item:c3"');
  expect(html.match(/class="pip-slot/g)).toHaveLength(16);
  expect(html).not.toContain('pg-pack'); expect(html).toContain('칸을 눌러 살펴보기');
});

it('a thing tapped in the grid tells what it is under it: a stone (unidentified below), a consumable to use, a resource and what it is for', () => {
  const p = newSurface(2);
  p.bio = 12; p.carried = [{ cls: 'mage', memory: 'burnt', unknown: true }]; p.pack = [{ id: 'c1', consumable: 'potion', charges: 2 }];
  const u = clones(p)[0];
  const stone = bagHtml(p, u, 'soul:0', false);
  expect(stone).toContain('data-pick="soul:0"'); expect(stone).toMatch(/class="pip-slot soul on"/); expect(stone).toContain('???'); expect(stone).not.toContain('data-soul=');
  expect(bagHtml(p, u, 'soul:0', true)).toContain('data-soul="0">주입');
  expect(bagHtml(p, u, 'item:c1', false)).toContain('data-item="c1" data-action="use"');
  expect(bagHtml(p, u, 'bio', false)).toContain('새 몸 하나에');
  // a thing used up since it was chosen leaves the hint
  expect(bagHtml(p, u, 'item:gone', false)).toContain('칸을 눌러 살펴보기');
});

it('down in the dungeon the window has no roster and no soul-stone tab', () => {
  expect(pipTabs(true)).toEqual(['stat', 'skill', 'gear', 'bag']);
  expect(pipTabs(false)).toEqual(['roster', 'stat', 'skill', 'gear', 'bag', 'soul']);
});
