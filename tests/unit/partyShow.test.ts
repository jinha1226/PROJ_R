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
  expect(hit.at - swing.at).toBeGreaterThanOrEqual(0.13);
});

it('a chain shows one effect after another, but one clone\'s chain stays under half a second', () => {
  const pb = new Playback(true);
  const names = ['원소 순환', '증기', '연소 폭발', '연쇄 반응', '과부하', '번개 사슬', '연소 폭발 ', '증기 ', '과부하 ', '독연 폭발', '원소 순환 ', '연쇄 반응 ', '증기  ', '과부하  '];
  pb.push(names.map((text): GEvent => ({ t: 2, type: 'buff', src: 'c1', text })), 2);
  const seen = drain(pb);
  expect(seen[1]!.at - seen[0]!.at).toBeGreaterThanOrEqual(0.035);
  expect(seen[seen.length - 1]!.at - seen[0]!.at).toBeLessThanOrEqual(0.55);
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

it('clones act at the same time: one clone\'s chain does not hold another clone\'s swing', () => {
  const pb = new Playback(true);
  pb.push([
    ...['원소 순환', '증기', '연소 폭발', '연쇄 반응', '과부하'].map((text): GEvent => ({ t: 2, type: 'buff', src: 'c1', text })),
    { t: 2, type: 'bump', src: 'c2', dst: 'f2' },
  ], 2);
  const seen = drain(pb), last = seen.filter((s) => s.ev.src === 'c1').pop()!, swing = seen.find((s) => s.ev.src === 'c2')!;
  expect(swing.at).toBeLessThan(last.at);
});

it('each effect has its own look: a reaction bursts on its foe, a status shows on whoever took it, a pierce draws a streak', async () => {
  const { effectCue } = await import('../../src/view/grid/effectCues');
  const THREE = await import('three');
  const calls: string[] = [];
  const at = (id?: string) => (id ? new THREE.Vector3(id === 'a' ? 0 : 3, 0, 0) : undefined);
  const k = { at, particles: { vfx: { fire: (kind: string) => calls.push(`vfx:${kind}`) } }, fx: { bolt: () => calls.push('bolt'), flash: () => calls.push('flash'), shake: () => calls.push('shake'), transient: { burst: () => calls.push('burst') } } } as never;
  expect(effectCue(k, { t: 0, type: 'react', src: 'a', dst: 'b', text: '과부하' })).toBe(true);
  expect(calls).toEqual(expect.arrayContaining(['vfx:blast', 'burst', 'shake']));
  calls.length = 0; effectCue(k, { t: 0, type: 'buff', src: 'a', dst: 'b', text: 'burn' }); expect(calls).toContain('vfx:blast');
  calls.length = 0; effectCue(k, { t: 0, type: 'buff', src: 'a', dst: 'b', text: '관통 화살' }); expect(calls).toEqual(['bolt']);
  calls.length = 0; effectCue(k, { t: 0, type: 'buff', src: 'a', text: '화염 공명' }); expect(calls).toContain('vfx:magic');
  expect(effectCue(k, { t: 0, type: 'buff', src: 'a', text: 'claim' })).toBe(false);
});
