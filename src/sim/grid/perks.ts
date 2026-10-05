import { WEAPONS } from './items';
import { hasPerk } from './mods';
import { freeCell, shotClear, strike } from './combat';
import { hurt, onEnter } from './status';
import { heroDmg, pushFoe } from './weapons';
import { add, canStep, dist, idx, same, HERO, type Ent, type GridState, type Hero } from './types';

export const PERK_BALANCE = { scatterTargets: 2, scatterDamage: 0.5, scatterRange: 3, pierceDamage: 0.7,
  pierceCells: 3, thermalRange: 8, soulShield: 6, shockChance: 0.2, shockTurns: 1, soulCharge: 1, runeDamage: 2, statusStrength: 1, elemTick: 1, chargeDamage: 3, combatRegen: 12, tapEvery: 3, whirlEvery: 3, undyingHp: 0.3 };
export const tapCost = (h: Hero, cost: number): number => hasPerk(h, 'doubleTap') && ((h.fx.taps ?? 0) + 1) % PERK_BALANCE.tapEvery === 0 ? 0 : cost;
export function sensedFoes(s: GridState): string[] {
  return hasPerk(s.hero, 'thermal') ? s.foes.filter(f => f.alive && dist(f.pos, s.hero.pos) <= PERK_BALANCE.thermalRange
    && !s.visible.has(idx(s.map, f.pos))).map(f => f.id) : [];
}
export function floorPerks(h: Hero): void {
  h.fx.undyingUsed = false;
  if (hasPerk(h, 'soulWeave')) h.shield = Math.max(h.shield ?? 0, PERK_BALANCE.soulShield);
}
export const chargeDamage = (h: Hero): number => hasPerk(h, 'chargeLegs') && h.fx.lastAction === 'move' ? PERK_BALANCE.chargeDamage : 0;
export function meleePerks(s: GridState, t: number, f: Ent): void {
  const h = s.hero;
  if (hasPerk(h, 'hookArms') && f.alive && dist(h.pos, f.pos) === 2) {
    const d = { x: Math.sign(f.pos.x - h.pos.x), y: Math.sign(f.pos.y - h.pos.y) }, mid = add(h.pos, d);
    if (same(add(mid, d), f.pos) && freeCell(s, mid) && canStep(s.map, h.pos, d) && canStep(s.map, mid, d)) {
      s.events.push({ t, type: 'push', src: h.id, dst: f.id, from: { ...f.pos }, to: mid, text: 'hook' });
      f.pos = mid; onEnter(s, f, t);
    }
  }
  if (f.alive && hasPerk(h, 'shockArms') && s.rng.chance(PERK_BALANCE.shockChance)) {
    f.stun = Math.max(f.stun ?? 0, PERK_BALANCE.shockTurns);
    s.events.push({ t, type: 'stun', src: h.id, dst: f.id, to: { ...f.pos } });
  }
}
export function reactivePush(s: GridState, t: number, f: Ent): void {
  if (!hasPerk(s.hero, 'reactive') || !f.alive) return;
  const d = { x: Math.sign(f.pos.x - s.hero.pos.x), y: Math.sign(f.pos.y - s.hero.pos.y) };
  if (freeCell(s, add(f.pos, d)) && canStep(s.map, f.pos, d)) pushFoe(s, t, f, d);
}
/** Secondary hits use the primary damage, never recursively trigger themselves. */
export function shotPerks(s: GridState, t: number, target: Ent, damage: number): void {
  const h = s.hero;
  if (hasPerk(h, 'scatter')) for (const f of s.foes.filter(f => f !== target && f.alive && dist(f.pos, target.pos) === 1).slice(0, PERK_BALANCE.scatterTargets)) {
    hurt(s, t, h.id, f, Math.max(1, Math.floor(damage * PERK_BALANCE.scatterDamage)), 'scatter');
  }
  if (!hasPerk(h, 'pierceBarrel')) return;
  const dx = target.pos.x - h.pos.x, dy = target.pos.y - h.pos.y;
  if ((!dx && !dy) || (dx && dy && Math.abs(dx) !== Math.abs(dy))) return;
  const d = { x: Math.sign(dx), y: Math.sign(dy) };
  let at = target.pos;
  for (let n = 0; n < PERK_BALANCE.pierceCells; n++) {
    at = add(at, d);
    if (!shotClear(s, target.pos, at, target)) break;
    const f = s.foes.find(f => f.alive && same(f.pos, at));
    if (f) { hurt(s, t, h.id, f, Math.max(1, Math.floor(damage * PERK_BALANCE.pierceDamage)), 'pierce'); break; }
  }
}

/** All lethal damage paths share the per-floor rescue; never emit a death before this check. */
export function rescueHero(s: GridState, t: number, dst: Ent): void {
  const h = s.hero;
  if (dst !== h || h.hp > 0 || !h.alive || h.fx.undyingUsed || !hasPerk(h, 'undyingHeart')) return;
  h.fx.undyingUsed = true; h.hp = Math.max(1, Math.ceil(h.maxHp * PERK_BALANCE.undyingHp));
  s.events.push({ t, type: 'buff', text: 'undying' });
}
export function timedPerks(s: GridState, t: number): void {
  const h = s.hero;
  if (!h.alive || !hasPerk(h, 'whirlHeart')) return;
  h.fx.whirlActions = (h.fx.whirlActions ?? 0) + 1;
  if (h.fx.whirlActions % PERK_BALANCE.whirlEvery !== 0) return;
  const blade = h.gear.hands.find(w => w && WEAPONS[w.group].melee);
  const dmg = blade ? heroDmg(s, blade) : HERO.bash;
  for (const f of s.foes.filter(f => f.alive && dist(h.pos, f.pos) === 1)) {
    s.events.push({ t, type: 'bump', src: h.id, dst: f.id, from: { ...h.pos }, to: { ...f.pos }, text: 'whirl' });
    strike(s, t, h, f, 1, dmg);
  }
}
