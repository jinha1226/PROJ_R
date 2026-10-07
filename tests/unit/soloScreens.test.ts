import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant } from '../../src/sim/roam/roam';
import { unitOf } from '../../src/sim/party/partyCore';
import { aimNeeded } from '../../src/ui/delve/aim';
import { skillTiles, ULT_KEYS } from '../../src/ui/overworld/partyFrames';

it('a hybrid shows one ultimate tile per soul with its own key', () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'warrior', []); implant(p, u, 'archer', []);
  const html = skillTiles(u, p.time, true, true);
  expect(html.match(/data-skill="/g)).toHaveLength(2);
  expect(html).toContain(`<kbd>${ULT_KEYS[1]!.toUpperCase()}</kbd>`);
});

it('only aimed ultimates ask for a cell', () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'warrior', []); implant(p, u, 'archer', []);
  expect(aimNeeded(u, 0)).toBe(false);
  expect(aimNeeded(u, 1)).toBe(true);
});
