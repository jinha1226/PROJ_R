import { strike } from './combat';
import { canSwingAt, stepTo } from './combos';
import { activeWeapon } from './gear';
import { isGun, WEAPONS } from './items';
import { otherHand, REFLEX_HOOKS, withOtherHand } from './kata';
import { emit, type TriggerCtx } from './kataBus';
import { dashTarget, gunCost, gunInHand, inShot, nearest, shotTarget, spinTargets } from './kataTargets';
import { applyElement } from './status';
import { dist, same, type GridState } from './types';
import { heroDmg, meleeAttack, pushFoe, rangedAttack } from './weapons';

export type EffectId = 'shootNearest' | 'shootFoe' | 'dashSlash' | 'spinShot' | 'slashFoe' | 'execute'
  | 'charge' | 'heal' | 'shield' | 'nextMult' | 'freeNext' | 'push' | 'stun' | 'elementBurst' | 'refund';

/** Read-only eligibility: failed effects neither fire nor consume RNG or resources. */
export function canRun(s: GridState, id: EffectId, c: TriggerCtx, p = 1): boolean {
  const h = s.hero;
  if (!h.alive) return false;
  const gun = gunInHand(s), blade = otherHand(s), f = shotTarget(s, c);
  switch (id) {
    case 'shootNearest': return !!c.hooks && !!blade && isGun(blade.group) && h.charge >= gunCost(s, blade) && !!nearest(s);
    case 'shootFoe': return !!gun && h.charge >= gunCost(s, gun) && inShot(s, gun, c);
    case 'dashSlash': return !!c.hooks && !!blade && WEAPONS[blade.group].melee && blade.group !== 'spear' && !!dashTarget(s);
    case 'spinShot': return !!gun && h.charge >= 1 && (c.neighbours?.length ?? spinTargets(s, c).length + Number(!!c.foe)) >= 2 && spinTargets(s, c).length > 0;
    case 'slashFoe': return !!blade && WEAPONS[blade.group].melee && !!f?.alive && canSwingAt(s, h.pos, f.pos);
    case 'execute': return !!gun && h.charge >= 1 && !!f?.alive && dist(h.pos, f.pos) === 1;
    case 'charge': case 'refund': return h.charge < h.maxCharge && (id === 'refund' ? c.shotCost ?? p : p) > 0;
    case 'heal': return h.hp < h.maxHp && p > 0;
    case 'shield': return p > 0;
    case 'nextMult': return p > h.fx.nextMult;
    case 'freeNext': return !h.fx.free;
    case 'push': case 'stun': return !!f?.alive && f !== h && (id === 'push' ? dist(h.pos, f.pos) > 0 : p > 0);
    case 'elementBurst': return !!c.element && !!f?.alive && p >= 0;
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
      const shot = () => rangedAttack(s, t, f!, c.hooks ?? REFLEX_HOOKS);
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
        if (!h.alive || h.charge < 1) break;
        h.charge--;
        s.events.push({ t, type: 'shoot', src: h.id, dst: target.id, from: { ...h.pos }, to: { ...target.pos }, text: 'spin', group: gun.group });
        target.awake = true;
        const hit = strike(s, t, h, target, 1, heroDmg(s, gun));
        if (hit) emit(s, 'gunHit', { ...c, foe: target, hooks: c.hooks ?? REFLEX_HOOKS, shotCost: 1 });
        if (!target.alive) emit(s, 'gunKill', { ...c, foe: target, hooks: c.hooks ?? REFLEX_HOOKS, count: 1, shotCost: 1 });
      }
      break;
    }
    case 'slashFoe': withOtherHand(s, () => meleeAttack(s, t, { x: f!.pos.x - h.pos.x, y: f!.pos.y - h.pos.y }, f!, c.hooks)); break;
    case 'execute': {
      h.charge--;
      s.events.push({ t, type: 'shoot', src: h.id, dst: f!.id, from: { ...h.pos }, to: { ...f!.pos }, text: 'execute', group: gunInHand(s)!.group });
      const amount = f!.kind === 'champion' ? Math.ceil(f!.maxHp * 0.25) : f!.hp;
      f!.hp = Math.max(0, f!.hp - amount); f!.awake = true;
      s.events.push({ t, type: 'hit', src: h.id, dst: f!.id, to: { ...f!.pos }, amount, crit: true });
      if (f!.hp === 0) {
        f!.alive = false;
        s.events.push({ t, type: 'die', src: h.id, dst: f!.id, to: { ...f!.pos } });
      }
      const shot = { ...c, foe: f, hooks: c.hooks ?? REFLEX_HOOKS, shotCost: 1 };
      emit(s, 'gunHit', shot);
      if (!f!.alive) emit(s, 'gunKill', { ...shot, count: 1 });
      break;
    }
    case 'charge': case 'refund': h.charge = Math.min(h.maxCharge, h.charge + (id === 'refund' ? c.shotCost ?? p : p)); break;
    case 'heal': h.hp = Math.min(h.maxHp, h.hp + p); break;
    case 'shield': h.shield = (h.shield ?? 0) + p; break;
    case 'nextMult': h.fx.nextMult = Math.max(h.fx.nextMult, p); break;
    case 'freeNext': h.fx.free = true; break;
    case 'push': pushFoe(s, t, f!, { x: Math.sign(f!.pos.x - h.pos.x), y: Math.sign(f!.pos.y - h.pos.y) }); break;
    case 'stun':
      f!.stun = Math.min(f!.kind === 'champion' ? 1 : Infinity, (f!.stun ?? 0) + p);
      s.events.push({ t, type: 'stun', src: h.id, dst: f!.id, to: { ...f!.pos } });
      emit(s, 'stunned', { ...c, foe: f, src: 'engraving' }); break;
    case 'elementBurst': applyElement(s, t, c.element!, f!.pos, p, null, h.id, undefined, h.id, true); break;
  }
  return true;
}
