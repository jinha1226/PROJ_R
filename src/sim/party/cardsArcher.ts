import { applyStatus } from './status';
import { alive, canHit, damage, freeHit, levelDmg, posOf, stats, type Party, type Unit } from './partyCore';
import { foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { beyond } from './cardsRanged';
import { ampBase, card, inBranch, rank, type TraitDef } from './traitTypes';
import { dist, type Cell, type GEvent } from '../grid/types';
import type { DamageKind } from './partyCore';
import type { TriggerDef } from './triggers';

const VOLLEY = 'archer:volley', ELEMENT = 'archer:element', PRECISION = 'archer:precision';
const ranged = (p: Party, u: Unit) => stats(u, 0, p).range > 1;
const marked = (u: Unit | undefined, t: number) => !!u && (u.status.mark?.until ?? 0) > t;
const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return ((lo + hi) / 2) * levelDmg(u); };
const nearest = (p: Party, at: Cell, r: number, not?: Unit) => foesNear(p, at, r).filter((f) => f !== not).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at))[0];
/** an arrow loosed by an effect: a hit (free) at a share of the archer's blow, marking what it hits when asked */
const arrow = (p: Party, u: Unit, f: Unit, share: number, t: number, ev: GEvent[], mark = false, volley = false) => {
  // one of a volley flies with the rest off a single draw (the screen looses them together); any other arrow is a shot of its own
  ev.push({ t, type: 'shoot', src: u.id, dst: f.id, from: { ...posOf(p, u) }, to: { ...posOf(p, f) }, text: volley ? 'volley' : 'bow' });
  freeHit(p, u, f, Math.max(1, Math.round(avg(p, u, t) * share)), 'physical', t, ev);
  if (mark && alive(p, f)) applyStatus(p, u, f, 'mark', t, ev);
};

/** Element archer mastery: fire and cold damage ×1.12 per #화염 and #냉기 (multiplied). */
export function elementShooterAmp(attacker: Unit, kind: DamageKind): number {
  if (!rank(attacker, 'elementShooter') || (kind !== 'fire' && kind !== 'cold')) return 1;
  const tags = tagsOf(attacker);
  return ampBase(attacker, 'elementShooter', 1.12) ** ((tags.화염 ?? 0) + (tags.냉기 ?? 0));
}

export const ARCHER_CARDS: TraitDef[] = [
  // 다중 사격: a marked foe's death sets off a volley that marks everything it hits
  inBranch(card('multiShot', '다중 사격', 'law', ['원거리'], 'archer', '표식된 적이 죽음 → 난사 2턴: 모든 사격이 4칸 안 모든 적에게(맞은 적 표식), 난사 중 처치마다 +1턴(최대 6)', {
    triggers: (r) => [
      { id: '난사', when: 'kill', repeat: true, test: (_p, c) => (c.src.volleyUntil ?? 0) > c.t || marked(c.target, c.t), run: (p, c) => {
        if ((c.src.volleyUntil ?? 0) <= c.t) { c.src.volleyUntil = c.t + 2; return; }
        c.src.volleyUntil = Math.min(c.src.volleyUntil! + 1, c.t + 6);
        // rank 3: a kill in the volley looses one more arrow at the nearest foe
        const next = r >= 3 && c.target ? nearest(p, posOf(p, c.target), 8, c.target) : undefined;
        if (next) arrow(p, c.src, next, 0.6, c.t, c.ev);
      } },
      { id: '다중 사격', when: 'hit', test: (p, c) => !!c.basic && (c.src.volleyUntil ?? 0) > c.t && ranged(p, c.src), run: (p, c) => {
        // only what the archer can see and shoot: no sleeping camps, nothing behind walls
        for (const f of foesNear(p, posOf(p, c.src), r >= 2 ? 6 : 4)) if (f !== c.target && !f.asleep && canHit(p, c.src, f, r >= 2 ? 6 : 4)) arrow(p, c.src, f, 0.6, c.t, c.ev, true, true);
      } },
    ],
  }, '6칸', '난사 중 처치 → 가장 가까운 적에게 화살 한 발 더'), VOLLEY, true),
  inBranch(card('huntMark', '사냥 표식', 'law', ['원거리'], 'archer', '전투 첫 사격 → 표식', {
    triggers: (r) => [
      { id: '사냥 표식', when: 'combatStart', run: (_p, c) => { c.src.markFirst = true; } },
      { id: '사냥 표식', when: 'beforeHit', test: (p, c) => !!c.src.markFirst && !!c.target && ranged(p, c.src), run: (p, c) => {
        c.src.markFirst = false; applyStatus(p, c.src, c.target!, 'mark', c.t, c.ev);
        const second = r >= 3 ? nearest(p, posOf(p, c.target!), 4, c.target) : undefined;
        if (second) applyStatus(p, c.src, second, 'mark', c.t, c.ev);
      } },
      ...(r >= 2 ? [{ id: '표식 이동', when: 'kill', test: (_p, c) => marked(c.target, c.t), run: (p, c) => {
        const next = nearest(p, posOf(p, c.target!), 8, c.target); if (next) applyStatus(p, c.src, next, 'mark', c.t, c.ev);
      } } satisfies TriggerDef] : []),
    ],
  }, '표식된 적이 죽으면 가까운 적에게 표식 이동', '전투 첫 사격 → 2명 표식'), VOLLEY),
  inBranch(card('hunterInstinct', '사냥꾼의 직감', 'convert', ['원거리'], 'archer', '표식된 적 처치 → 다음 사격 치명', {
    trigger: (r) => ({ id: '사냥꾼의 직감', when: 'kill', test: (_p, c) => marked(c.target, c.t), run: (_p, c) => { c.src.nextCrit = true; if (r >= 2) c.src.critShots = Math.max(c.src.critShots ?? 0, 1); } }),
  }, '다음 2발 치명'), VOLLEY),
  inBranch(card('hunterEye', '사냥꾼의 눈', 'amp', ['원거리'], 'archer', '#원거리 1당 표식 피해 ×1.1 (곱)', {}, '×1.14'), VOLLEY),
  // 원소 화살: every arrow bursts; steady aim freezes
  inBranch(card('explosiveArrow', '폭발 화살', 'law', ['화염'], 'archer', '모든 화살이 대상 주변 1칸 화염 폭발·화상', {
    trigger: (r) => ({ id: '폭발 화살', when: 'hit', test: (p, c) => !!c.basic && !!c.target && ranged(p, c.src), run: (p, c) => {
      const at = { ...posOf(p, c.target!) }, amount = Math.max(1, Math.round(avg(p, c.src, c.t) * 0.5));
      for (const f of foesNear(p, at, r >= 2 ? 2 : 1)) {
        damage(p, c.t, c.src.id, f, amount, c.ev, true, false, 'fire');
        if (alive(p, f)) applyStatus(p, c.src, f, 'burn', c.t, c.ev);
        // rank 3: what the burst kills leaves burning ground
        else if (r >= 3) (p.grounds ??= []).push({ at: { ...posOf(p, f) }, by: c.src.id, until: c.t + 2, next: c.t + 1, kind: 'burn', r: 1 });
      }
    } }),
  }, '반경 2', '폭발로 처치 → 2턴 불바닥'), ELEMENT, true),
  inBranch(card('freezeArrow', '빙결 화살', 'law', ['냉기'], 'archer', '정조준 3 이상 사격 → 대상과 주변 1칸 빙결', {
    triggers: (r) => [
      { id: '빙결 화살', when: 'hit', test: (p, c) => !!c.basic && !!c.target && (c.src.steady ?? 0) >= 3 && ranged(p, c.src), run: (p, c) => {
        for (const f of foesNear(p, posOf(p, c.target!), r >= 2 ? 2 : 1)) applyStatus(p, c.src, f, 'freeze', c.t, c.ev);
      } },
      // rank 3: an arrow on a frozen foe shatters it (twice the blow)
      ...(r >= 3 ? [{ id: '파쇄 화살', when: 'beforeHit', test: (p, c) => !!c.target && (c.target.status.freeze?.until ?? 0) > c.t && ranged(p, c.src), run: (_p, c) => {
        c.src.attackMult = (c.src.attackMult ?? 1) * 2; delete c.target!.status.freeze;
      } } satisfies TriggerDef] : []),
    ],
  }, '범위 2', '얼린 적을 다음 화살이 맞힘 → 파쇄(2배)'), ELEMENT),
  inBranch(card('elementMesh', '원소 맞물림', 'convert', ['화염', '냉기'], 'archer', '반응 피해 2배', { passive: (_u, r) => ({ react: r >= 2 ? 2 : 1 }) }, '반응 피해 3배'), ELEMENT),
  inBranch(card('elementShooter', '원소 사수', 'amp', ['화염', '냉기'], 'archer', '#화염·#냉기 1당 화염·냉기 피해 ×1.12 (곱)', {}, '×1.16'), ELEMENT),
  // 정밀: arrows that run on through, and a miss that is not wasted
  inBranch(card('pierce', '관통 화살', 'law', ['치명'], 'archer', '모든 화살이 뒤의 적 1명 관통, 관통한 적마다 다음 화살 +10%(최대 +50%, 빗나가면 초기화)', {
    triggers: (r) => [
      { id: '관통 화살', when: 'hit', test: (p, c) => !!c.basic && !!c.target && ranged(p, c.src), run: (p, c) => {
        const line = beyond(p, c.src, c.target!), hit = r >= 2 ? line : line.slice(0, 1);
        for (const f of hit) arrow(p, c.src, f, 0.7, c.t, c.ev);
        c.src.pierceStack = Math.min(5, (c.src.pierceStack ?? 0) + hit.length);
        // rank 3: one arrow through three foes makes the next critical
        if (r >= 3 && hit.length + 1 >= 3) c.src.nextCrit = true;
      } },
      { id: '관통 가속', when: 'beforeHit', test: (_p, c) => (c.src.pierceStack ?? 0) > 0, run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * (1 + 0.1 * c.src.pierceStack!); } },
      { id: '관통 초기화', when: 'miss', test: (_p, c) => (c.src.pierceStack ?? 0) > 0, run: (_p, c) => { c.src.pierceStack = 0; } },
    ],
  }, '직선 위 모든 적', '한 화살로 3명 이상 → 다음 화살 치명'), PRECISION, true),
  inBranch(card('homing', '유도 화살', 'law', ['치명'], 'archer', '빗나감 → 가장 가까운 다른 적에게 휘어 감', {
    trigger: (r) => ({ id: '유도 화살', when: 'miss', test: (p, c) => !!c.basic && !!c.target && ranged(p, c.src), run: (p, c) => {
      const next = nearest(p, posOf(p, c.target!), 4, c.target);
      if (next) arrow(p, c.src, next, r >= 2 ? 1.5 : 1, c.t, c.ev, r >= 3);
    } }),
  }, '치명(×1.5)', '휘어 간 화살이 표식'), PRECISION),
  inBranch(card('exposeWeakness', '약점 노출', 'convert', ['치명'], 'archer', '치명 → 대상 2턴 노출', {
    trigger: (r) => ({ id: '약점 노출', when: 'crit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => {
      for (const f of r >= 2 ? foesNear(p, posOf(p, c.target!), 1) : [c.target!]) applyStatus(p, c.src, f, 'exposed', c.t, c.ev);
    } }),
  }, '주변 1칸도'), PRECISION),
  inBranch(card('focusFire', '집중 사격', 'amp', ['치명'], 'archer', '제자리 연속 사격마다 치명 +10%(최대 +40%)', { passive: (u, r) => ({ crit: (r >= 2 ? 0.12 : 0.1) * Math.min(r >= 2 ? 5 : 4, u.still) }) }, '사격마다 +12%(최대 +60%)'), PRECISION),
];
