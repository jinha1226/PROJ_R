import { traitMult, takenMult, shieldBroken, blink, negate } from './traitCombat';
import { kitMult, tagsOf } from './classKit';
import { heal } from './kitEffects';
import { action, emit, type TriggerDef } from './triggers';
import { movedStatus, statusMult, type Status, type StatusId } from './status';
import type { HeroSoulId } from '../delve/heroSouls';
import type { BodySoul } from './body';
import { G, weaponDef, weaponStats, type Loadout } from '../delve/gear';
import { gearTaken } from '../delve/catalogEffects';
import { shotClear } from '../grid/combat';
import { findPath } from '../grid/path';
import { dist, idx, opaque, same, tileAt, type Cell, type Ent, type GEvent, type GridState } from '../grid/types';
import { CLASSES, FOES, WEAPONS, type ClassId, type FoeId, type WeaponId } from './partyDefs';
import { type TraitId } from './traitDefs';
import { T } from './traitMods';
import { ampBase, rank } from './traitTypes';
import { resonant, shieldedFury } from './resonance';
import { markMult } from './cardsRanged';
import { isGun, magOf } from './ammo';
import { elementAmp } from './cardsMage';
import { necroAmp } from './cardsNecro';
import { shoutAmp } from './cardsWarrior';
import { elementShooterAmp } from './cardsArcher';
import { holyAmp } from './cardsCleric';

/** `hold` with `fixed`: the unit never leaves its cell (a clone at its post in a raid: it is a wall there) */
export type Order = { kind: 'attack'; target: string } | { kind: 'move'; cell: Cell } | { kind: 'hold'; cell: Cell; fixed?: boolean } | null;

export interface Unit {
  /** where this clone stands when a raid comes (chosen by day; none: wherever it happens to be) */
  post?: Cell;
  fastNext?: boolean; attackMult?: number; ironGuard?: boolean; guardIntercepted?: boolean;
  ultReady: number; ultQueued?: boolean; ultSlot?: number; ultCell?: Cell; immuneUntil?: number; leechUntil?: number; summoner?: string; summonedUntil?: number;
  status: Partial<Record<StatusId, Status>>; trig: Record<string, number>; nth: number; still: number; crisisUsed: boolean; triggers?: TriggerDef[]; moved?: boolean;
  nextCrit?: boolean; dodgeNext?: boolean; furyStacks?: number; furyUntil?: number; furyPower?: number; damageBuff?: number; damageBuffUntil?: number; blinkNext?: boolean; extraAttack?: boolean; attackMoved?: boolean; retreatShot?: boolean; immortalUsed?: boolean;
  blindUntil?: number;
  /** the initiative card's upgrade: every blow critical until the first kill */
  critUntilKill?: boolean;
  /** card state: rage built from blows taken, damage stored for the next blow, judgment marks, when a foe was last betrayed, chills taken toward a freeze */
  markFirst?: boolean; cycle?: number;
  /** the foe a companion's utility AI last chose (it sticks with it unless another is clearly better) */
  aiTarget?: string;
  /** when this clone was struck within the last turn (the whirlwind counts them) */
  struckTimes?: number[];
  /** offers this clone may still reroll on this run */
  rerolls?: number;
  /** a weak horde foe (half the experience and bio-matter) */
  fodder?: boolean;
  /** rounds left in a gun's magazine (unset: full) */
  ammo?: number;
  /** the workshop modules this empty body carries (a snapshot taken at the base) */
  sfMods?: string[];
  /** empty-body state: who has already taken an aimed first shot at this foe; a piercing round loaded; hits in a row (by attack count); more forced crits; suit overload spent (floor / fight) */
  grenadeNext?: boolean; rfTurn?: number; rfCount?: number;
  /** a golem, a shadow clone (copies its owner, takes no turns), a curse (takes 20% more) and who laid it */
  golem?: boolean; mirror?: boolean; cursedUntil?: number; cursedBy?: string;
  /** the rogue's ki, a finishing blow under way (its target) and a blow struck from hiding (when) */
  /** base mode: when an idle clone at home strolls again; a clone hurt in a raid (it skips the next trip) */
  idleAt?: number; injured?: boolean;
  /** base mode, gathering on: the cell beside the pod or a module this clone works at, and when its next swing is */
  workCell?: Cell; workAt?: number;
  /** a raid's fodder: moved by the horde (free coordinates sx, sy; its cell is where they fall), never by its own turns */
  swarm?: boolean; sx?: number; sy?: number; hitAt?: number; stillT?: number;
  /** a raider whose fall has been paid for (raid loot) */
  paid?: boolean;
  /** come with a raid (its fall pays a quarter of what a dungeon foe's does); `lean`: one of the many that leave nothing at all */
  raider?: boolean; lean?: boolean;
  /** the warrior's spin (blade storm) and shout ending, its frenzy stacks and when it last hit */
  spinUntil?: number; shoutUntil?: number; frenzy?: number; frenzyAt?: number;
  /** a return shot under way (the empty body's return fire, rank 3) */
  returnFiring?: boolean;
  /** the archer's volley ending and its piercing build-up */
  volleyUntil?: number; pierceStack?: number;
  /** the cleric's extra hammers (when each ends), where the ring stands, its next step, a hammer blow under way; the aura's build-up; zeal */
  whirling?: boolean; hammers?: number[]; hammerPhase?: number; hammerNext?: number; hammering?: boolean; auraBoost?: number; zealUntil?: number;
  ki?: number; finishing?: number; finishTarget?: string; finishAt?: number; fromHiding?: number;
  /** the blizzard's spot and since when the mage has held it */
  anchor?: Cell; anchorAt?: number;
  sighted?: string[]; pierceNext?: boolean; hitStreak?: number; streakNth?: number; critShots?: number; overloadFloor?: number; overloadUsed?: boolean;
  /** the souls in this body, the first setting its class (empty: the SF body) */
  souls?: BodySoul[];
  /** this body has been down a shaft (it takes no more souls) */
  wentDown?: boolean;
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
  progress: number;
  /** a camp foe that has not noticed the party yet (takes no turns) */
  asleep?: boolean; alertUntil?: number;
  /** the camp a foe belongs to (they wake together) */
  group?: number;
  /** a fallen foe whose bio-matter has been gathered */
  reaped?: boolean; raised?: boolean;
  /** how many times each counted effect's condition has held (an effect that goes off every nth time) */
  tally?: Record<string, number>;
  /** a body that has burst (it can still be raised), or a skeleton that has blown itself up */
  burst?: boolean;
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
  /** a raid: the clones' ultimates are the player's to fire (no clone reaches for its own) */
  manualUlts?: boolean;
  foeAction?: (u: Unit, t: number, ev: GEvent[]) => number | undefined;
  grounds?: {at:Cell;by:string;until:number;next:number;kind?:'burn'|'poison';r?:number}[];
  /** gravity wells pulling foes in (the empty body's ultimate) */
  wells?: {at:Cell;by:string;until:number;next:number}[];
  /** the rogue's snares on the floor */
  snares?: import('./snares').Snare[];
  /** sanctuaries on the floor (the cleric's ultimate) */
  zones?: { at: Cell; by: string; until: number; next: number; r: number }[];
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

/** the foe list by id (a raid has hundreds out at once, and everything asks who is alive): rebuilt when the list grows, is replaced, or an id was changed */
const byId = new WeakMap<Ent[], { n: number; map: Map<string, Ent> }>();
function indexOf(foes: Ent[]): Map<string, Ent> {
  const map = new Map<string, Ent>();
  // the first of a kind wins, as a search from the front would
  for (const f of foes) if (!map.has(f.id)) map.set(f.id, f);
  byId.set(foes, { n: foes.length, map });
  return map;
}
export function entOf(p: Party, id: string): Ent | undefined {
  if (id === 'hero') return p.s.hero;
  const foes = p.s.foes, ix = byId.get(foes);
  let e = (ix && ix.n === foes.length ? ix.map : indexOf(foes)).get(id);
  // a body renamed since the list was read (a printed clone takes its own id): read it again
  if (!e || e.id !== id) { e = indexOf(foes).get(id); if (e && e.id !== id) e = undefined; }
  return e;
}
export const unitOf = (p: Party, id: string): Unit | undefined => p.units.find((u) => u.id === id);
export const alive = (p: Party, u: Unit): boolean => entOf(p, u.id)?.alive ?? false;
export const posOf = (p: Party, u: Unit): Cell => entOf(p, u.id)!.pos;
export const roll = (p: Party, r: [number, number]): number => p.s.rng.int(r[0], r[1]);
/** whether something stands in the cell (a raid's fodder never blocks: the crowd is walked through) */
export const occupied = (p: Party, c: Cell, self: string): boolean => p.units.some((u) => u.id !== self && !u.swarm && alive(p, u) && same(posOf(p, u), c));

/** What a unit's basic attack is: the hero's weapon, or the foe's kind. */
export function stats(u: Unit, t = 0, p?: Party): { dmg: [number, number]; range: number; atk: number; move: number } {
  if (!u.cls) {
    const f = FOES[u.foe!], scale = u.foeScale ?? 1;
    return { ...f, dmg: [Math.round(f.dmg[0] * scale), Math.round(f.dmg[1] * scale)] };
  }
  const w = weaponStats(u);
  const range = w.range + (w.range > 1 ? T.range(u) + (p && resonant(p, u, '원거리', 1) ? 1 : 0) : 0);
  return { dmg: w.dmg, range, atk: w.atk * G.atk(u) * (u.fastNext?.5:1) * (t < u.hasteUntil ? 0.5 : 1) * (t < (u.zealUntil ?? 0) ? 0.7 : 1) * T.atk(u), move: CLASSES[u.cls].move * T.move(u) * G.move(u) };
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
  // out of a fight a clone walks through its own summons (they swap places): a golem lasts until it falls, and would wall a corridor
  const mine = (c: Cell) => (p.combat === false && !u.summoner ? p.units.find((x) => x.summoner === u.id && alive(p, x) && same(posOf(p, x), c)) : undefined);
  const blocked = (c: Cell) => occupied(p, c, u.id) && !mine(c);
  const next = (findPath(safeMap, e.pos, to, blocked) ?? findPath(p.s.map, e.pos, to, blocked))?.[0];
  if (!next || blocked(next)) return false;
  const swap = mine(next);
  if (swap) { ev.push({ t, type: 'move', src: swap.id, from: { ...next }, to: { ...e.pos } }); entOf(p, swap.id)!.pos = { ...e.pos }; }
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

/** the element a blow or an effect deals (Achra-style 'on dealing/being dealt fire damage' conditions read it) */
export type DamageKind = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'holy' | 'bone';

/**
 * Harm to a unit. `kind` is its element; `hit` marks damage that came with a landed attack or a free hit (only that is
 * 'being hit' for the target, Achra's On being hit); any damage is 'damage' for a hero dealing it and 'damaged' for a hero taking it.
 */
export function damage(p: Party, t: number, src: string, dst: Unit, amount: number, ev: GEvent[], secondary = false, statusScaled = false, kind: DamageKind = 'physical', hit = false): void {
  const e = entOf(p, dst.id)!;
  if (!e.alive || t < (dst.immuneUntil ?? 0)) return;
  const attacker = unitOf(p, src);
  if(attacker && !alive(p,attacker) && !secondary) return;
  // blasting mastery (empty body): fire damage grows with every #화염
  if (attacker && kind === 'fire' && rank(attacker, 'blastAmp')) amount = Math.round(amount * ampBase(attacker, 'blastAmp', 1.12) ** (tagsOf(attacker).화염 ?? 0));
  // necromancer masteries (bone, poison, minions), multiplied
  if (attacker && (attacker.traits || attacker.summoner)) { const m = necroAmp(p, attacker, kind); if (m !== 1) amount = Math.round(amount * m); }
  // mage masteries (fire, lightning, cold on the frozen), multiplied
  if (attacker?.traits && (attacker.traits.fireAmp || attacker.traits.boltAmp || attacker.traits.coldAmp)) amount = Math.round(amount * elementAmp(attacker, dst, kind, t));
  if (!secondary && attacker?.side === 'hero' && dst.side === 'foe') {
    const vulnerable=statusScaled?1:((dst.status.exposed?.until??0)>t?1.5:1)*((dst.status.mark?.until??0)>t&&dst.status.mark?.by!==src?markMult(attacker):1);
    amount=Math.round(amount*G.dmg(attacker)*vulnerable);
  }
  // holy mastery (cleric), multiplied
  if (attacker?.traits?.holyAmp) amount = Math.round(amount * holyAmp(attacker, kind));
  // element archer mastery: fire and cold, multiplied
  if (attacker?.traits?.elementShooter) amount = Math.round(amount * elementShooterAmp(attacker, kind));
  // shout mastery (warrior): a stunned or taunted foe takes more, multiplied
  if (attacker?.traits?.shoutAmp) amount = Math.round(amount * shoutAmp(attacker, dst, t));
  // a curse: the foe takes a fifth more from anyone
  if (dst.side === 'foe' && t < (dst.cursedUntil ?? 0)) amount = Math.round(amount * 1.2);
  if (!secondary && attacker?.side === 'hero' && dst.side === 'foe') {
    dst.lastHitBy = src; dst.lastHitAt = t; dst.hitters = [...(dst.hitters ?? []).filter((h) => t - h.t < 1 && h.id !== src), { id: src, t }];
  }
  if (dst.side === 'hero') {
    amount=Math.round(amount*takenMult(p,dst,t)*gearTaken(dst));
    // soul link (necromancer): the nearest minion takes three tenths of the harm
    const bond = rank(dst, 'soulLink') && amount > 1 ? p.units.filter((x) => x.summoner === dst.id && alive(p, x)).sort((a, b) => dist(posOf(p, a), e.pos) - dist(posOf(p, b), e.pos))[0] : undefined;
    if (bond) { const share = Math.round(amount * (rank(dst, 'soulLink') >= 2 ? 0.45 : 0.3)); amount -= share; damage(p, t, src, bond, share, ev, true); }
    const guard = (dst.gear ? weaponDef(dst)?.shield : WEAPONS[dst.weapon!].shield) ? .75 : undefined;
    if (guard) amount = Math.max(1, Math.round(amount * guard));
    if (G.reduce(dst)) amount = Math.max(1, Math.round(amount * (1 - G.reduce(dst))));
    const link = secondary ? undefined : p.units.find(x=>x!==dst&&x.gear?.accessory?.def==='guardOath'&&alive(p,x)&&dist(posOf(p,x),e.pos)<=1);
    if (link) {
      const share = Math.round(amount * 0.3);
      if (share > 0) { amount -= share; damage(p,t,src,link,share,ev,true); }
    }
    amount = negate(p, dst, amount, t, ev);
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
  const prevHp = e.hp;
  e.hp = Math.max(0, e.hp - amount); dst.lowHp = e.hp < e.maxHp/2;
  ev.push({ t, type: 'hit', src, dst: dst.id, amount, to: { ...e.pos } });
  const dealer = unitOf(p, src), dealt = dealer?.side === 'hero' && dst.side === 'foe' && amount > 0;
  if (e.hp <= 0) {
    e.alive = false;
    ev.push({ t, type: 'die', src, dst: dst.id, to: { ...e.pos } });
    // the damage is dealt once the foe is down: an on-damage effect cannot strike the dying body again
    if (dealt) emit(p, 'damage', { t, src: dealer!, target: dst, amount, kind, ev });
    const master = dst.summoner ? unitOf(p, dst.summoner) : undefined;
    if (master && alive(p, master)) emit(p, 'summonDied', { t, src: master, target: dst, ev });
    const killer = unitOf(p, src);
    if (killer?.side === 'hero' && dst.side === 'foe') {

      emit(p, 'kill', { t, src: killer, target: dst, amount, over: Math.max(0, amount - prevHp), kind, ev });
      // a minion's kill is its master's kill too (C3 spec §5): the master's 'on kill' cards answer it
      const owner = killer.summoner ? unitOf(p, killer.summoner) : undefined;
      if (owner && alive(p, owner)) emit(p, 'kill', { t, src: owner, target: dst, amount, over: Math.max(0, amount - prevHp), kind, ev });
      // mana flow: a kill takes seconds off the killer's skills

    }
    return;
  }
  if (dealt) emit(p, 'damage', { t, src: dealer!, target: dst, amount, kind, ev });
  if (dst.side === 'hero') {
    // being hit (an attack or a free hit landed) is not the same as taking damage (a burn, a trap, a blast)
    if (hit) { dst.struckTimes = [...(dst.struckTimes ?? []).filter((s) => t - s < 1), t]; emit(p, 'struck', { t, src: dst, target: attacker, amount, ev }); }
    if (amount > 0) emit(p, 'damaged', { t, src: dst, target: attacker, amount, kind, ev });
    if (e.hp < e.maxHp * 0.5) emit(p, 'crisis', { t, src: dst, target: attacker, ev });
  }

}

/**
 * A hit an effect makes (Achra's free hit: no dodge, block or armour roll): it lands for `amount` of `kind`, and counts as
 * a hit for the dealer's 'on hit' effects and as being hit for a hero target.
 */
export function freeHit(p: Party, u: Unit, target: Unit, amount: number, kind: DamageKind, t: number, ev: GEvent[]): void {
  action(p, () => {
    if (!alive(p, u) || !alive(p, target)) return;
    const te = entOf(p, target.id)!, hp = te.hp;
    damage(p, t, u.id, target, amount, ev, true, true, kind, true);
    emit(p, 'hit', { t, src: u, target, amount: hp - te.hp, ev });
  });
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
const WARRIORS = new Set<ClassId>(['warrior']);
/** Each level adds 6% to a clone's blows. */
export const levelDmg = (u: Unit): number => 1 + 0.06 * ((u.level ?? 1) - 1);

export function strike(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], mult = 1, basic = true): void {
  // an empty magazine: this attack is a reload instead
  if (basic && isGun(u) && (u.ammo ?? magOf(p, u)) <= 0) { u.ammo = magOf(p, u); ev.push({ t, type: 'reload', src: u.id }); action(p, () => emit(p, 'reload', { t, src: u, ev })); return; }
  action(p,()=>strikeAction(p,u,target,t,ev,mult,basic));
}
function strikeAction(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], mult = 1, basic = true): void {
  if (!alive(p, u) || !alive(p, target)) return;
  const e = entOf(p, u.id)!, te = entOf(p, target.id)!, st = stats(u, t, p);
  if(basic)u.fastNext=false;
  blink(p,u,target,t,ev); if(!alive(p,u))return;
  // every attack is an attack (Achra's On attack), whether it lands or not
  emit(p, 'attack', { t, src: u, target, basic, ev }); if (!alive(p, u) || !alive(p, target)) return;
  if (basic) { u.attackMoved=u.moved; u.nth++; if (!u.moved) u.still++; else u.still = 0; emit(p, 'nth', { t, src: u, target, ev }); if (!u.moved) emit(p, 'still', { t, src: u, target, ev }); u.moved = false; }
  if (!alive(p, u) || !alive(p, target)) return;
  const magic = u.cls ? CLASSES[u.cls].magic : false;
  if (st.range <= 1) ev.push({ t, type: 'bump', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos } });
  else ev.push({ t, type: 'shoot', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos }, text: magic ? 'spell' : isGun(u) ? 'gun' : 'bow' });
  if (basic && isGun(u)) u.ammo = (u.ammo ?? magOf(p, u)) - 1;
  const odds = hitOdds(p, u, target, t);
  const dodge = target.dodgeNext; target.dodgeNext=false;
  const blocked = odds.block > 0 && p.s.rng.chance(odds.block);
  if (dodge || blocked || !p.s.rng.chance(odds.hit)) {
    ev.push({ t, type: 'miss', src: u.id, dst: target.id, to: { ...te.pos }, text: blocked ? 'block' : undefined }); emit(p, blocked ? 'block' : 'dodge', { t, src: target, target: u, ev });
    if (basic && isGun(u)) u.hitStreak = 0;
    emit(p, 'miss', { t, src: u, target, basic, ev });
    // target lock (the empty body's convert card): a miss makes the next shot critical
    if (rank(u, 'targetLock') && isGun(u)) { u.nextCrit = true; if (rank(u, 'targetLock') >= 2) u.critShots = Math.max(u.critShots ?? 0, 1); ev.push({ t, type: 'buff', src: u.id, dst: u.id, text: '표적 분석' }); }
    return;
  }
  u.attackMult = 1; emit(p,'beforeHit',{t,src:u,target,ev});
  let forced = !!u.nextCrit; if (!forced && (u.critShots ?? 0) > 0) { forced = true; u.critShots!--; }
  const crit = !u.traits?.avatar && (forced || p.s.rng.chance(0.05 + T.crit(u) + (weaponDef(u)?.family==='dagger'?.05:0))); u.nextCrit=false;
  let m = mult * (u.attackMult ?? 1) * (crit ? T.critDmg(u) : 1) * traitMult(p,u,target,t) * statusMult(p, u, target, !!weaponDef(u)?.twoHand || u.weapon === 'greataxe' || u.weapon === 'crossbow', t, ev);
  if (u.side === 'hero') {
    m *= levelDmg(u) * (u.shield > 0 && shieldedFury(p) ? 1.2 : 1);
    const empowerment = basic || !u.echoPending || u.empower > 2 ? u.empower : 1;
    m *= passiveMult(p, u, target, t, ev) * empowerment;
    if (empowerment > 1) {
      u.empower = !basic && u.echoPending ? 2 : 1; u.hiddenUntil = 0;
      if (basic) u.echoPending = false;
    }
    // bond: each ally close by (a lone body's own minions and clones), multiplied
    const near = p.units.filter((x) => x.side === 'hero' && x !== u && alive(p, x) && dist(posOf(p, x), e.pos) <= 2).length;
    m *= (1 + T.bond(u)) ** near;
  }
  if (target.side === 'hero' && st.range > 1 && behindCover(p, e.pos, te.pos)) m *= T.coverTaken(target);
  if(!alive(p,u))return;
  const hp = te.hp;
  const flat = u.nextFlat ?? 0; u.nextFlat = 0;
  // hits in a row with the gun (the empty body's cards read it)
  if (basic && isGun(u)) u.hitStreak = (u.hitStreak ?? 0) + 1;
  damage(p, t, u.id, target, Math.round(roll(p, st.dmg) * m) + flat, ev, false, true, 'physical', true);
  if (t < (u.leechUntil ?? 0)) heal(p,u,u,(hp-te.hp)*0.3,t,ev);
  emit(p, 'hit', { t, src: u, target, amount: hp - te.hp, basic, ev }); if (crit) emit(p, 'crit', { t, src: u, target, amount: hp - te.hp, basic, ev });
  if (!alive(p, u)) return;
  if(!alive(p,u))return;
  const d=weaponDef(u);
  const w = u.gear ? (d?.family==='staff'?{splash:true,cleave:false,stun:0}:undefined) : u.weapon ? WEAPONS[u.weapon] : undefined;
  if (w?.cleave || w?.splash) {
    const around = w.cleave ? e.pos : te.pos;
    for (const f of p.units) if (f.side !== u.side && f !== target && alive(p, f) && dist(posOf(p, f), around) === 1) damage(p, t, u.id, f, Math.round(roll(p, st.dmg) / 2), ev);
  }
  // a stunning weapon stuns on every nth blow that lands (no dice: `stun` is the share of blows, 0.2 = every fifth)
  if (w?.stun && te.alive) { const tally = (u.tally ??= {}), n = (tally['무기 기절'] = (tally['무기 기절'] ?? 0) + 1); if (n % Math.round(1 / w.stun) === 0) target.nextAt = Math.max(target.nextAt, t + 1.2); }
  // a warrior struck in melee sometimes strikes straight back

}
