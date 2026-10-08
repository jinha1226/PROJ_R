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

it('a chain shows one effect after another, but one clone\'s chain stays well under a second', () => {
  const pb = new Playback(true);
  const names = ['원소 순환', '증기', '연소 폭발', '연쇄 반응', '과부하', '번개 사슬', '연소 폭발 ', '증기 ', '과부하 ', '독연 폭발', '원소 순환 ', '연쇄 반응 ', '증기  ', '과부하  '];
  pb.push(names.map((text): GEvent => ({ t: 2, type: 'buff', src: 'c1', text })), 2);
  const seen = drain(pb);
  expect(seen[1]!.at - seen[0]!.at).toBeGreaterThanOrEqual(0.02);
  expect(seen[seen.length - 1]!.at - seen[0]!.at).toBeLessThanOrEqual(0.7);
});

it('the grid game keeps its quick overlapping show', () => {
  const pb = new Playback();
  pb.push([{ t: 1, type: 'bump', src: 'hero', dst: 'f1' }, { t: 1, type: 'hit', src: 'hero', dst: 'f1', amount: 9 }], 1);
  const seen = drain(pb);
  expect(seen[1]!.at - seen[0]!.at).toBeLessThan(0.05);
});

it('the log tells a chain as it runs, in sentences: each effect and what it did, with no count to close it', () => {
  const { p, u, foes } = scene('mage'); const log = new WorldLog(), f = foes[0]!;
  log.read(p, [
    { t: 3, type: 'shoot', src: u.id, dst: f.id }, { t: 3, type: 'hit', src: u.id, dst: f.id, amount: 7 },
    { t: 3, type: 'buff', src: u.id, dst: f.id, text: 'burn' },
    { t: 3, type: 'buff', src: u.id, text: '운석' }, { t: 3, type: 'buff', src: u.id, dst: f.id, text: '운석 낙하' },
    { t: 3, type: 'hit', src: u.id, dst: f.id, amount: 12 }, { t: 3, type: 'die', src: u.id, dst: f.id },
    { t: 3, type: 'buff', src: u.id, dst: f.id, text: '화염 전이' }, { t: 3, type: 'react', src: u.id, dst: 'x', text: '증기' },
    { t: 3, type: 'buff', src: u.id, text: 'chain', amount: 3 },
  ]);
  const told = log.lines.map((l) => l.text);
  expect(told[0]).toBe('마법사가 고블린을 공격해 7 피해를 입혔다.');
  expect(told[1]).toBe('고블린이 불타기 시작했다.');
  expect(told[2]).toMatch(/^마법사의 운석이 발동했다\./);
  expect(told.slice(3, 6)).toEqual(['운석이 고블린 위로 떨어졌다.', '고블린이 12 피해를 입었다.', '고블린이 쓰러졌다.']);
  expect(told[6]).toMatch(/^마법사의 화염 전이가 발동했다\./);
  expect(told.slice(7)).toEqual(['증기 반응이 일어났다.']);
});

it('the log explains an effect the first time a clone sets it off, and only names it after', () => {
  const { p, u } = scene('mage'); const log = new WorldLog();
  log.read(p, [{ t: 1, type: 'buff', src: u.id, text: '화염 전이' }, { t: 2, type: 'buff', src: u.id, text: '화염 전이' }]);
  expect(log.lines[0]!.text).toContain('('); expect(log.lines[1]!.text).toBe('마법사의 화염 전이가 발동했다.');
});

it('the log is coloured: names by side, numbers by what they are, effects and states by their own colours; the full log keeps every line', () => {
  const { p, u, foes } = scene('mage'); const log = new WorldLog(), f = foes[0]!;
  log.read(p, [
    { t: 1, type: 'shoot', src: u.id, dst: f.id }, { t: 1, type: 'hit', src: u.id, dst: f.id, amount: 7, crit: true },
    { t: 1, type: 'buff', src: u.id, dst: f.id, text: 'burn' }, { t: 1, type: 'buff', src: u.id, dst: f.id, text: '화염 전이' },
    { t: 2, type: 'bump', src: f.id, dst: u.id }, { t: 2, type: 'hit', src: f.id, dst: u.id, amount: 4 },
  ]);
  const [blow, burn, fx, hurt] = log.lines.map((l) => l.html);
  expect(blow).toContain('<i class="l-crit">치명타!</i>'); expect(blow).toContain('<i class="l-ally">마법사</i>가');
  expect(blow).toContain('<i class="l-foe">고블린</i>을'); expect(blow).toContain('<i class="l-dmg">7</i>');
  expect(burn).toContain('<i class="l-st-burn">불타기 시작했다</i>'); expect(fx).toContain('<i class="l-fx">화염 전이</i>가');
  expect(hurt).toContain('<i class="l-hurt">4</i>');
  // the plain text carries no marks
  expect(log.lines[0]!.text).toBe('치명타! 마법사가 고블린을 공격해 7 피해를 입혔다.');
  for (let k = 0; k < 40; k++) log.add(k, `줄 ${k}`);
  expect(log.html().match(/wl-line/g)).toHaveLength(12); expect(log.fullHtml().match(/wl-line/g)).toHaveLength(44);
  // a line added from outside is escaped
  log.add(99, 'a <b> c'); expect(log.lines[log.lines.length - 1]!.html).toBe('a &lt;b&gt; c');
});

it('Korean particles follow the last sound of the word', async () => {
  const { josa } = await import('../../src/ui/overworld/worldLog');
  expect([josa('해골', '이/가'), josa('마법사', '이/가'), josa('고블린', '을/를'), josa('전사', '을/를'), josa('뼈 창', '이/가'), josa('화염 전이', '이/가')])
    .toEqual(['해골이', '마법사가', '고블린을', '전사를', '뼈 창이', '화염 전이가']);
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
}, 30_000);

it('a clone\'s step is not kept waiting behind its chain', () => {
  const pb = new Playback(true);
  pb.push([...['원소 순환', '증기', '연소 폭발', '연쇄 반응'].map((text): GEvent => ({ t: 2, type: 'buff', src: 'c1', text })), { t: 2, type: 'move', src: 'c1', to: { x: 1, y: 1 } }], 2);
  const seen = drain(pb), step = seen.find((s) => s.ev.type === 'move')!, last = seen.filter((s) => s.ev.type === 'buff').pop()!;
  expect(step.at).toBeLessThan(last.at);
});

it('a clone that steps and then shoots finishes the step before the shot (no sliding while attacking)', () => {
  const pb = new Playback(true);
  pb.push([{ t: 1, type: 'move', src: 'c2', to: { x: 2, y: 2 } }, { t: 1.1, type: 'shoot', src: 'c2', dst: 'f1' }], 1);
  const seen = drain(pb), step = seen.find((s) => s.ev.type === 'move')!, shot = seen.find((s) => s.ev.type === 'shoot')!;
  expect(shot.at - step.at).toBeGreaterThanOrEqual(0.2);
});

it('one clone alone gets a single status bar: name, level, health with its shield, experience and its ultimates, no portrait', async () => {
  const { soloBarHtml } = await import('../../src/ui/overworld/partyFrames');
  const { entOf } = await import('../../src/sim/party/partyCore');
  const { p, u } = scene('mage'); const e = entOf(p, u.id)!;
  e.hp = 30; e.maxHp = 60; u.shield = 6; u.level = 3;
  const html = soloBarHtml(p, u.id);
  expect(html).toContain('마법사'); expect(html).toContain('Lv 3'); expect(html).toContain('30<small>/60</small>'); expect(html).toContain('<em>+6</em>');
  expect(html).toContain('width:50%'); expect(html).toContain('left:50%;width:10%');
  expect(html).toContain('data-skill='); expect(html).not.toContain('pf-face');
  // a level-up waiting for its card shows the button, a hurt clone is flagged
  u.picks = 1; e.hp = 10;
  const low = soloBarHtml(p, u.id);
  expect(low).toContain('data-traits'); expect(low).toContain('class="sb low"');
});
