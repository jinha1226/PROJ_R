import type { Cell, GEvent } from '../grid/types';
import { dist } from '../grid/types';
import { applyStatus } from './status';
import { foesNear, fighting } from './cardFx';
import { alive, damage, posOf, stats, type DamageKind, type Party, type Unit } from './partyCore';
import type { Cond, Ctx, TriggerDef } from './triggers';

/**
 * `?skill`: a build of skills in place of the level-up cards, to try beside them (2026-10-10). A clone has six places, each
 * answering one thing it does in a fight — the hand a blow that lands, the heart a kill, the body a blow taken, the eye a blow
 * dodged, the foot a step, the head a wait. What a place does is its own and always a blow of some kind, so no build goes
 * quiet; the choice is which element to lay in it (what the blow leaves on those it touches), and it has four steps. Each
 * level is a point: an element in an empty place, or a step up for one held. Everything goes off by itself; nothing is left
 * to chance. (Schools — shield, shot, bind, helper — were tried the same day and dropped: what each did in each place was
 * not plain at a glance.)
 */
export const SKILLS = { on: false };

export const SLOTS = ['hand', 'heart', 'body', 'eye', 'foot', 'head'] as const;
export const ELEMENTS = ['none', 'fire', 'water', 'wood'] as const;
export type Slot = typeof SLOTS[number];
export type Element = typeof ELEMENTS[number];
export interface Skill { el: Element; lv: number }
export const MAX_SKILL = 4;

export const SLOT_NAME: Record<Slot, string> = { hand: '손', heart: '심장', body: '몸', eye: '눈', foot: '발', head: '머리' };
export const EL_NAME: Record<Element, string> = { none: '없음', fire: '화', water: '수', wood: '목' };
const EL_SHORT: Record<Element, string> = { none: '무', fire: '화', water: '수', wood: '목' };

/** when a place answers, how hard its blow is against the clone's own (a thing that happens often is weaker), how often it may, and how far it reaches */
const PLACE: Record<Slot, { when: Cond; hit: number; every?: number; cd?: number; reach: number; says: (r: number) => string }> = {
  hand: { when: 'hit', hit: 0.8, every: 3, reach: 0, says: () => '세 번째 적중마다 한 대 더 들어간다' },
  heart: { when: 'kill', hit: 0.7, reach: 1, says: (r) => `처치하면 그 자리 주변 ${r}칸이 터진다` },
  body: { when: 'struck', hit: 0.6, cd: 1, reach: 0, says: () => '맞으면 때린 적에게 되돌려 준다' },
  eye: { when: 'dodge', hit: 1.2, reach: 0, says: () => '피하면 빗나간 적을 받아친다' },
  foot: { when: 'moved', hit: 0.5, every: 2, reach: 1, says: () => '싸우는 중 두 걸음마다, 지나가며 옆의 적을 친다' },
  head: { when: 'wait', hit: 1, reach: 2, says: (r) => `싸우는 중 대기하면 주변 ${r}칸에 터뜨린다` },
};
/** a step's strength (index: the step) */
const STEP = [0, 1, 1.4, 1.8, 2.4];
const KIND: Record<Element, DamageKind> = { none: 'physical', fire: 'fire', water: 'cold', wood: 'poison' };
/** a place with no element hits that much harder: the plain choice is not a loss */
const PLAIN = 1.3;

export const skillsOf = (u: Unit): Partial<Record<Slot, Skill>> => u.skills ?? {};
const spent = (u: Unit): number => SLOTS.reduce((n, s) => n + (skillsOf(u)[s]?.lv ?? 0), 0);
/** points a clone has to spend: one a level, less the steps it has taken */
export const pointsLeft = (u: Unit): number => (SKILLS.on && u.side === 'hero' && !u.summoner && u.cls ? Math.max(0, (u.level ?? 1) - spent(u)) : 0);
/** the name an effect of a skill is told under (the log, the strip along the bottom) */
export const skillName = (slot: Slot, s: Skill): string => `${SLOT_NAME[slot]}·${EL_SHORT[s.el]}`;

/** An element laid in an empty place, for a point. */
export function learn(p: Party, id: string, slot: Slot, el: Element): boolean {
  const u = p.units.find((x) => x.id === id);
  if (!u || pointsLeft(u) < 1 || skillsOf(u)[slot]) return false;
  u.skills = { ...skillsOf(u), [slot]: { el, lv: 1 } };
  return true;
}
/** A held skill a step up, for a point. */
export function raise(p: Party, id: string, slot: Slot): boolean {
  const u = p.units.find((x) => x.id === id), s = u && skillsOf(u)[slot];
  if (!u || !s || pointsLeft(u) < 1 || s.lv >= MAX_SKILL) return false;
  u.skills = { ...skillsOf(u), [slot]: { ...s, lv: s.lv + 1 } };
  return true;
}

const power = (slot: Slot, s: Skill): number => STEP[s.lv]! * PLACE[slot].hit * (s.el === 'none' ? PLAIN : 1);
/** the heart's and the head's bursts widen a cell from the third step */
const reach = (slot: Slot, s: Skill): number => PLACE[slot].reach + ((slot === 'heart' || slot === 'head') && s.lv >= 3 ? 1 : 0);
const avgHit = (u: Unit, p?: Party, t = 0): number => { const [lo, hi] = stats(u, t, p).dmg; return (lo + hi) / 2; };
const amount = (slot: Slot, s: Skill, u: Unit, p?: Party, t = 0): number => Math.max(1, Math.round(avgHit(u, p, t) * power(slot, s)));

/** What a skill does, in a line (the same numbers the effect uses). */
export function skillLine(slot: Slot, s: Skill, u?: Unit, p?: Party): string {
  const leaves = s.el === 'fire' ? ' · 닿은 적과 그 옆이 불탄다' : s.el === 'water' ? ' · 닿은 적이 느려지고, 느려진 적은 언다' : s.el === 'wood' ? ' · 닿은 적이 중독되고 그 자리에 독이 남는다' : '';
  return `${PLACE[slot].says(reach(slot, s))}${u ? ` (피해 ${amount(slot, s, u, p)})` : ''}${leaves}`;
}

const awake = (p: Party, at: Cell, r: number, not: Unit[] = []): Unit[] =>
  foesNear(p, at, r).filter((f) => alive(p, f) && !f.asleep && !not.includes(f)).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at));

/** What an element leaves on those a skill touched. */
function leave(p: Party, src: Unit, el: Element, touched: Unit[], t: number, ev: GEvent[]): void {
  for (const f of touched) {
    if (!alive(p, f)) continue;
    if (el === 'fire') { for (const g of [f, ...awake(p, posOf(p, f), 1, [f])]) if (alive(p, g)) applyStatus(p, src, g, 'burn', t, ev); }
    if (el === 'water') applyStatus(p, src, f, (f.status.chill?.until ?? 0) > t ? 'freeze' : 'chill', t, ev);
    if (el === 'wood') {
      applyStatus(p, src, f, 'poison', t, ev, 2);
      const at = { ...posOf(p, f) }, mine = (p.grounds ?? []).find((g) => g.by === src.id && g.kind === 'poison' && dist(g.at, at) <= 1);
      if (mine) mine.until = Math.max(mine.until, t + 2); else (p.grounds ??= []).push({ at, by: src.id, until: t + 2, next: t + 1, kind: 'poison', r: 1 });
    }
  }
}

function run(p: Party, c: Ctx, slot: Slot, s: Skill): void {
  const me = posOf(p, c.src), r = reach(slot, s);
  // the hand, the body and the eye answer one foe (the one struck, or the one that struck); the rest answer a place
  const one = c.target && c.target.side !== c.src.side && alive(p, c.target) ? c.target : undefined;
  const touched = slot === 'heart' ? awake(p, c.target ? posOf(p, c.target) : me, r) : slot === 'foot' || slot === 'head' ? awake(p, me, r) : one ? [one] : [];
  for (const f of touched) damage(p, c.t, c.src.id, f, amount(slot, s, c.src, p, c.t), c.ev, true, false, KIND[s.el]);
  leave(p, c.src, s.el, touched, c.t, c.ev);
}

/** The effects a clone's skills add to what it does (none while the switch is off). */
export function skillTriggers(u: Unit): TriggerDef[] {
  if (!SKILLS.on || !u.skills) return [];
  return SLOTS.flatMap((slot): TriggerDef[] => {
    const s = u.skills![slot], place = PLACE[slot];
    if (!s) return [];
    return [{
      id: skillName(slot, s), when: place.when, every: place.every, cd: place.cd,
      test: (p, c) => (slot !== 'hand' || !!c.basic) && (slot === 'foot' || slot === 'head' ? fighting(p, c.src) : true),
      run: (p, c) => run(p, c, slot, s),
    }];
  });
}
