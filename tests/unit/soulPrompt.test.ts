import { expect, it } from 'vitest';
import { newWorld } from '../../src/sim/overworld/worldSim';
import { soulPrompt } from '../../src/ui/overworld/placePrompt';

it('an empty body with souls carried gets a 영혼 주입 prompt: one soul goes straight in, more open the bag', () => {
  const p = newWorld(3), got: string[] = [];
  expect(soulPrompt(p, () => {}, () => {})).toEqual([]);
  p.carried = ['archer'];
  const [one] = soulPrompt(p, (ev) => got.push(...ev.map((e) => e.text!)), () => got.push('bag'));
  expect(one!.label).toBe('영혼 주입'); one!.act();
  expect(got).toContain('soul'); expect(p.carried).toEqual([]);
  expect(soulPrompt(p, () => {}, () => {})).toEqual([]);
});

it('two souls carried: the prompt opens the bag on that body', () => {
  const p = newWorld(3), got: string[] = [];
  p.carried = ['archer', 'mage'];
  soulPrompt(p, () => got.push('live'), (id) => got.push(id))[0]!.act();
  expect(got).toEqual(['hero']); expect(p.carried).toHaveLength(2);
});
