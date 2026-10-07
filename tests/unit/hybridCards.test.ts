import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant } from '../../src/sim/roam/roam';
import { unitOf } from '../../src/sim/party/partyCore';
import { rollOffer } from '../../src/sim/party/traitPool';
import { gainXp, LEVEL_XP } from '../../src/sim/party/partyLevel';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { sourcesOf } from '../../src/sim/party/triggers';
import { duoTriggers } from '../../src/sim/party/cardsCombo';

const body = (...cls: ('warrior' | 'mage' | 'archer')[]) => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!;
  for (const c of cls) implant(p, u, c, []);
  u.level = 4;
  return { p, u };
};

it('a two-soul body is offered a card of each line every time', () => {
  const { p, u } = body('warrior', 'mage');
  for (let i = 0; i < 40; i++) {
    const pools = rollOffer(p, u).map((id) => TRAITS[id]!.pool);
    expect(pools).toContain('warrior');
    expect(pools).toContain('mage');
  }
});

it('a duo card is offered only to a body holding both its classes', () => {
  const both = body('warrior', 'archer'), one = body('warrior');
  const seen = (b: ReturnType<typeof body>) => Array.from({ length: 200 }, () => rollOffer(b.p, b.u)).flat();
  expect(seen(both)).toContain('bait');
  expect(seen(one)).not.toContain('bait');
});

it('a taken duo runs in the one body that holds both souls', () => {
  const { p, u } = body('warrior', 'archer');
  u.traits = { bait: 1 };
  expect(duoTriggers(p, u).map((d) => d.id)).toContain('미끼와 사냥꾼');
});

it('the innates of every soul in the body are live', () => {
  const { p, u } = body('warrior', 'mage');
  const ids = sourcesOf(p, u).map((d) => d.id);
  expect(ids).toContain('회오리 베기');
  expect(ids).toContain('원소 순환');
});

it('the empty body levels up and, like every class, first picks a branch: its three signatures', () => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!;
  gainXp(p, u, LEVEL_XP[1]!, []);
  expect(u.level).toBe(2);
  expect(u.offer).toHaveLength(3);
  expect(u.offer!.every((id) => TRAITS[id]!.pool === 'shell' && TRAITS[id]!.sig)).toBe(true);
});
