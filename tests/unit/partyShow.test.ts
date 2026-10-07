import { expect, it } from 'vitest';
import { Playback } from '../../src/view/grid/playback';
import { WorldLog } from '../../src/ui/overworld/worldLog';
import { scene } from './support/cardScene';
import type { GEvent } from '../../src/sim/grid/types';

const drain = (pb: Playback, step = 0.02, limit = 400) => { const seen: { at: number; ev: GEvent }[] = []; let t = 0; for (let i = 0; i < limit && (pb.busy || i === 0); i++) { t += step; for (const ev of pb.update(step)) seen.push({ at: t, ev }); } return seen; };

it('in a party fight a swing plays out before the blow it caused shows', () => {
  const pb = new Playback(true);
  pb.push([{ t: 1, type: 'bump', src: 'hero', dst: 'f1' }, { t: 1, type: 'hit', src: 'hero', dst: 'f1', amount: 9 }], 1);
  const seen = drain(pb), swing = seen.find((s) => s.ev.type === 'bump')!, hit = seen.find((s) => s.ev.type === 'hit')!;
  expect(hit.at - swing.at).toBeGreaterThanOrEqual(0.22);
});

it('a chain shows one effect after another, but never holds the show more than a second', () => {
  const pb = new Playback(true);
  const names = ['원소 순환', '증기', '연소 폭발', '연쇄 반응', '과부하', '번개 사슬', '연소 폭발 ', '증기 ', '과부하 ', '독연 폭발', '원소 순환 ', '연쇄 반응 ', '증기  ', '과부하  '];
  pb.push(names.map((text): GEvent => ({ t: 2, type: 'buff', src: 'c1', text })), 2);
  const seen = drain(pb);
  expect(seen[1]!.at - seen[0]!.at).toBeGreaterThanOrEqual(0.08);
  expect(seen[seen.length - 1]!.at - seen[0]!.at).toBeLessThanOrEqual(1.1);
});

it('the grid game keeps its quick overlapping show', () => {
  const pb = new Playback();
  pb.push([{ t: 1, type: 'bump', src: 'hero', dst: 'f1' }, { t: 1, type: 'hit', src: 'hero', dst: 'f1', amount: 9 }], 1);
  const seen = drain(pb);
  expect(seen[1]!.at - seen[0]!.at).toBeLessThan(0.05);
});

it('the log tells a chain as one line: who, how many, what fired in order', () => {
  const { p, u } = scene('mage'); const log = new WorldLog();
  log.read(p, [
    { t: 3, type: 'buff', src: u.id, text: '원소 순환' }, { t: 3, type: 'react', src: u.id, dst: 'x', text: '증기' },
    { t: 3, type: 'buff', src: u.id, text: '연소 폭발' }, { t: 3, type: 'buff', src: u.id, text: 'chain', amount: 3 },
  ]);
  expect(log.html()).toContain('마법사 연쇄 ×3 · 원소 순환 → 증기 → 연소 폭발');
});
