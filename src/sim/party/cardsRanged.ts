import { applyStatus, type StatusId } from './status';
import { alive, damage, entOf, posOf, stats, strike, type Party, type Unit } from './partyCore';
import { foesNear } from './cardFx';
import { addShield } from './shield';
import { tagsOf } from './classKit';
import { card, rank, type TraitDef } from './traitTypes';
import { dist, inBounds } from '../grid/types';
import type { TriggerDef as TriggerDef_ } from './triggers';

/** an upgrade's extra trigger, typed */
const tr = (d: TriggerDef_): TriggerDef_ => d;
const ranged = (p: Party, u: Unit) => stats(u, 0, p).range > 1;
const marked = (u: Unit | undefined, t: number) => !!u && (u.status.mark?.until ?? 0) > t;
const ELEMENTS: StatusId[] = ['burn', 'chill', 'shock'];

/** How much more a marked foe takes from this attacker (the hunter's eye card adds by the attacker's ranged tags). */
export const markMult = (attacker: Unit | undefined): number => 1.3 + (attacker && rank(attacker, 'hunterEye') ? 0.1 * (tagsOf(attacker).원거리 ?? 0) : 0);

/** The foes on the straight line from the shooter on past the target, nearest first (within the bow's reach). */
function beyond(p: Party, u: Unit, target: Unit): Unit[] {
  const from = posOf(p, u), to = posOf(p, target), dx = to.x - from.x, dy = to.y - from.y, n = Math.max(Math.abs(dx), Math.abs(dy)) || 1, reach = stats(u, 0, p).range;
  const out: Unit[] = [];
  for (let k = n + 1; k <= reach + n; k++) {
    const c = { x: from.x + Math.round((dx * k) / n), y: from.y + Math.round((dy * k) / n) };
    if (!inBounds(p.s.map, c)) break;
    const f = p.units.find((x) => x.side === 'foe' && alive(p, x) && posOf(p, x).x === c.x && posOf(p, x).y === c.y);
    if (f) out.push(f);
  }
  return out;
}

/** The archer's cards (spec §6.3): marks, and what a mark sets off. */
const ARCHER: TraitDef[] = [
  card('huntMark', '사냥 표식', 'law', ['원거리'], 'archer', '전투 첫 사격 → 표식', {
    triggers: (r) => [
      { id: '사냥 표식 준비', when: 'combatStart', run: (_p, c) => { c.src.markFirst = true; } },
      { id: '사냥 표식', when: 'beforeHit', test: (p, c) => !!c.src.markFirst && !!c.target && ranged(p, c.src), run: (p, c) => { c.src.markFirst = false; applyStatus(p, c.src, c.target!, 'mark', c.t, c.ev); } },
      ...(r >= 2 ? [tr({ id: '표식 이동', when: 'kill', test: (_p, c) => marked(c.target, c.t), run: (p, c) => {
        const at = posOf(p, c.target!), next = p.units.filter((f) => f.side === 'foe' && alive(p, f)).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at))[0];
        if (next) applyStatus(p, c.src, next, 'mark', c.t, c.ev);
      } })] : []),
    ],
  }, '표식된 적이 죽으면 가장 가까운 적에게 표식 이동'),
  card('pierce', '관통 화살', 'law', ['원거리'], 'archer', '사격 → 뒤의 적 1명 관통', {
    trigger: (r) => ({ id: '관통 화살', when: 'hit', test: (p, c) => !!c.target && ranged(p, c.src), run: (p, c) => {
      const [lo, hi] = stats(c.src, c.t, p).dmg, hit = beyond(p, c.src, c.target!);
      for (const f of r >= 2 ? hit : hit.slice(0, 1)) damage(p, c.t, c.src.id, f, Math.round((lo + hi) / 2), c.ev, true);
    } }),
  }, '직선 위 모든 적'),
  card('rapidFire', '연속 사격', 'law', ['원거리'], 'archer', '표식된 적 사격 25% → 한 발 더', {
    trigger: (r) => ({ id: '연속 사격', when: 'hit', chance: r >= 2 ? 0.4 : 0.25, test: (p, c) => marked(c.target, c.t) && alive(p, c.target!) && ranged(p, c.src), run: (p, c) => strike(p, c.src, c.target!, c.t, c.ev, 1, false) }),
  }, '40%'),
  card('poisonArrow', '독화살', 'law', ['독'], 'archer', '표식된 적 적중 → 중독 2', {
    triggers: (r) => [
      { id: '독화살', when: 'hit', test: (p, c) => marked(c.target, c.t) && alive(p, c.target!), run: (p, c) => applyStatus(p, c.src, c.target!, 'poison', c.t, c.ev, 2) },
      ...(r >= 2 ? [tr({ id: '독 표식', when: 'statusApplied', test: (_p, c) => c.status === 'mark' && !!c.target, run: (p, c) => applyStatus(p, c.src, c.target!, 'poison', c.t, c.ev, 2) })] : []),
    ],
  }, '표식을 걸 때도 중독 2'),
  card('spikeTrap', '가시 덫', 'law', ['출혈'], 'archer', '대기 → 붙은 적 출혈 + 1턴 묶임', {
    trigger: (r) => ({ id: '가시 덫', when: 'wait', run: (p, c) => { for (const f of foesNear(p, posOf(p, c.src), r >= 2 ? 2 : 1)) { applyStatus(p, c.src, f, 'bleed', c.t, c.ev); applyStatus(p, c.src, f, 'stun', c.t, c.ev); } } }),
  }, '2칸'),
  card('rollShot', '구르며 쏘기', 'convert', ['생존'], 'archer', '적이 붙어 물러난 뒤 사격 → 치명', {
    trigger: () => ({ id: '구르며 쏘기', when: 'beforeHit', test: (_p, c) => !!c.src.retreatShot, run: (_p, c) => { c.src.nextCrit = true; } }),
  }),
  card('focusFire', '집중 사격', 'amp', ['치명'], 'archer', '제자리 연속 사격마다 치명 +10% (최대 +40%)', { passive: (u) => ({ crit: 0.1 * Math.min(4, u.still) }) }),
  card('hunterEye', '사냥꾼의 눈', 'amp', ['원거리'], 'archer', '#원거리 1당 표식 피해 +10%p', {}),
];

/** The mage's cards (spec §6.4): elements, and what they make when they meet. */
const MAGE: TraitDef[] = [
  card('elemCycle', '원소 순환', 'law', ['화염', '냉기', '전기'], 'mage', '적중마다 화상 → 냉기 → 감전 순서로 부여', {
    trigger: (r) => ({ id: '원소 순환', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => {
      const i = c.src.cycle ?? 0; c.src.cycle = i + 1;
      applyStatus(p, c.src, c.target!, ELEMENTS[i % 3]!, c.t, c.ev);
      if (r >= 2 && alive(p, c.target!)) applyStatus(p, c.src, c.target!, ELEMENTS[(i + 1) % 3]!, c.t, c.ev);
    } }),
  }, '두 원소씩'),
  card('chainReact', '연쇄 반응', 'law', ['전기'], 'mage', '반응 → 주변 1칸 적에게 같은 원소', {
    trigger: (r) => ({ id: '연쇄 반응', when: 'reaction', test: (_p, c) => !!c.target && !!c.status, run: (p, c) => {
      for (const f of foesNear(p, entOf(p, c.target!.id)!.pos, r >= 2 ? 2 : 1)) if (f !== c.target) applyStatus(p, c.src, f, c.status!, c.t, c.ev, 1, true);
    } }),
  }, '2칸'),
  card('combust', '연소 폭발', 'law', ['화염'], 'mage', '화상 걸린 적이 죽음 → 폭발 (최대체력 25% 피해, 화상 전이)', {
    trigger: (r) => ({ id: '연소 폭발', when: 'kill', repeat: r >= 2, test: (_p, c) => !!c.target && (c.target.status.burn?.until ?? 0) > c.t, run: (p, c) => {
      const t = c.target!, e = entOf(p, t.id)!;
      for (const f of foesNear(p, e.pos, 1)) if (f !== t) { damage(p, c.t, c.src.id, f, Math.round(e.maxHp * 0.25), c.ev, true); applyStatus(p, c.src, f, 'burn', c.t, c.ev, 1, true); }
    } }),
  }, '폭발로 죽은 적도 폭발'),
  card('frostPrison', '서리 감옥', 'law', ['냉기'], 'mage', '냉기 두 번 → 빙결', {
    trigger: (r) => ({ id: '서리 감옥', when: 'statusApplied', test: (_p, c) => c.status === 'chill' && !!c.target, run: (p, c) => {
      const t = c.target!; t.chillHits = (t.chillHits ?? 0) + 1;
      if (t.chillHits < 2) return;
      t.chillHits = 0; applyStatus(p, c.src, t, 'freeze', c.t, c.ev);
      if (r >= 2) for (const f of foesNear(p, posOf(p, t), 1)) if (f !== t) applyStatus(p, c.src, f, 'chill', c.t, c.ev, 1, true);
    } }),
  }, '빙결 시 주변 냉기'),
  card('arcChain', '번개 사슬', 'law', ['전기'], 'mage', '감전 튐 → 한 번 더 튐', {}, '두 번째 튐 피해 ×1.5'),
  card('manaBack', '마력 역류', 'convert', ['생존'], 'mage', '피격 → 받은 피해 30%만큼 보호막', {
    trigger: () => ({ id: '마력 역류', when: 'struck', test: (_p, c) => (c.amount ?? 0) > 0, run: (_p, c) => addShield(c.src, (c.amount ?? 0) * 0.3, c.src) }),
  }),
  card('overload', '원소 과부하', 'convert', ['화염', '냉기', '전기'], 'mage', '궁극기 → 3칸 안 적에게 화상·냉기·감전', {
    trigger: () => ({ id: '원소 과부하', when: 'ultimate', run: (p, c) => { for (const f of foesNear(p, posOf(p, c.src), 3)) for (const id of ELEMENTS) if (alive(p, f)) applyStatus(p, c.src, f, id, c.t, c.ev); } }),
  }),
  card('reactAmp', '반응 증폭', 'amp', ['화염', '냉기', '전기'], 'mage', '가진 원소 태그 종류 1당 반응 피해 +40%', {
    passive: (u) => { const t = tagsOf(u); return { react: 0.4 * (['화염', '냉기', '전기'] as const).filter((k) => (t[k] ?? 0) > 0).length }; },
  }),
];

export const RANGED_CARDS: TraitDef[] = [...ARCHER, ...MAGE];
