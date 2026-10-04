import { emitKills } from './attackTriggers';
import { strike } from './combat';
import { blowMult } from './engraveCore';
import { activeWeapon } from './gear';
import { WEAPONS } from './items';
import { emit, type TriggerCtx } from './kataBus';
import { bladeRound } from './rounds';
import { refillMelee } from './suitCharge';
import type { GridState } from './types';
import { heroDmg } from './weapons';

/** One blade hit, without recursively invoking weapon sweeps or surrounded. */
export function slashFoe(s: GridState, c: TriggerCtx): void {
  const h = s.hero, foe = c.foe!, w = activeWeapon(h.gear)!;
  const start = s.events.length;
  s.events.push({ t: c.t, type: 'bump', src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...foe.pos }, group: w.group });
  foe.awake = true;
  const hit = strike(s, c.t, h, foe, WEAPONS[w.group].hit, heroDmg(s, w), blowMult(s, c.t, foe));
  h.fx.nextMult = 1;
  refillMelee(s, hit, start);
  if (hit) { bladeRound(s, c.t, foe); emit(s, 'meleeHit', { ...c, src: 'blade' }); }
  emitKills(s, c.t, start, 'meleeKill', c.hooks);
}

/** Cull is a melee finishing blow, not the charged gun execution. */
export function meleeExecute(s: GridState, c: TriggerCtx): void {
  const foe = c.foe!, amount = foe.hp, start = s.events.length;
  foe.hp = 0; foe.alive = false;
  s.events.push({ t: c.t, type: 'hit', src: s.hero.id, dst: foe.id, to: { ...foe.pos }, amount, crit: true },
    { t: c.t, type: 'die', src: s.hero.id, dst: foe.id, to: { ...foe.pos } });
  emitKills(s, c.t, start, 'meleeKill', c.hooks);
}
