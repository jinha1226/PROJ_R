import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { newDelve, delveTick } from '../../src/sim/delve/delveSim';
import { soulListHtml } from '../../src/ui/overworld/pipSouls';
import { MEMORIES } from '../../src/sim/party/memories';
import { HERO_SOULS } from '../../src/sim/delve/heroSouls';
import { rejoin, takeParty } from '../../src/sim/roam/carry';
import { entOf } from '../../src/sim/party/partyCore';

it('lists every stored stone with its class, its memory and, for a hero, name and level', () => {
  const p = newSurface(2);
  p.carried = [{ cls: 'mage', memory: 'burnt' }, { cls: 'mage', memory: 'scholar' }, { cls: 'warrior', hero: 'aren' }];
  const html = soulListHtml(p, false);
  expect(html.match(/data-stone=/g)).toHaveLength(3);
  expect(html).toContain(MEMORIES.burnt.name); expect(html).toContain(MEMORIES.scholar.text);
  expect(html).toContain(HERO_SOULS.aren.name); expect(html).toContain(`레벨 ${HERO_SOULS.aren.level}`);
  expect(soulListHtml(p, true)).toContain('미전송');
  p.carried = [];
  expect(soulListHtml(p, false)).toContain('없음');
});

it('a stone picked up below is unidentified until it reaches the base', () => {
  const p = newSurface(2);
  p.carried = [{ cls: 'mage', memory: 'burnt', unknown: true }, { cls: 'warrior', hero: 'aren', unknown: true }];
  const html = soulListHtml(p, true);
  expect(html).toContain('???'); expect(html).not.toContain(MEMORIES.burnt.name);
  expect(html).toContain('미감정 영웅 영혼석'); expect(html).not.toContain(HERO_SOULS.aren.name);
});

it('picking up below marks the stone unknown; riding up identifies it', () => {
  const d = newDelve(2, 1);
  for (const u of d.units) if (u.side === 'foe') { entOf(d, u.id)!.alive = false; u.reaped = true; }
  entOf(d, 'hero')!.pos = { ...d.souls[0]!.pos };
  delveTick(d, 0.1);
  const got = d.carried[0];
  expect(typeof got === 'object' && got.unknown).toBe(true);
  const s = newSurface(2);
  rejoin(s, takeParty(d), s.drill!);
  const home = s.carried[0];
  expect(typeof home === 'object' && home.unknown).toBeFalsy();
});
