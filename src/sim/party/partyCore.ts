import { traitMult, takenMult, shieldBroken, blink, allyFell, martyrHolds, negate } from './traitCombat';
import { kitMult, proficient } from './classKit';
import { heal } from './kitEffects';
import { action, emit, type TriggerDef } from './triggers';
import { movedStatus, statusMult, type Status, type StatusId } from './status';
import type { HeroSoulId } from '../delve/heroSouls';
import { G, weaponDef, weaponStats, type Loadout } from '../delve/gear';
import { gearTaken } from '../delve/catalogEffects';
import { shotClear } from '../grid/combat';
import { findPath } from '../grid/path';
import { dist, idx, opaque, same, tileAt, type Cell, type Ent, type GEvent, type GridState } from '../grid/types';
import { CLASSES, FOES, WEAPONS, type BaseClass, type ClassId, type FoeId, type WeaponId } from './partyDefs';
import { type TraitId } from './traitDefs';
import { T } from './traitMods';
import { resonant, shieldedFury } from './resonance';
import { markMult } from './cardsRanged';

export type Order = { kind: 'attack'; target: string } | { kind: 'move'; cell: Cell } | { kind: 'hold'; cell: Cell } | null;

export interface Unit {
  fastNext?: boolean; attackMult?: number; ironGuard?: boolean; guardIntercepted?: boolean;
  ultReady: number; ultQueued?: boolean; ultCell?: Cell; immuneUntil?: number; leechUntil?: number; summoner?: string; summonedUntil?: number;
  status: Partial<Record<StatusId, Status>>; trig: Record<string, number>; nth: number; still: number; crisisUsed: boolean; triggers?: TriggerDef[]; moved?: boolean;
  nextCrit?: boolean; dodgeNext?: boolean; furyStacks?: number; furyUntil?: number; furyPower?: number; damageBuff?: number; damageBuffUntil?: number; blinkNext?: boolean; extraAttack?: boolean; attackMoved?: boolean; retreatShot?: boolean; immortalUsed?: boolean;
  blindUntil?: number;
  /** the initiative card's upgrade: every blow critical until the first kill */
  critUntilKill?: boolean;
  /** card state: rage built from blows taken, damage stored for the next blow, judgment marks, when a foe was last betrayed, chills taken toward a freeze */
  markFirst?: boolean; cycle?: number;
  martyrFloor?: number;
  /** the foe a companion's utility AI last chose (it sticks with it unless another is clearly better) */
  aiTarget?: string;
  /** when this clone was struck within the last turn (the whirlwind counts them) */
  struckTimes?: number[];
  /** the memory the soul in this body carried from its life (a starting rule) */
  memory?: string;
  /** once-a-fight memories already spent (shield keeper, poisoner) */
  keeperUsed?: boolean; poisonerUsed?: boolean;
  rage?: number; nextFlat?: number; judge?: number; betrayedAt?: number; chillHits?: number;
  /** who last struck this foe and when, and everyone who did within the last turn (teamwork laws); the floor a last-stand law was used on */
  lastHitBy?: string; lastHitAt?: number; hitters?: { id: string; t: number }[]; lastStandFloor?: number;
  lowHp?: boolean;
  foeScale?: number; mendReady?: number; slamReady?: number; slamPending?: boolean; called?: boolean;
  name?: string; hero?: HeroSoulId;
  gear?: Loadout;
  echoPending?: boolean;
  exposedUntil?: number; markUntil?: number; markBy?: string;
  burnUntil?: number; dotAt?: number; burnBy?: string;
  id: string; side: 'hero' | 'foe'; cls?: ClassId; weapon?: WeaponId; foe?: FoeId;
  nextAt: number; order: Order; ready: [number, number]; queued?: 0 | 1;
  tauntUntil: number; tauntBy?: string;
  /** soaks blows before health */
  shield: number;
  hiddenUntil: number; hasteUntil: number; frozenUntil: number;
  /** the next strike's multiplier (stealth) */
  empower: number;
  /** when a cleric's guardian ward may fire again */
  guardReady: number;
  /** kills that count toward this hero's advanced class */
  progress: number; promoteReady?: boolean;
  /** a camp foe that has not noticed the party yet (takes no turns) */
  asleep?: boolean; alertUntil?: number;
  /** the camp a foe belongs to (they wake together) */
  group?: number;
  /** the soul a hero carries (what drops where it falls) */
  soul?: BaseClass;
  /** a fallen foe whose bio-matter has been gathered */
  reaped?: boolean; raised?: boolean;
  /** a soul's growth: level, experience, traits taken, picks not yet spent and the three on offer */
  pendingKeystones?: number; level?: number; xp?: number; traits?: Partial<Record<TraitId, number>>; picks?: number; offer?: TraitId[];
  /** when grit can hold a killing blow again */
  gritReady?: number;
  /** when a ranged clone may next roll away from a foe at its side */
  rollReady?: number;
  /** the cell an archer last shot from and how many shots in a row from it (steady aim) */
  steadyAt?: Cell; steady?: number;
  /** a companion uses its skills by itself (on unless the player turns it off) */
  manualSkills?: boolean;
}
export interface Party {
  foeAction?: (u: Unit, t: number, ev: GEvent[]) => number | undefined;
  grounds?: {at:Cell;by:string;until:number;next:number}[];
  onMovement?: (moves: GEvent[], ev: GEvent[]) => void;
  beforeStep?: (u: Unit, t: number, ev: GEvent[]) => void;
  avoidTraps?: boolean;
  s: GridState; units: Unit[]; time: number; wave: number;
  /** on the world map: false while no awake foe is near (orders then move the whole party; arrival does not hold) */
  combat?: boolean;
  /** the hero the others follow out of combat */
  leader?: string;
  /** world-map rules turn on (targets only awake foes nearby) */
  roam?: boolean;
  /** cells of waist-high cover (boulders, low walls, barricades) beside walls and trees */
  cover?: Uint8Array;
  /** turn-based fighting: the clone under the player's hand; time stops on its moment until it is given something to do */
  manual?: string;
  /** time is stopped, waiting for the manual clone's command */
  waiting?: boolean;
}

/** how far a fight reaches on the roaming maps: clones go for foes this close, and a foe this close to any clone means a fight */
export const ENGAGE = 10;

export const entOf = (p: Party, id: string): Ent | undefined => (id === 'hero' ? p.s.hero : p.s.foes.find((f) => f.id === id));
export const unitOf = (p: Party, id: string): Unit | undefined => p.units.find((u) => u.id === id);
export const alive = (p: Party, u: Unit): boolean => entOf(p, u.id)?.alive ?? false;
export const posOf = (p: Party, u: Unit): Cell => entOf(p, u.id)!.pos;
export const roll = (p: Party, r: [number, number]): number => p.s.rng.int(r[0], r[1]);
export const occupied = (p: Party, c: Cell, self: string): boolean => p.units.some((u) => u.id !== self && alive(p, u) && same(posOf(p, u), c));
const passive = (u: Unit) => (u.cls ? CLASSES[u.cls].passive : undefined);

/** What a unit's basic attack is: the hero's weapon, or the foe's kind. */
export function stats(u: Unit, t = 0, p?: Party): { dmg: [number, number]; range: number; atk: number; move: number } {
  if (!u.cls) {
    const f = FOES[u.foe!], scale = u.foeScale ?? 1;
    return { ...f, dmg: [Math.round(f.dmg[0] * scale), Math.round(f.dmg[1] * scale)] };
  }
  const e = p && entOf(p, u.id);
  const lowHp = e ? e.hp < e.maxHp / 2 : u.lowHp;
  const w = weaponStats(u);
  const range = (w.range > 1 && passive(u) === 'farShot' ? w.range + 2 : w.range) + (w.range > 1 ? T.range(u) + (p && resonant(p, u, '원거리', 1) ? 1 : 0) : 0);
  return { dmg: w.dmg, range, atk: w.atk * (u.cls === 'berserker' && proficient(u) && lowHp ? 0.5 : 1) * G.atk(u) * (u.fastNext?.5:1) * (t < u.hasteUntil ? 0.5 : 1) * T.atk(u), move: CLASSES[u.cls==='veteran'&&u.soul?u.soul:u.cls].move * T.move(u) * G.move(u) };
}

export function canHit(p: Party, u: Unit, target: Unit, range = stats(u, 0, p).range): boolean {
  const a = posOf(p, u), b = posOf(p, target), d = dist(a, b);
  return d <= range && (range <= 1 ? d === 1 : shotClear(p.s, a, b));
}

/** Who a unit goes for: a taunt, its order, else the nearest unhidden foe of the other side. */
export function targetOf(p: Party, u: Unit, t: number): Unit | undefined {
  if (u.side === 'foe' && u.tauntBy && t < u.tauntUntil) { const by = p.units.find((x) => x.id === u.tauntBy && alive(p, x)); if (by) return by; }
  if (u.side === 'foe' && !u.order) {
    // a warrior close by draws the foe onto itself (the warrior's core: it is the one that gets hit)
    const me = posOf(p, u), threat = p.units.filter((x) => x.side === 'hero' && x.cls && WARRIORS.has(x.cls) && alive(p, x) && t >= x.hiddenUntil && dist(posOf(p, x), me) <= 2)
      .sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
    if (threat) return threat;
  }
  if (u.order?.kind === 'attack') { const id = u.order.target; const o = p.units.find((x) => x.id === id && alive(p, x)); if (o) return o; u.order = null; }
  const me = posOf(p, u);
  return p.units.filter((x) => x.side !== u.side && alive(p, x) && !(x.side === 'hero' && t < x.hiddenUntil) && !(p.roam && (x.asleep || dist(posOf(p, x), me) > ENGAGE))).sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
}

/** One step toward `to` along a free path (other bodies block, the goal itself does not). */
export function stepToward(p: Party, u: Unit, to: Cell, t: number, ev: GEvent[]): boolean {
  const e = entOf(p, u.id)!;
  p.beforeStep?.(u, t, ev);
  let safeMap = p.s.map;
  if (p.avoidTraps && u.side === 'hero' && p.s.traps.some((trap) => trap.found)) {
    safeMap = { ...p.s.map, tiles: [...p.s.map.tiles] };
    for (const trap of p.s.traps) if (trap.found && !same(trap.pos, e.pos)) safeMap.tiles[idx(safeMap, trap.pos)] = 'wall';
  }
  const next = (findPath(safeMap, e.pos, to, (c) => occupied(p, c, u.id)) ?? findPath(p.s.map, e.pos, to, (c) => occupied(p, c, u.id)))?.[0];
  if (!next || occupied(p, next, u.id)) return false;
  ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...next } });
  e.pos = next;
  u.moved = true; u.still = 0; movedStatus(p, u, t, ev); emit(p, 'moved', { t, src: u, ev });
  // a closed door swings open as someone walks through it
  const k = idx(p.s.map, next);
  if (p.s.map.tiles[k] === 'door') { p.s.map.tiles[k] = 'open'; ev.push({ t, type: 'door', src: u.id, to: { ...next } }); }
  return true;
}

/** The class engravings that scale a hero's blow on this target. */
export function passiveMult(p: Party, u: Unit, target: Unit, t: number, _ev: GEvent[]): number {
  void _ev; return kitMult(p, u, target, t);
}

export function damage(p: Party, t: number, src: string, dst: Unit, amount: number, ev: GEvent[], secondary = false, statusScaled = false): void {
  const e = entOf(p, dst.id)!;
  if (!e.alive || t < (dst.immuneUntil ?? 0)) return;
  const attacker = unitOf(p, src);
  if(attacker && !alive(p,attacker) && !secondary) return;
  if (!secondary && attacker?.side === 'hero' && dst.side === 'foe') {
    const vulnerable=statusScaled?1:((dst.status.exposed?.until??0)>t?1.5:1)*((dst.status.mark?.until??0)>t&&dst.status.mark?.by!==src?markMult(attacker):1);
    amount=Math.round(amount*G.dmg(attacker)*vulnerable);
    dst.lastHitBy = src; dst.lastHitAt = t; dst.hitters = [...(dst.hitters ?? []).filter((h) => t - h.t < 1 && h.id !== src), { id: src, t }];
  }
  if (dst.side === 'hero') {
    amount=Math.round(amount*takenMult(p,dst,t)*gearTaken(dst));
    const guard = (dst.gear ? weaponDef(dst)?.shield : WEAPONS[dst.weapon!].shield) ? .75 : undefined;
    if (guard) amount = Math.max(1, Math.round(amount * guard));
    if (G.reduce(dst)) amount = Math.max(1, Math.round(amount * (1 - G.reduce(dst))));
    const link = secondary ? undefined : p.units.find(x=>x!==dst&&x.gear?.accessory?.def==='guardOath'&&alive(p,x)&&dist(posOf(p,x),e.pos)<=1) ?? p.units.find(x=>x.cls==='guardian'&&x!==dst&&alive(p,x)&&proficient(x)&&dist(posOf(p,x),e.pos)<=1);
    if (link) {
      const share = Math.round(amount * 0.3);
      if (share > 0 && link.cls === 'guardian' && proficient(link) && link.gear?.accessory?.def !== 'guardOath') {
        link.guardIntercepted = false;
        emit(p,'guard',{t,src:link,target:attacker,amount:share,ev});
        if (link.guardIntercepted) amount -= share;
      } else if (share > 0) { amount -= share; damage(p,t,src,link,share,ev,true); }
    }
    amount = negate(p, dst, attacker, amount, t, ev, secondary);
    const soak = Math.min(dst.shield, amount);
    dst.shield -= soak; amount -= soak;
    if(soak>0 && dst.shield===0){shieldBroken(p,dst,t,ev,soak);emit(p,'shieldBreak',{t,src:dst,target:attacker,amount:soak,ev});}
  }
  // a blow on a sleeping camp wakes the whole camp
  if (dst.asleep) for (const f of p.units) if (f.side === 'foe' && f.group === dst.group) f.asleep = false;
  // grit: a blow that would kill leaves one point, once in a while
  if (dst.side === 'hero' && amount >= e.hp && T.gritCd(dst) > 0 && t >= (dst.gritReady ?? 0)) {
    amount = e.hp - 1; dst.gritReady = t + T.gritCd(dst);
    ev.push({ t, type: 'buff', src: dst.id, dst: dst.id, text: 'grit' });
  }
  if(dst.traits?.immortal && amount>=e.hp && !dst.immortalUsed) {dst.immortalUsed=true;dst.immuneUntil=t+3;amount=0;}
  if (dst.side === 'hero' && !dst.summoner && amount >= e.hp && martyrHolds(p, dst)) amount = e.hp - 1;
  const prevHp = e.hp;
  e.hp = Math.max(0, e.hp - amount); dst.lowHp = e.hp < e.maxHp/2;
  ev.push({ t, type: 'hit', src, dst: dst.id, amount, to: { ...e.pos } });
  if (e.hp <= 0) {
    e.alive = false;
    ev.push({ t, type: 'die', src, dst: dst.id, to: { ...e.pos } });
    if (dst.side === 'hero' && !dst.summoner) allyFell(p, dst, t, ev);
    const master = dst.summoner ? unitOf(p, dst.summoner) : undefined;
    if (master && alive(p, master)) emit(p, 'summonDied', { t, src: master, target: dst, ev });
    const killer = unitOf(p, src);
    if (killer?.side === 'hero' && dst.side === 'foe') {

      emit(p, 'kill', { t, src: killer, target: dst, amount, over: Math.max(0, amount - prevHp), ev });
      // mana flow: a kill takes seconds off the killer's skills

    }
    return;
  }
  if (dst.side === 'hero') { dst.struckTimes = [...(dst.struckTimes ?? []).filter((s) => t - s < 1), t]; emit(p, 'struck', { t, src: dst, target: attacker, amount, ev }); if (e.hp < e.maxHp * 0.5) emit(p, 'crisis', { t, src: dst, target: attacker, ev }); }

}

/** Is the target tucked beside cover on the shooter's side (a wall, a tree, a boulder…)? Point-blank ignores it. */
export function behindCover(p: Party, shooter: Cell, target: Cell): boolean {
  const dx = Math.sign(shooter.x - target.x), dy = Math.sign(shooter.y - target.y);
  const sides: Cell[] = [];
  if (dx) sides.push({ x: target.x + dx, y: target.y });
  if (dy) sides.push({ x: target.x, y: target.y + dy });
  if (dx && dy) sides.push({ x: target.x + dx, y: target.y + dy });
  const m = p.s.map;
  return dist(shooter, target) > 1 && sides.some((c) => opaque(tileAt(m, c)) || p.cover?.[idx(m, c)] === 1);
}

/** A basic attack (or a skill's blow at `mult`): engravings, then the weapon's own trait. */
/** The odds of a blow before the dice: a shot at a body behind cover mostly hits the cover, eagle eyes aim truer, blindness halves it; a shield blocks some blades. */
export function hitOdds(p: Party, u: Unit, target: Unit, t: number): { hit: number; block: number } {
  const st = stats(u, t, p), covered = st.range > 1 && behindCover(p, posOf(p, u), posOf(p, target));
  const hit = (st.range <= 1 ? 0.9 : (covered ? 0.5 : 0.85) + T.hit(u)) * (1 - T.evade(target)) * (t < (u.blindUntil ?? 0) ? 0.5 : 1);
  return { hit, block: st.range <= 1 ? T.block(target) + G.block(target) : 0 };
}

/** The chance a blow lands (blocks counted as misses), for the target card. */
export const hitChance = (p: Party, u: Unit, target: Unit, t: number): number => {
  const o = hitOdds(p, u, target, t);
  return Math.max(0, Math.min(1, o.hit * (1 - Math.min(1, o.block))));
};

/** the warrior line: foes close by go for them */
const WARRIORS = new Set<ClassId>(['warrior', 'berserker', 'guardian']);
/** Each level adds 6% to a clone's blows. */
export const levelDmg = (u: Unit): number => 1 + 0.06 * ((u.level ?? 1) - 1);

export function strike(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], mult = 1, basic = true): void {
  action(p,()=>strikeAction(p,u,target,t,ev,mult,basic));
}
function strikeAction(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], mult = 1, basic = true): void {
  if (!alive(p, u) || !alive(p, target)) return;
  const e = entOf(p, u.id)!, te = entOf(p, target.id)!, st = stats(u, t, p);
  if(basic)u.fastNext=false;
  blink(p,u,target,t,ev); if(!alive(p,u))return;
  if (basic) { u.attackMoved=u.moved; u.nth++; if (!u.moved) u.still++; else u.still = 0; emit(p, 'nth', { t, src: u, target, ev }); if (!u.moved) emit(p, 'still', { t, src: u, target, ev }); u.moved = false; }
  if (!alive(p, u) || !alive(p, target)) return;
  const magic = u.cls ? CLASSES[u.cls].magic : false;
  if (st.range <= 1) ev.push({ t, type: 'bump', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos } });
  else ev.push({ t, type: 'shoot', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos }, text: magic ? 'spell' : 'bow' });
  const odds = hitOdds(p, u, target, t);
  const dodge = target.dodgeNext; target.dodgeNext=false;
  const blocked = odds.block > 0 && p.s.rng.chance(odds.block);
  if (dodge || blocked || !p.s.rng.chance(odds.hit)) { ev.push({ t, type: 'miss', src: u.id, dst: target.id, to: { ...te.pos }, text: blocked ? 'block' : undefined }); emit(p, blocked ? 'block' : 'dodge', { t, src: target, target: u, ev }); return; }
  u.attackMult = 1; emit(p,'beforeHit',{t,src:u,target,ev});
  const crit = !u.traits?.avatar && (u.nextCrit || p.s.rng.chance(0.05 + T.crit(u) + (weaponDef(u)?.family==='dagger'?.05:0))); u.nextCrit=false;
  let m = mult * (u.attackMult ?? 1) * (crit ? T.critDmg(u) : 1) * traitMult(p,u,target,t) * statusMult(p, u, target, !!weaponDef(u)?.twoHand || u.weapon === 'greataxe' || u.weapon === 'crossbow', t, ev);
  if (u.side === 'hero') {
    m *= levelDmg(u) * (u.shield > 0 && shieldedFury(p) ? 1.2 : 1);
    const empowerment = basic || !u.echoPending || u.empower > 2 ? u.empower : 1;
    m *= passiveMult(p, u, target, t, ev) * empowerment;
    if (empowerment > 1) {
      u.empower = !basic && u.echoPending ? 2 : 1; u.hiddenUntil = 0;
      if (basic) u.echoPending = false;
    }
    // bond: each ally close by; steady aim: shots in a row from the same spot; a critical blow
    const near = p.units.filter((x) => x.side === 'hero' && !x.summoner && x !== u && alive(p, x) && dist(posOf(p, x), e.pos) <= 2).length;
    m *= 1 + T.bond(u) * near;
  }
  if (target.side === 'hero' && st.range > 1 && behindCover(p, e.pos, te.pos)) m *= T.coverTaken(target);
  if(!alive(p,u))return;
  const hp = te.hp;
  const flat = u.nextFlat ?? 0; u.nextFlat = 0;
  damage(p, t, u.id, target, Math.round(roll(p, st.dmg) * m) + flat, ev, false, true);
  if (t < (u.leechUntil ?? 0)) heal(p,u,u,(hp-te.hp)*0.3,t,ev);
  emit(p, 'hit', { t, src: u, target, amount: hp - te.hp, ev }); if (crit) emit(p, 'crit', { t, src: u, target, amount: hp - te.hp, ev });
  if (!alive(p, u)) return;
  if(!alive(p,u))return;
  const d=weaponDef(u);
  const w = u.gear ? (d?.family==='staff'?{splash:true,cleave:false,stun:0}:undefined) : u.weapon ? WEAPONS[u.weapon] : undefined;
  if (w?.cleave || w?.splash) {
    const around = w.cleave ? e.pos : te.pos;
    for (const f of p.units) if (f.side !== u.side && f !== target && alive(p, f) && dist(posOf(p, f), around) === 1) damage(p, t, u.id, f, Math.round(roll(p, st.dmg) / 2), ev);
  }
  if (w?.stun && te.alive && p.s.rng.chance(w.stun)) target.nextAt = Math.max(target.nextAt, t + 1.2);
  // a warrior struck in melee sometimes strikes straight back

}
