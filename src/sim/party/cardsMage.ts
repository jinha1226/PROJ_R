import { applyStatus, type StatusId } from './status';
import { alive, damage, entOf, occupied, posOf, stats, type DamageKind, type Party, type Unit } from './partyCore';
import { foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { card, inBranch, rank, type TraitDef } from './traitTypes';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import type { TriggerDef } from './triggers';

const ELEMENTS: StatusId[] = ['burn', 'chill', 'shock'];
const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return (lo + hi) / 2; };
const on = (u: Unit, id: StatusId, t: number) => (u.status[id]?.until ?? 0) > t;
const FIRE = 'mage:fire', COLD = 'mage:cold', BOLT = 'mage:lightning';

/** The mage's innates (C3 spec §3.2): every blow lays the next element in turn; a frozen foe takes double and thaws. */
export const MAGE_INNATE: TriggerDef[] = [
  { id: '원소 순환', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => {
    const i = c.src.cycle ?? 0; c.src.cycle = i + 1;
    applyStatus(p, c.src, c.target!, ELEMENTS[i % 3]!, c.t, c.ev);
  } },
  { id: '파쇄', when: 'beforeHit', test: (_p, c) => (c.target?.status.freeze?.until ?? 0) > c.t, run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 2; if (c.target) delete c.target.status.freeze; } },
];

/** the element the mage's next blow lays (teleport bursts and the AI read it) */
export const nextElement = (u: Unit): StatusId => ELEMENTS[(u.cycle ?? 0) % 3]!;

/** Mage masteries: fire, lightning and (on frozen foes) cold damage grow with every tag of the element (multiplied). */
export function elementAmp(attacker: Unit, dst: Unit, kind: DamageKind, t: number): number {
  const tags = tagsOf(attacker);
  let m = 1;
  if (kind === 'fire' && rank(attacker, 'fireAmp')) m *= 1.15 ** (tags.화염 ?? 0);
  if (kind === 'lightning' && rank(attacker, 'boltAmp')) m *= 1.15 ** (tags.전기 ?? 0);
  if (on(dst, 'freeze', t) && rank(attacker, 'coldAmp')) m *= 1.12 ** (tags.냉기 ?? 0);
  return m;
}

/** A meteor on a foe: fire damage and a burn round it; each kill it makes drops another on the next burning foe (bounded). */
function meteor(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], ground: boolean, more = 3): void {
  const at = { ...posOf(p, target) }, amount = Math.round(avg(p, u, t) * 1.5);
  let kills = 0;
  for (const f of foesNear(p, at, 1)) {
    damage(p, t, u.id, f, amount, ev, true, false, 'fire');
    if (alive(p, f)) applyStatus(p, u, f, 'burn', t, ev); else kills++;
  }
  if (ground) (p.grounds ??= []).push({ at, by: u.id, until: t + 2, next: t + 1 });
  for (let k = 0; k < kills && more > 0; k++, more--) {
    const next = burning(p, u, t);
    if (next) meteor(p, u, next, t, ev, ground, more - 1);
  }
}
/** the nearest burning foe within eight cells */
const burning = (p: Party, u: Unit, t: number): Unit | undefined =>
  foesNear(p, posOf(p, u), 8).filter((f) => on(f, 'burn', t)).sort((a, b) => dist(posOf(p, a), posOf(p, u)) - dist(posOf(p, b), posOf(p, u)))[0];

/** Lightning leaps from a foe to the nearest unhit foe, `jumps` times: lightning damage and shock on each. */
function leap(p: Party, u: Unit, from: Unit, jumps: number, t: number, ev: GEvent[]): void {
  const hit = new Set<Unit>([from]);
  let at = from;
  for (let k = 0; k < jumps; k++) {
    const next = foesNear(p, posOf(p, at), 3).filter((f) => !hit.has(f)).sort((a, b) => dist(posOf(p, a), posOf(p, at)) - dist(posOf(p, b), posOf(p, at)))[0];
    if (!next) break;
    hit.add(next); ev.push({ t, type: 'shoot', src: at.id, dst: next.id, from: { ...posOf(p, at) }, to: { ...posOf(p, next) }, text: 'bolt' });
    damage(p, t, u.id, next, Math.round(avg(p, u, t) * 0.8), ev, true, false, 'lightning');
    if (alive(p, next)) applyStatus(p, u, next, 'shock', t, ev);
    at = next;
  }
}

/** Teleport (the mage's aimed ultimate): to a free floor cell within eight, both ends bursting with the next element. */
export function teleport(p: Party, u: Unit, cell: Cell, t: number, ev: GEvent[]): boolean {
  const from = { ...posOf(p, u) };
  if (!walkable(tileAt(p.s.map, cell)) || occupied(p, cell, u.id) || dist(from, cell) > 8) return false;
  const element = nextElement(u), kind: DamageKind = element === 'burn' ? 'fire' : element === 'chill' ? 'cold' : 'lightning';
  const burst = (at: Cell) => { for (const f of foesNear(p, at, 1)) { damage(p, t, u.id, f, Math.round(avg(p, u, t) * 1.2), ev, true, false, kind); if (alive(p, f)) applyStatus(p, u, f, element, t, ev); } };
  burst(from);
  ev.push({ t, type: 'teleport', src: u.id, from, to: { ...cell } });
  entOf(p, u.id)!.pos = { ...cell };
  burst(cell);
  return true;
}

export const MAGE_CARDS: TraitDef[] = [
  // 화염: meteors keep falling while anything burns
  inBranch(card('meteor', '운석', 'law', ['화염'], 'mage', '화상 걸린 적이 있으면 매 턴 운석(반경 1 화염 피해·화상), 운석으로 처치하면 하나 더', {
    trigger: (r) => ({ id: '운석', when: 'turn', test: (p, c) => !!burning(p, c.src, c.t), run: (p, c) => {
      for (let k = 0; k < (r >= 2 ? 2 : 1); k++) { const f = burning(p, c.src, c.t); if (f) meteor(p, c.src, f, c.t, c.ev, r >= 2); }
    } }),
  }, '매 턴 2개, 떨어진 자리 2턴 불바다'), FIRE, true),
  inBranch(card('fireball', '화염구', 'law', ['화염'], 'mage', '세 번째 공격마다 화염구(대상 주변 1칸 화염 피해·화상)', {
    trigger: (r) => ({ id: '화염구', when: 'hit', test: (_p, c) => !!c.target && !!c.basic && c.src.nth % (r >= 2 ? 2 : 3) === 0, run: (p, c) => {
      for (const f of foesNear(p, posOf(p, c.target!), 1)) { damage(p, c.t, c.src.id, f, Math.round(avg(p, c.src, c.t)), c.ev, true, false, 'fire'); if (alive(p, f)) applyStatus(p, c.src, f, 'burn', c.t, c.ev); }
    } }),
  }, '두 번째 공격마다'), FIRE),
  inBranch(card('fireSpread', '화염 전이', 'convert', ['화염'], 'mage', '화염 피해로 처치 → 주변 1칸 적 화상 2중첩', {
    trigger: () => ({ id: '화염 전이', when: 'kill', test: (_p, c) => c.kind === 'fire' && !!c.target, run: (p, c) => { for (const f of foesNear(p, posOf(p, c.target!), 1)) applyStatus(p, c.src, f, 'burn', c.t, c.ev, 2, true); } }),
  }), FIRE),
  inBranch(card('fireAmp', '화염 숙련', 'amp', ['화염'], 'mage', '#화염 1당 화염 피해 ×1.15 (곱)', {}), FIRE),
  // 냉기: a blizzard that keeps falling while the mage holds its ground
  inBranch(card('blizzard', '블리자드', 'law', ['냉기'], 'mage', '2턴 동안 2칸 안에 머물면 주변 2칸에 눈보라가 계속 내림(매 턴 냉기·냉기 피해), 3칸 넘게 움직이면 그침', {
    trigger: (r) => ({ id: '블리자드', when: 'turn', test: (p, c) => {
      const me = posOf(p, c.src);
      if (!c.src.anchor || (r < 2 && dist(me, c.src.anchor) > 2)) { c.src.anchor = { ...me }; c.src.anchorAt = c.t; return false; }
      if (r >= 2) c.src.anchor = { ...me };
      return c.t - (c.src.anchorAt ?? c.t) >= 2;
    }, run: (p, c) => {
      for (const f of foesNear(p, posOf(p, c.src), r >= 2 ? 3 : 2)) { damage(p, c.t, c.src.id, f, Math.round(avg(p, c.src, c.t) * 0.6), c.ev, true, false, 'cold'); if (alive(p, f)) applyStatus(p, c.src, f, 'chill', c.t, c.ev); }
    } }),
  }, '눈보라가 나를 따라오고 범위 3칸'), COLD, true),
  inBranch(card('frostRing', '서리 고리', 'law', ['냉기'], 'mage', '피격 또는 처치 → 주변 2칸 냉기, 붙은 적 1칸 밀침 (턴당 1회)', {
    triggers: (r) => (['struck', 'kill'] as const).map((when): TriggerDef => ({ id: '서리 고리', when, cd: 1, run: (p, c) => {
      const me = posOf(p, c.src);
      for (const f of foesNear(p, me, 2)) {
        if (!alive(p, f)) continue;
        applyStatus(p, c.src, f, r >= 2 ? 'freeze' : 'chill', c.t, c.ev);
        const at = posOf(p, f);
        if (dist(at, me) !== 1) continue;
        const to = { x: at.x + Math.sign(at.x - me.x), y: at.y + Math.sign(at.y - me.y) };
        if (walkable(tileAt(p.s.map, to)) && !occupied(p, to, f.id)) { c.ev.push({ t: c.t, type: 'push', src: f.id, from: { ...at }, to: { ...to } }); entOf(p, f.id)!.pos = to; }
      }
    } })),
  }, '냉기 대신 빙결'), COLD),
  inBranch(card('frostPrison', '서리 감옥', 'convert', ['냉기'], 'mage', '냉기 두 번 → 빙결', {
    triggers: (r) => [
      { id: '서리 감옥', when: 'statusApplied', test: (_p, c) => c.status === 'chill' && !!c.target, run: (p, c) => {
        const t = c.target!; t.chillHits = (t.chillHits ?? 0) + 1;
        if (t.chillHits < 2) return;
        t.chillHits = 0; applyStatus(p, c.src, t, 'freeze', c.t, c.ev);
      } },
      ...(r >= 2 ? [{ id: '얼음 파편', when: 'kill', repeat: true, test: (_p, c) => !!c.target && on(c.target, 'freeze', c.t), run: (p, c) => { for (const f of foesNear(p, posOf(p, c.target!), 2)) applyStatus(p, c.src, f, 'chill', c.t, c.ev, 1, true); } } satisfies TriggerDef] : []),
    ],
  }, '빙결된 적이 죽으면 사방 2칸 냉기'), COLD),
  inBranch(card('coldAmp', '냉기 숙련', 'amp', ['냉기'], 'mage', '#냉기 1당 빙결된 적이 받는 피해 ×1.12 (곱)', {}), COLD),
  // 번개: lightning that leaps every turn while anything is shocked
  inBranch(card('chainLightning', '연쇄 번개', 'law', ['전기'], 'mage', '감전된 적이 있으면 매 턴 번개가 적 사이 3번 튐(번개 피해·감전), 치명마다 한 번 더', {
    triggers: (r) => [
      { id: '연쇄 번개', when: 'turn', test: (p, c) => foesNear(p, posOf(p, c.src), 8).some((f) => on(f, 'shock', c.t)), run: (p, c) => {
        const from = foesNear(p, posOf(p, c.src), 8).find((f) => on(f, 'shock', c.t))!;
        leap(p, c.src, from, r >= 2 ? 5 : 3, c.t, c.ev);
      } },
      { id: '연쇄 번개', when: 'crit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => leap(p, c.src, c.target!, r >= 2 ? 5 : 3, c.t, c.ev) },
    ],
  }, '5번 튐'), BOLT, true),
  inBranch(card('staticField', '정전기장', 'law', ['전기'], 'mage', '적중 → 3칸 안 모든 적에게 현재 체력 8% 번개 피해 (턴당 1회)', {
    trigger: (r) => ({ id: '정전기장', when: 'hit', cd: 1, run: (p, c) => {
      for (const f of foesNear(p, posOf(p, c.src), 3)) damage(p, c.t, c.src.id, f, Math.max(1, Math.round(entOf(p, f.id)!.hp * (r >= 2 ? 0.12 : 0.08))), c.ev, true, false, 'lightning');
    } }),
  }, '12%'), BOLT),
  inBranch(card('overcurrent', '과전류', 'convert', ['전기'], 'mage', '감전된 적이 맞음 → 감전이 옆 적으로 옮겨감', {
    trigger: () => ({ id: '과전류', when: 'hit', repeat: true, test: (_p, c) => !!c.target && on(c.target, 'shock', c.t), run: (p, c) => {
      const next = foesNear(p, posOf(p, c.target!), 1).find((f) => f !== c.target && !on(f, 'shock', c.t));
      if (next) applyStatus(p, c.src, next, 'shock', c.t, c.ev, 1, true);
    } }),
  }), BOLT),
  inBranch(card('boltAmp', '번개 숙련', 'amp', ['전기'], 'mage', '#전기 1당 번개 피해 ×1.15 (곱)', {}), BOLT),
];
