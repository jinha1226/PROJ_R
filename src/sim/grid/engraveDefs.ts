import { adjacentSlashes, barrageShots, pierceShot } from './engraveTargets';
import type { EngraveId } from './engraveCore';
import type { Trigger, TriggerCtx } from './kataBus';
import type { EffectId } from './kataEffects';
import { dist, type GridState } from './types';

export type Family = 'melee' | 'ranged' | 'fusion' | 'element';
export interface EngraveDef { on: Trigger; when?: (s: GridState, c: TriggerCtx) => boolean; effect: EffectId; p?: number; afterBlow?: boolean; afterTrigger?: boolean; targets?: (s: GridState, c: TriggerCtx) => TriggerCtx[] }

const ownKill = (_: GridState, c: TriggerCtx) => !c.inheritedKill;

/** Hand-written engravings are deliberately absent. */
export const DEFS: Partial<Record<EngraveId, EngraveDef>> = {
  gunRelay: { on: 'meleeKill', effect: 'shootNearest' },
  bladeRelay: { on: 'gunKill', effect: 'dashSlash' },
  spinShot: { on: 'surrounded', effect: 'spinShot', afterBlow: true },
  counterShot: { on: 'dodge', effect: 'shootFoe' },
  execute: { on: 'stunned', effect: 'execute' },
  flow: { on: 'chain', effect: 'freeNext' },
  bloodlust: { on: 'meleeKill', when: ownKill, effect: 'heal', p: 2 },
  fury: { on: 'meleeKill', when: ownKill, effect: 'nextMult', p: 1.5 },
  shoulder: { on: 'meleeHit', when: s => s.hero.fx.lastAction === 'move', effect: 'push' },
  ironwall: { on: 'parry', effect: 'shield', p: 3 },
  cull: { on: 'meleeHit', when: (_, c) => !!c.foe && c.foe.kind !== 'champion' && c.foe.hp <= c.foe.maxHp * 0.3,
    targets: (_, c) => [{ ...c, meleeExecute: true }], effect: 'execute' },
  tempest: { on: 'surrounded', targets: adjacentSlashes, effect: 'slashFoe', afterBlow: true },
  gale: { on: 'meleeKill', when: (s, c) => ownKill(s, c) && (c.count ?? 0) >= 2, effect: 'freeNext' },
  rebound: { on: 'stunned', when: (_, c) => c.src === 'slam', effect: 'charge', p: 2 },
  quickdraw: { on: 'gunKill', when: ownKill, effect: 'charge', p: 1 },
  pierce: { on: 'gunHit', targets: pierceShot, effect: 'shootFoe' },
  sniper: { on: 'preShot', when: (s, c) => !!c.foe && dist(s.hero.pos, c.foe.pos) >= 4, effect: 'nextMult', p: 1.5 },
  headshot: { on: 'preShot', when: (_, c) => !!c.foe && c.foe.hp === c.foe.maxHp, effect: 'nextMult', p: 2 },
  covering: { on: 'dodge', targets: (_, c) => [{ ...c, shotOnly: true }], effect: 'freeNext' },
  suppress: { on: 'gunHit', effect: 'delay', p: 0.5 },
  barrage: { on: 'chain', targets: barrageShots, effect: 'shootFoe' },
  thrift: { on: 'gunKill', when: ownKill, effect: 'refund' },
  steady: { on: 'preShot', when: s => s.hero.fx.lastAction === 'wait', effect: 'nextMult', p: 2 },
  bayonet: { on: 'meleeHit', when: (_, c) => c.src !== 'bash', targets: (_, c) => [{ ...c, chargeCost: 1 }], effect: 'shootFoe' },
  reverseCut: { on: 'gunHit', when: (s, c) => !!c.foe && dist(s.hero.pos, c.foe.pos) === 1, effect: 'slashFoe' },
  reclaim: { on: 'meleeKill', when: ownKill, effect: 'charge', p: 1 },
  muzzleShove: { on: 'meleeHit', when: (_, c) => c.src === 'bash', effect: 'push' },
  executionRush: { on: 'stunned', when: s => s.fired.has('execute'), effect: 'charge', p: 2, afterTrigger: true },
  trance: { on: 'chain', when: s => !!s.hero.fx.kills?.melee.length && !!s.hero.fx.kills.gun.length, effect: 'heal', p: 3 },
};
