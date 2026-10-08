import { expect, it } from 'vitest';
import { asBeat, nest, own } from '../../src/sim/party/beat';
import { Playback } from '../../src/view/grid/playback';
import { whirlwind } from '../../src/sim/party/cardsWarrior';
import { action } from '../../src/sim/party/triggers';
import { put, scene } from './support/cardScene';
import type { GEvent } from '../../src/sim/grid/types';

const hit = (dst: string, src = 'c1'): GEvent => ({ t: 1, type: 'hit', src, dst, amount: 5 });
const named = (text: string, src = 'c1'): GEvent => ({ t: 1, type: 'buff', src, text });
const drain = (pb: Playback, step = 0.01, limit = 600) => { const seen: { at: number; ev: GEvent }[] = []; let t = 0; for (let i = 0; i < limit && (pb.busy || i === 0); i++) { t += step; for (const ev of pb.update(step)) seen.push({ at: t, ev }); } return seen; };

it('an effect is told as one beat: its own blows together, then what each of them set off', () => {
  const ev: GEvent[] = [];
  asBeat(ev, () => {
    ev.push(hit('a'));
    // the first blow sets off a chain before the second is dealt (the sim runs depth first)
    asBeat(ev, () => { ev.push(hit('x')); });
    const name = named('연소 폭발'); ev.splice(1, 0, name); nest(name);
    ev.push(hit('b'), { t: 1, type: 'buff', src: 'c1', dst: 'b', text: 'bleed' });
    // a reaction left in passing is the effect's own: after its blows, before the chain
    ev.push(own({ t: 1, type: 'react', src: 'c1', dst: 'b', text: '혈전' }));
    ev.push(hit('c'));
  });
  expect(ev.map((e) => (e.type === 'hit' ? `hit:${e.dst}` : e.text))).toEqual(['hit:a', 'hit:b', 'bleed', 'hit:c', '혈전', '연소 폭발', 'hit:x']);
});

it('a line the effect itself speaks in passing (a second fireball) keeps its place: what follows it is not pulled ahead of it', () => {
  const ev: GEvent[] = [];
  asBeat(ev, () => {
    asBeat(ev, () => { ev.push(hit('a'), hit('b')); });
    asBeat(ev, () => { ev.push(hit('c')); }, named('화염구'));
  });
  expect(ev.map((e) => (e.type === 'hit' ? `hit:${e.dst}` : e.text))).toEqual(['hit:a', 'hit:b', '화염구', 'hit:c']);
});

it('a whirlwind tells every cut before anything a cut set off', () => {
  const { p, u, foes } = scene('warrior');
  // blood vortex: a bleeding foe that dies spins another whirlwind where it fell
  u.traits = { bloodVortex: 1 };
  put(p, foes[0]!, 5, 4, 1); put(p, foes[1]!, 3, 4); put(p, foes[2]!, 4, 5);
  foes[0]!.status.bleed = { until: 99, by: u.id, stacks: 1 };
  const ev: GEvent[] = [];
  action(p, () => whirlwind(p, u, 1, ev));
  const first = ev.findIndex((e) => e.type === 'buff' && /[가-힣]/.test(e.text ?? '')), cuts = ev.slice(0, first < 0 ? ev.length : first).filter((e) => e.type === 'hit');
  expect(first).toBeGreaterThan(0);
  expect(new Set(cuts.map((e) => e.dst))).toEqual(new Set(foes.slice(0, 3).map((f) => f.id)));
});

it('on screen an effect\'s harm shows with it, on every foe at once; the next effect waits its beat', () => {
  const pb = new Playback(true);
  pb.push([named('회오리 베기'), hit('a'), hit('b'), { t: 1, type: 'die', src: 'c1', dst: 'b' }, hit('c'), { t: 1, type: 'die', src: 'c1', dst: 'c' }, hit('d'), named('피의 소용돌이'), hit('e')], 1);
  const seen = drain(pb), at = (i: number) => seen[i]!.at;
  expect(seen.map((s) => s.ev.type === 'hit' ? s.ev.dst : s.ev.type === 'die' ? 'die' : s.ev.text)).toEqual(['회오리 베기', 'a', 'b', 'die', 'c', 'die', 'd', '피의 소용돌이', 'e']);
  // the blade and all four numbers in the same instant
  expect(at(6) - at(0)).toBeLessThan(0.011);
  // the next effect after the beat's gap and one fall's hold (however many fell), its harm with it
  expect(at(7) - at(0)).toBeGreaterThanOrEqual(0.08); expect(at(7) - at(0)).toBeLessThan(0.12);
  expect(at(8) - at(7)).toBeLessThan(0.011);
});

it('a meteor\'s harm waits for the rock to land, then shows all at once', () => {
  const pb = new Playback(true);
  pb.push([named('운석'), named('운석 낙하'), hit('a'), hit('b'), hit('c')], 1);
  const seen = drain(pb), at = (i: number) => seen[i]!.at;
  expect(at(2) - at(1)).toBeGreaterThanOrEqual(0.08);
  expect(at(4) - at(2)).toBeLessThan(0.011);
});

it('a meteor jolts the screen where it lands; a blizzard rains shards over the ground it covers; the frozen stand in ice', async () => {
  const { effectCue } = await import('../../src/view/grid/effectCues');
  const { IceBlocks } = await import('../../src/view/grid/iceBlock');
  const calls: string[] = [], drops: { x: number; z: number; done: () => void }[] = [];
  const k = { at: () => undefined, particles: { vfx: { fire: () => calls.push('vfx') } },
    fx: { drop: (at: { x: number; z: number }, done: () => void) => drops.push({ x: at.x, z: at.z, done }), flash: () => calls.push('flash'), shake: (sec: number, amp: number) => calls.push(`shake:${sec}:${amp}`), transient: { burst: () => calls.push('burst') } } } as never;
  expect(effectCue(k, { t: 0, type: 'buff', src: 'm', to: { x: 6, y: 6 }, text: '운석 낙하' })).toBe(true);
  expect(calls).toEqual([]); drops[0]!.done();
  const jolt = calls.find((c) => c.startsWith('shake'))!.split(':').map(Number);
  expect(jolt[1]).toBeGreaterThanOrEqual(0.3); expect(jolt[2]).toBeGreaterThanOrEqual(0.4);
  drops.length = 0; calls.length = 0;
  expect(effectCue(k, { t: 0, type: 'buff', src: 'm', to: { x: 6, y: 6 }, amount: 2, text: 'blizzard' })).toBe(true);
  expect(drops.length).toBeGreaterThanOrEqual(10);
  // every shard inside the two cells the blizzard covers, and not all on one spot
  expect(drops.every((d) => Math.hypot(d.x - 6, d.z - 6) <= 2.01)).toBe(true);
  expect(new Set(drops.map((d) => `${d.x.toFixed(1)},${d.z.toFixed(1)}`)).size).toBe(drops.length);

  const ice = new IceBlocks();
  ice.set('f1', true); ice.set('f1', true); ice.set('f2', true);
  expect(ice.root.children).toHaveLength(2);
  ice.place((id) => (id === 'f1' ? { x: 3, z: 4 } : null));
  // f1 stands in its block; f2 fell, and its ice went with it
  expect(ice.root.children).toHaveLength(1); expect(ice.root.children[0]!.position.x).toBe(3);
  ice.set('f1', false); expect(ice.root.children).toHaveLength(0);
}, 30_000);
