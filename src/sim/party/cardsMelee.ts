import { applyStatus } from './status';
import { alive, damage, entOf, posOf, stats } from './partyCore';
import { foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { card, type TraitDef } from './traitTypes';
import type { TriggerDef as TriggerDef_ } from './triggers';

const meleeFoe = (p: Parameters<typeof stats>[2], u: Parameters<typeof stats>[0] | undefined) => !!u && stats(u, 0, p).range <= 1;
/** the battle cry's upgrade: a taunted foe that strikes the warrior is left exposed */
const taunted: TriggerDef_ = { id: '도발 응징', when: 'struck', test: (_p, c) => !!c.target && c.target.tauntBy === c.src.id, run: (p, c) => applyStatus(p, c.src, c.target!, 'exposed', c.t, c.ev) };

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

export const MELEE_CARDS: TraitDef[] = WARRIOR;
