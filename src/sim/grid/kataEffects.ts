import { tapCost } from './perks';
import { slashFoe, meleeExecute } from './meleeEffects';
import { emitKills } from './attackTriggers';
import { takeRound, roundMult, roundHit } from './rounds';
import { strike } from './combat';
import { canSwingAt, stepTo } from './combos';
import { activeWeapon } from './gear';
import { isGun, WEAPONS } from './items';
import { otherHand, REFLEX_HOOKS, withOtherHand } from './kata';
import { emit, type TriggerCtx } from './kataBus';
import { dashTarget, gunCost, gunInHand, inShot, nearest, shotTarget, spinTargets } from './kataTargets';
import { applyElement, areaCells } from './status';
import { dist, same, type GridState } from './types';
import { heroDmg, meleeAttack, pushFoe, rangedAttack } from './weapons';

export type EffectId = 'shootNearest' | 'shootFoe' | 'dashSlash' | 'spinShot' | 'slashFoe' | 'execute'
  | 'charge' | 'heal' | 'shield' | 'nextMult' | 'freeNext' | 'push' | 'stun' | 'elementBurst' | 'refund' | 'delay' | 'doublePoison';

/** Read-only eligibility: failed effects neither fire nor consume RNG or resources. */
export function canRun(s: GridState, id: EffectId, c: TriggerCtx, p = 1): boolean {
  const h = s.hero;
  if (!h.alive) return false;
  const gun = gunInHand(s), blade = otherHand(s), f = shotTarget(s, c);
  switch (id) {
    case 'shootNearest': return !!c.hooks && !!blade && isGun(blade.group) && h.charge >= gunCost(s, blade) && !!nearest(s);
    case 'shootFoe': return !!gun && h.charge >= tapCost(h, c.chargeCost ?? gunCost(s, gun)) && inShot(s, gun, c);
    case 'dashSlash': return !!c.hooks && !!blade && WEAPONS[blade.group].melee && blade.group !== 'spear' && !!dashTarget(s);
    case 'spinShot': return !!gun && h.charge >= tapCost(h, 1) && (c.neighbours?.length ?? spinTargets(s, c).length + Number(!!c.foe)) >= 2 && spinTargets(s, c).length > 0;
    case 'slashFoe': {
      const w = c.activeBlade ? activeWeapon(h.gear) : blade;
      return !!w && WEAPONS[w.group].melee && !!f?.alive && canSwingAt(s, h.pos, f.pos);
    }
    case 'execute': return !!f?.alive && (c.meleeExecute
      ? f !== h && f.kind !== 'champion'
      : !!gun && h.charge >= tapCost(h, 1) && dist(h.pos, f.pos) === 1);
    case 'charge': case 'refund': return h.charge < h.maxCharge && (id === 'refund' ? c.shotCost ?? p : p) > 0;
    case 'heal': return h.hp < h.maxHp && p > 0;
    case 'shield': return p > 0;
    case 'nextMult': return p > h.fx.nextMult || !!c.thaw;
    case 'freeNext': return c.shotOnly ? !h.fx.freeShot : !h.fx.free;
    case 'delay': return !!f?.alive && f !== h && p > 0;
    case 'push': case 'stun': return !!f?.alive && f !== h && (id === 'push' ? dist(h.pos, f.pos) > 0 : p > 0);
    case 'doublePoison': return !!f?.alive && (f.status?.poison ?? 0) > 0;
    case 'elementBurst': {
      const at = c.at ?? f?.pos;
      if (!c.element || !at || p < 0) return false;
      const cells = areaCells(s, at, p);
      if (p > 0 && (c.element === 'fire' || c.element === 'poison')) return cells.length > 0;
      return cells.some(cell => s.foes.some(e => e.alive && same(e.pos, cell)));
    }
  }
}

/** The bus marks fire() before entering here; direct callers get the same no-op contract. */
export function runEffect(s: GridState, id: EffectId, c: TriggerCtx, p = 1): boolean {
  if (!canRun(s, id, c, p)) return false;
  const h = s.hero, f = shotTarget(s, c), t = c.t;
  switch (id) {
    case 'shootNearest': {
      const target = nearest(s)!;
      withOtherHand(s, () => rangedAttack(s, t, target, c.hooks!)); break;
    }
    case 'shootFoe': {
      const shot = () => rangedAttack(s, t, f!, c.hooks ?? REFLEX_HOOKS, c);
      if (activeWeapon(h.gear) === gunInHand(s)) shot(); else withOtherHand(s, shot);
      break;
    }
    case 'dashSlash': {
      const target = dashTarget(s)!;
      c.timeCost = (c.timeCost ?? 0) + 0.3;
      withOtherHand(s, () => {
        stepTo(s, t, target.mid, 'dash');
        if (h.alive && same(h.pos, target.mid)) meleeAttack(s, t, target.d, target.f, c.hooks);
      });
      break;
    }
    case 'spinShot': {
      const gun = gunInHand(s)!;
      for (const target of spinTargets(s, c)) {
        const cost = tapCost(h, 1);
        if (!h.alive || h.charge < cost) break;
        if (!target.alive) continue;
        h.charge -= cost; h.fx.taps = (h.fx.taps ?? 0) + 1;
        const round = takeRound(s);
        s.events.push({ t, type: 'shoot', src: h.id, dst: target.id, from: { ...h.pos }, to: { ...target.pos }, text: 'spin', group: gun.group });
        const start = s.events.length;
        target.awake = true;
        const hit = strike(s, t, h, target, 1, heroDmg(s, gun), roundMult(s, t, round));
        if (hit) roundHit(s, t, target, round, true);
        if (hit) emit(s, 'gunHit', { ...c, foe: target, hooks: c.hooks ?? REFLEX_HOOKS, shotCost: cost });
        emitKills(s, t, start, 'gunKill', c.hooks ?? REFLEX_HOOKS, cost);
      }
      break;
    }
    case 'slashFoe':
      if (c.activeBlade) slashFoe(s, { ...c, foe: f }); else withOtherHand(s, () => slashFoe(s, { ...c, foe: f }));
      break;
    case 'execute': {
      if (c.meleeExecute) { meleeExecute(s, { ...c, foe: f }); break; }
      const start = s.events.length;
      const cost = tapCost(h, 1);
      h.charge -= cost; h.fx.taps = (h.fx.taps ?? 0) + 1;
      const round = takeRound(s);
      s.events.push({ t, type: 'shoot', src: h.id, dst: f!.id, from: { ...h.pos }, to: { ...f!.pos }, text: 'execute', group: gunInHand(s)!.group });
      const base = f!.kind === 'champion' ? Math.ceil(f!.maxHp * 0.25) : f!.hp;
      const amount = Math.round(base * roundMult(s, t, round));
      f!.hp = Math.max(0, f!.hp - amount); f!.awake = true;
      s.events.push({ t, type: 'hit', src: h.id, dst: f!.id, to: { ...f!.pos }, amount, crit: true });
      if (f!.hp === 0) {
        f!.alive = false;
        s.events.push({ t, type: 'die', src: h.id, dst: f!.id, to: { ...f!.pos } });
      }
      roundHit(s, t, f!, round, true);
      const shot = { ...c, foe: f, hooks: c.hooks ?? REFLEX_HOOKS, shotCost: cost };
      emit(s, 'gunHit', shot);
      emitKills(s, t, start, 'gunKill', shot.hooks, cost);
      break;
    }
    case 'charge': case 'refund': h.charge = Math.min(h.maxCharge, h.charge + (id === 'refund' ? c.shotCost ?? p : p)); break;
    case 'heal': h.hp = Math.min(h.maxHp, h.hp + p); break;
    case 'shield': h.shield = (h.shield ?? 0) + p; break;
    case 'nextMult':
      h.fx.nextMult = Math.max(h.fx.nextMult, p);
      if (c.thaw) c.afterHit?.push(() => { if (f?.status) f.status.freeze = 0; });
      break;
    case 'freeNext':
      if (c.shotOnly) h.fx.freeShot = true; else h.fx.free = true;
      break;
    case 'delay': f!.nextAt += p; break;
    case 'push': pushFoe(s, t, f!, { x: Math.sign(f!.pos.x - h.pos.x), y: Math.sign(f!.pos.y - h.pos.y) }); break;
    case 'stun':
      f!.stun = Math.min(f!.kind === 'champion' ? 1 : Infinity, (f!.stun ?? 0) + p);
      s.events.push({ t, type: 'stun', src: h.id, dst: f!.id, to: { ...f!.pos } });
      emit(s, 'stunned', { ...c, foe: f, src: 'engraving' }); break;
    case 'doublePoison':
      f!.status!.poison *= 2;
      s.events.push({ t, type: 'status', src: h.id, dst: f!.id, text: 'poison', to: { ...f!.pos } });
      emit(s, 'elementApplied', { t, foe: f, src: h.id, element: 'poison' }); break;
    case 'elementBurst': {
      const at = c.at ?? f!.pos;
      // Existing shock resolves one cell plus its normal splash; an area needs explicit centres.
      const cells = c.element === 'shock' && p > 0
        ? areaCells(s, at, p).filter(cell => s.foes.some(e => e.alive && same(e.pos, cell))) : [at];
      for (const cell of cells) applyElement(s, t, c.element!, cell, c.element === 'shock' ? 0 : p, null, h.id, undefined, h.id, true);
      break;
    }
  }
  return true;
}
