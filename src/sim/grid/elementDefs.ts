import type { EngraveId } from './engraveCore';
import type { EngraveDef } from './engraveDefs';
import { losClear } from './fov';
import type { Element } from './items';
import type { TriggerCtx } from './kataBus';
import { dist, type GridState } from './types';

const burning = (_: GridState, c: TriggerCtx) => (c.foe?.status?.burn ?? 0) > 0;
const frozen = (_: GridState, c: TriggerCtx) => (c.foe?.status?.freeze ?? 0) > 0;
const poisoned = (_: GridState, c: TriggerCtx) => (c.foe?.status?.poison ?? 0) > 0;
const killed = (test: typeof burning) => (s: GridState, c: TriggerCtx) => !c.inheritedKill && test(s, c);
const element = (el: Element) => (_: GridState, c: TriggerCtx) => [{ ...c, element: el }];
const aroundHero = (el: Element) => (s: GridState, c: TriggerCtx) => [{ ...c, at: s.hero.pos, element: el }];

/** Passives live in status.ts. Burst damage and reactions use the existing element rules. */
export const ELEMENT_DEFS: Partial<Record<EngraveId, EngraveDef>> = {
  fireSpread: { on: 'meleeKill', also: ['gunKill'], when: killed(burning), targets: element('fire'), effect: 'elementBurst', p: 1 },
  fireBlade: { on: 'preMelee', when: burning, effect: 'nextMult', p: 1.5 },
  fireEmber: { on: 'gunKill', when: killed(burning), effect: 'charge', p: 1 },
  frostShatter: { on: 'preMelee', when: frozen, targets: (_, c) => [{ ...c, thaw: true }], effect: 'nextMult', p: 2 },
  frostVeil: { on: 'elementApplied', when: (_, c) => c.element === 'frost', effect: 'shield', p: 2 },
  frostBite: { on: 'preShot', when: frozen, effect: 'nextMult', p: 1.3 },
  frostSnap: { on: 'chain', targets: aroundHero('frost'), effect: 'elementBurst', p: 1 },
  shockArc: { on: 'elementApplied', when: (_, c) => c.element === 'shock', effect: 'elementBurst', p: 0,
    targets: (s, c) => {
      const foe = c.foe && s.foes.find(f => f.alive && f !== c.foe && dist(f.pos, c.foe!.pos) === 1 && losClear(s.map, c.foe!.pos, f.pos));
      return foe ? [{ ...c, foe, element: 'shock' }] : [];
    } },
  shockCharge: { on: 'elementApplied', when: (_, c) => c.element === 'shock', effect: 'charge', p: 1 },
  shockCut: { on: 'meleeHit', when: s => s.hero.rounds.includes('shock'), targets: element('shock'), effect: 'elementBurst', p: 0 },
  shockDischarge: { on: 'dodge', targets: aroundHero('shock'), effect: 'elementBurst', p: 1 },
  poisonBurst: { on: 'meleeKill', also: ['gunKill'], when: killed(poisoned), targets: element('poison'), effect: 'elementBurst', p: 1 },
  poisonVenom: { on: 'meleeHit', when: (_, c) => c.src === 'blade', effect: 'doublePoison' },
  poisonParalyze: { on: 'stunned', when: poisoned, effect: 'stun', p: 1 },
};
