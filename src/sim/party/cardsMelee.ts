import { applyStatus, type StatusId } from './status';
import { alive, damage, entOf, posOf, stats, strike, targetOf } from './partyCore';
import { foesNear, stepBehind } from './cardFx';
import { tagsOf } from './classKit';
import { duoFor } from './cardsSupport';
import { card, rank, type TraitDef } from './traitTypes';
import { dist } from '../grid/types';
import type { TriggerDef as TriggerDef_ } from './triggers';

const meleeFoe = (p: Parameters<typeof stats>[2], u: Parameters<typeof stats>[0] | undefined) => !!u && stats(u, 0, p).range <= 1;
/** the battle cry's upgrade: a taunted foe that strikes the warrior is left exposed */
const taunted: TriggerDef_ = { id: '도발 응징', when: 'struck', test: (_p, c) => !!c.target && c.target.tauntBy === c.src.id, run: (p, c) => applyStatus(p, c.src, c.target!, 'exposed', c.t, c.ev) };
const live = (u: { status: Partial<Record<StatusId, { until: number }>> }, t: number) => Object.values(u.status).filter((s) => (s?.until ?? 0) > t).length;

/** The warrior's cards (spec §6.2): hit back what hits it. */
const WARRIOR: TraitDef[] = [
  card('thorns', '가시 갑옷', 'law', ['방패'], 'warrior', '근접 피격 → 받은 피해 50% 반사', {
    trigger: (r) => ({ id: '가시 갑옷', when: 'struck', test: (p, c) => meleeFoe(p, c.target) && (c.amount ?? 0) > 0, run: (p, c) => damage(p, c.t, c.src.id, c.target!, Math.round((c.amount ?? 0) * (r >= 2 ? 1 : 0.5)), c.ev, true) }),
  }, '반사 100%'),
  card('rage', '분노 축적', 'law', ['근접'], 'warrior', '피격마다 분노 1 (최대 5) → 다음 공격에 분노 × 30% 추가 피해', {
    triggers: (r) => [
      { id: '분노 축적', when: 'struck', run: (_p, c) => { c.src.rage = Math.min(5, (c.src.rage ?? 0) + 1); } },
      { id: '분노 폭발', when: 'beforeHit', test: (_p, c) => (c.src.rage ?? 0) > 0 && !!c.target, run: (p, c) => {
        const n = c.src.rage!; c.src.attackMult = (c.src.attackMult ?? 1) * (1 + 0.3 * n); c.src.rage = 0;
        if (r >= 2) for (const f of foesNear(p, posOf(p, c.target!), 1)) if (f !== c.target) damage(p, c.t, c.src.id, f, n * 4, c.ev, true);
      } },
    ],
  }, '분노가 터질 때 주변 1칸 적에게도 분노 × 4 피해'),
  card('quake', '땅 울림', 'law', ['근접'], 'warrior', '한 번에 체력 20% 이상 잃음 → 붙은 적 기절', {
    trigger: (r) => ({ id: '땅 울림', when: 'struck', test: (p, c) => (c.amount ?? 0) >= entOf(p, c.src.id)!.maxHp * 0.2, run: (p, c) => {
      for (const f of foesNear(p, posOf(p, c.src), 1)) { applyStatus(p, c.src, f, 'stun', c.t, c.ev); if (r >= 2) applyStatus(p, c.src, f, 'exposed', c.t, c.ev); }
    } }),
  }, '기절한 적 노출'),
  card('battleCry', '도발 함성', 'law', ['생존'], 'warrior', '전투 시작 → 3칸 안 적 2턴 도발', {
    triggers: (r) => [
      { id: '도발 함성', when: 'combatStart', run: (p, c) => { for (const f of foesNear(p, posOf(p, c.src), 3)) { f.tauntUntil = c.t + 2; f.tauntBy = c.src.id; } } },
      ...(r >= 2 ? [taunted] : []),
    ],
  }, '도발된 적이 전사를 치면 노출'),
  // the negation itself happens before the blow lands (traitCombat.negate), so it can stop a killing blow
  card('lastStand', '최후의 버팀', 'law', ['생존'], 'warrior', '위기 중 피격 20% → 피해 무효 + 반격', {}, '확률 35%'),
  card('bloodPrice', '피의 대가', 'convert', ['출혈'], 'warrior', '받은 피해 30% → 다음 공격 피해에 더함', {
    trigger: () => ({ id: '피의 대가', when: 'struck', test: (_p, c) => (c.amount ?? 0) > 0, run: (_p, c) => { c.src.nextFlat = (c.src.nextFlat ?? 0) + Math.round((c.amount ?? 0) * 0.3); } }),
  }),
  card('ironCounter', '철벽 반격', 'convert', ['방패'], 'warrior', '반격 피해 +50%, 반격 25% → 기절', {
    passive: () => ({ counter: 0.5 }),
    trigger: () => ({ id: '철벽 반격', when: 'counter', chance: 0.25, test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'stun', c.t, c.ev) }),
  }),
  card('steadfast', '굳건함', 'amp', ['방패'], 'warrior', '#방패 1당 받는 피해 -5%', { passive: (u) => ({ taken: -0.05 * (tagsOf(u).방패 ?? 0) }) }),
];

/** The rogue's cards (spec §6.6): feed on what ails the foe. */
const ROGUE: TraitDef[] = [
  card('vitals', '급소 찌르기', 'law', ['치명'], 'rogue', '적의 상태 1개당 피해 +25%', {
    trigger: (r) => ({ id: '급소 찌르기', when: 'beforeHit', test: (_p, c) => !!c.target && live(c.target, c.t) > 0, run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * (1 + (r >= 2 ? 0.4 : 0.25) * live(c.target!, c.t)); } }),
  }, '1개당 +40%'),
  card('execute', '처형', 'law', ['치명'], 'rogue', '체력 25% 미만 적 즉사 (우두머리는 피해 2배)', {
    trigger: (r) => ({ id: '처형', when: 'beforeHit', test: (p, c) => !!c.target && entOf(p, c.target.id)!.hp < entOf(p, c.target.id)!.maxHp * (r >= 2 ? 0.35 : 0.25), run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * (c.target!.foe === 'warlord' ? 2 : 99); } }),
  }, '기준 35%'),
  card('openWounds', '상처 벌리기', 'law', ['출혈'], 'rogue', '적중 → 출혈 중첩 (최대 5)', {
    trigger: () => ({ id: '상처 벌리기', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'bleed', c.t, c.ev) }),
  }, '최대 8중첩'),
  card('envenom', '독 바르기', 'law', ['독'], 'rogue', '적중 → 중독 1중첩', {
    trigger: (r) => ({ id: '독 바르기', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'poison', c.t, c.ev, r >= 2 ? 2 : 1) }),
  }, '2중첩'),
  card('shadowStep', '그림자 걸음', 'law', ['은신'], 'rogue', '처치 → 은신, 가장 가까운 적 곁으로 순간이동', {
    trigger: (r) => ({ id: '그림자 걸음', when: 'kill', run: (p, c) => {
      c.src.hiddenUntil = Math.max(c.src.hiddenUntil, c.t + 1);
      const me = posOf(p, c.src), next = p.units.filter((f) => f.side === 'foe' && alive(p, f)).sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
      if (next && stepBehind(p, c.src, next, c.t, c.ev) && r >= 2) strike(p, c.src, next, c.t, c.ev, 1, false);
    } }),
  }, '순간이동 후 바로 공격'),
  card('betrayal', '배신의 칼날', 'law', ['협공'], 'rogue', '다른 아군을 노리는 적을 침 → 1턴 기절 (같은 적 3턴 대기)', {
    trigger: (r) => ({ id: '배신의 칼날', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target) && targetOf(p, c.target, c.t)?.id !== c.src.id && c.t - (c.target.betrayedAt ?? -99) >= (r >= 2 ? 0 : 3),
      run: (p, c) => { c.target!.betrayedAt = c.t; applyStatus(p, c.src, c.target!, 'stun', c.t, c.ev); } }),
  }, '대기 없음'),
  card('toxicBurst', '독 폭발', 'convert', ['독'], 'rogue', '중독 5중첩 → 모두 터뜨려 즉시 피해, 주변에 중독 2', {
    trigger: () => ({ id: '독 폭발', when: 'statusApplied', test: (_p, c) => c.status === 'poison' && (c.target?.status.poison?.stacks ?? 0) >= 5, run: (p, c) => {
      const t = c.target!, n = t.status.poison!.stacks ?? 5; delete t.status.poison;
      damage(p, c.t, c.src.id, t, 6 * n, c.ev, true);
      for (const f of foesNear(p, posOf(p, t), 1)) if (f !== t) { applyStatus(p, c.src, f, 'poison', c.t, c.ev, 2, true); if (duoFor(p, c.src, 'toxicSmoke')) applyStatus(p, c.src, f, 'burn', c.t, c.ev); }
    } }),
  }),
  card('ambushArt', '기습', 'amp', ['은신'], 'rogue', '은신 중 공격 피해 × (1 + #은신 × 0.5)', {}),
];

export const MELEE_CARDS: TraitDef[] = [...WARRIOR, ...ROGUE];
/** how deep open wounds let bleeding stack for this clone (1 without the card) */
export const bleedCap = (u: Parameters<typeof rank>[0]): number => (rank(u, 'openWounds') >= 2 ? 8 : rank(u, 'openWounds') ? 5 : 1);
