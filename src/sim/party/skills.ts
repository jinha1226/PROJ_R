import type { Cell, GEvent } from '../grid/types';
import { dist } from '../grid/types';
import { addShield } from './shield';
import { applyStatus } from './status';
import { foesNear, fighting } from './cardFx';
import { summon } from './kitEffects';
import { alive, damage, posOf, stats, type DamageKind, type Party, type Unit } from './partyCore';
import type { Cond, Ctx, TriggerDef } from './triggers';

/**
 * `?skill`: a build of skills in place of the level-up cards, to try beside them (2026-10-10). A clone has six places, each
 * answering one thing it does in a fight — the hand a blow that lands, the heart a kill, the body a blow taken, the eye a blow
 * dodged, the foot a step, the head a wait — and holds one skill in each. A skill is a school (what shape the effect takes)
 * and an element (what it leaves on those it touches), and has four steps. Each level is a point: a new skill in an empty
 * place, or a step up for one held. Everything goes off by itself; nothing here is left to chance.
 */
export const SKILLS = { on: false };

export const SLOTS = ['hand', 'heart', 'body', 'eye', 'foot', 'head'] as const;
export const SCHOOLS = ['forge', 'emit', 'bind', 'make'] as const;
export const ELEMENTS = ['none', 'fire', 'water', 'wood'] as const;
export type Slot = typeof SLOTS[number];
export type School = typeof SCHOOLS[number];
export type Element = typeof ELEMENTS[number];
export interface Skill { school: School; el: Element; lv: number }
export const MAX_SKILL = 4;

export const SLOT_NAME: Record<Slot, string> = { hand: '손', heart: '심장', body: '몸', eye: '눈', foot: '발', head: '머리' };
export const SCHOOL_NAME: Record<School, string> = { forge: '강화', emit: '방출', bind: '조작', make: '구현' };
export const EL_NAME: Record<Element, string> = { none: '없음', fire: '화', water: '수', wood: '목' };

/** when a place answers, how hard (a thing that happens often is weaker), and how often it may */
const PLACE: Record<Slot, { when: Cond; mult: number; every?: number; cd?: number; says: string }> = {
  hand: { when: 'hit', mult: 1, every: 3, says: '세 번째 적중마다' },
  heart: { when: 'kill', mult: 1.2, says: '처치하면' },
  body: { when: 'struck', mult: 1, cd: 1, says: '맞으면' },
  eye: { when: 'dodge', mult: 1.5, says: '피하면' },
  foot: { when: 'moved', mult: 0.6, every: 2, says: '싸우는 중 두 걸음마다' },
  head: { when: 'wait', mult: 1.5, says: '싸우는 중 대기하면' },
};
/** a step's strength (index: the step) */
const STEP = [0, 1, 1.4, 1.8, 2.4];
const KIND: Record<Element, DamageKind> = { none: 'physical', fire: 'fire', water: 'cold', wood: 'poison' };
/** a skill with no element is that much stronger: the plain choice is not a loss */
const PLAIN = 1.3;

export const skillsOf = (u: Unit): Partial<Record<Slot, Skill>> => u.skills ?? {};
const spent = (u: Unit): number => SLOTS.reduce((n, s) => n + (skillsOf(u)[s]?.lv ?? 0), 0);
/** points a clone has to spend: one a level, less the steps it has taken */
export const pointsLeft = (u: Unit): number => (SKILLS.on && u.side === 'hero' && !u.summoner && u.cls ? Math.max(0, (u.level ?? 1) - spent(u)) : 0);
/** the name an effect of a skill is told under (the log, the strip along the bottom) */
export const skillName = (slot: Slot, s: Skill): string => `${SLOT_NAME[slot]} ${SCHOOL_NAME[s.school]}${s.el === 'none' ? '' : `·${EL_NAME[s.el]}`}`;

/** A new skill in an empty place, for a point. */
export function learn(p: Party, id: string, slot: Slot, school: School, el: Element): boolean {
  const u = p.units.find((x) => x.id === id);
  if (!u || pointsLeft(u) < 1 || skillsOf(u)[slot]) return false;
  u.skills = { ...skillsOf(u), [slot]: { school, el, lv: 1 } };
  return true;
}
/** A held skill a step up, for a point. */
export function raise(p: Party, id: string, slot: Slot): boolean {
  const u = p.units.find((x) => x.id === id), s = u && skillsOf(u)[slot];
  if (!u || !s || pointsLeft(u) < 1 || s.lv >= MAX_SKILL) return false;
  u.skills = { ...skillsOf(u), [slot]: { ...s, lv: s.lv + 1 } };
  return true;
}

const power = (slot: Slot, s: Skill): number => STEP[s.lv]! * PLACE[slot].mult * (s.el === 'none' ? PLAIN : 1);
const shots = (s: Skill): number => (s.lv >= 3 ? 2 : 1);
const cap = (s: Skill): number => (s.lv >= 3 ? 3 : 2);

/** What a skill does, in a line (the same numbers the effect uses). */
export function skillLine(slot: Slot, s: Skill, u?: Unit, p?: Party): string {
  const k = power(slot, s), hit = u ? avgHit(u, p) : 0;
  const what = s.school === 'forge' ? `보호막 ${Math.round(5 * k)}`
    : s.school === 'emit' ? `가까운 적 ${shots(s)}명에게 탄${hit ? ` (피해 ${Math.round(hit * 0.7 * k)})` : ''}`
      : s.school === 'bind' ? `가까운 적 ${shots(s)}명을 묶는다`
        : `하수인을 세운다 (최대 ${cap(s)}, 체력 ${Math.round(12 + 8 * k)})`;
  const leaves = s.el === 'fire' ? ' · 닿은 적과 그 옆이 불탄다' : s.el === 'water' ? ' · 닿은 적이 느려지고, 느려진 적은 언다' : s.el === 'wood' ? ' · 닿은 적이 중독되고 그 자리에 독이 남는다' : '';
  return `${PLACE[slot].says} ${what}${leaves}`;
}

const avgHit = (u: Unit, p?: Party, t = 0): number => { const [lo, hi] = stats(u, t, p).dmg; return (lo + hi) / 2; };
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
  const me = posOf(p, c.src), k = power(slot, s);
  // the one this is about: the foe struck, or the one that struck; a kill leaves only the place it fell
  const foe = c.target && c.target.side !== c.src.side && alive(p, c.target) ? c.target : undefined;
  const at = c.target ? { ...posOf(p, c.target) } : { ...me };
  const pick = (r: number, n: number): Unit[] => [...(foe ? [foe] : []), ...awake(p, at, r, foe ? [foe] : [])].slice(0, n);
  let touched: Unit[] = [];
  if (s.school === 'forge') { addShield(c.src, Math.round(5 * k), c.src); touched = pick(1, 1); }
  if (s.school === 'emit') {
    touched = pick(6, shots(s));
    for (const f of touched) {
      c.ev.push({ t: c.t, type: 'shoot', src: c.src.id, dst: f.id, from: { ...me }, to: { ...posOf(p, f) }, text: 'chain' });
      damage(p, c.t, c.src.id, f, Math.max(1, Math.round(avgHit(c.src, p, c.t) * 0.7 * k)), c.ev, true, false, KIND[s.el]);
    }
  }
  if (s.school === 'bind') { touched = pick(3, shots(s)); for (const f of touched) applyStatus(p, c.src, f, 'stun', c.t, c.ev); }
  if (s.school === 'make') { summon(p, c.src, at, c.t, c.ev, cap(s), { hp: Math.round(12 + 8 * k), here: slot === 'heart' }); touched = pick(1, 1); }
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
