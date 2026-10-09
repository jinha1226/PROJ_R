import { applyStatus } from './status';
import { addShield } from './shield';
import { heal, nearby } from './kitEffects';
import { alive, entOf, posOf, strike } from './partyCore';
import { counter, foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { card, type TraitDef } from './traitTypes';

/** The common cards (spec §6.1): anyone can draw them. */
export const COMMON_CARDS: TraitDef[] = [
  card('finish', '마무리', 'law', ['치명'], 'common', '처치 → 다음 공격 피해 2배', {
    trigger: (r) => ({ id: '마무리', when: 'kill', run: (_p, c) => { c.src.empower = r >= 2 ? Math.min(4, Math.max(2, c.src.empower + 1)) : Math.max(c.src.empower, 2); } }),
  }, '최대 4배까지 쌓임'),
  card('combo', '연타', 'law', ['근접'], 'common', '세 번째 공격마다 → 한 번 더 공격', {
    trigger: (r) => ({ id: '연타', when: 'nth', nth: r >= 2 ? 2 : 3, run: (p, c) => { if (c.target && alive(p, c.target)) strike(p, c.src, c.target, c.t, c.ev, 1, false); } }),
  }, '두 번째 공격마다'),
  card('reflex', '반사 신경', 'law', ['생존'], 'common', '회피 → 다음 공격 치명', {
    trigger: (r) => ({ id: '반사 신경', when: 'dodge', run: (p, c) => { c.src.nextCrit = true; if (r >= 2 && c.target) counter(p, c.src, c.target, c.t, c.ev); } }),
  }, '회피하면 반격'),
  card('initiative', '선제', 'law', ['치명'], 'common', '전투 시작 → 즉시 행동, 첫 공격 치명', {
    triggers: (r) => [
      { id: '선제', when: 'combatStart', run: (_p, c) => { c.src.nextAt = c.t; c.src.nextCrit = true; if (r >= 2) c.src.critUntilKill = true; } },
      { id: '선제', when: 'beforeHit', test: (_p, c) => !!c.src.critUntilKill, run: (_p, c) => { c.src.nextCrit = true; } },
      { id: '선제', when: 'kill', test: (_p, c) => !!c.src.critUntilKill, run: (_p, c) => { c.src.critUntilKill = false; } },
    ],
  }, '첫 처치까지 모든 공격 치명'),
  card('unyielding', '불굴', 'law', ['생존'], 'common', '위기 → 보호막 최대체력 30%, 붙은 적 노출', {
    trigger: (r) => ({ id: '불굴', when: 'crisis', run: (p, c) => {
      addShield(c.src, Math.round(entOf(p, c.src.id)!.maxHp * (r >= 2 ? 0.5 : 0.3)), c.src);
      for (const f of foesNear(p, posOf(p, c.src), 1)) applyStatus(p, c.src, f, 'exposed', c.t, c.ev);
    } }),
  }, '보호막 50%'),
  card('morale', '사기', 'law', ['협공'], 'common', '처치 → 나와 2칸 안 소환수 치유 8', {
    trigger: (r) => ({ id: '사기', when: 'kill', run: (p, c) => { for (const a of nearby(p, c.src, 2)) { heal(p, c.src, a, 8, c.t, c.ev); if (r >= 2) addShield(a, 12, c.src); } } }),
  }, '보호막 12도 줌'),
  card('leap', '도약', 'law', ['생존'], 'common', '이동 후 첫 공격 → 적 노출', {
    trigger: (r) => ({ id: '도약', when: 'beforeHit', test: (_p, c) => !!c.target && !!c.src.attackMoved, run: (p, c) => applyStatus(p, c.src, c.target!, r >= 2 ? 'stun' : 'exposed', c.t, c.ev) }),
  }, '노출 대신 기절'),
  card('bloodthirst', '피의 갈증', 'convert', ['치유'], 'common', '처치 → 넘친 피해만큼 회복', {
    trigger: () => ({ id: '피의 갈증', when: 'kill', test: (_p, c) => (c.over ?? 0) > 0, run: (p, c) => heal(p, c.src, c.src, c.over!, c.t, c.ev) }),
  }),
  card('firstAid', '응급 처치', 'convert', ['치유'], 'common', '대기 → 체력 15% 회복', {
    trigger: () => ({ id: '응급 처치', when: 'wait', run: (p, c) => heal(p, c.src, c.src, entOf(p, c.src.id)!.maxHp * 0.15, c.t, c.ev) }),
  }),
  card('plunder', '약탈자', 'convert', ['생존'], 'common', '엘리트 처치 → 광석 +3', {
    trigger: () => ({ id: '약탈자', when: 'kill', test: (p) => 'ore' in p, run: (p, c) => { if (c.target && entOf(p, c.target.id)?.elite) (p as unknown as { ore: number }).ore += 3; } }),
  }),
  card('bond', '결속', 'amp', ['협공'], 'common', '2칸 안 아군(소환수·분신) 1명당 피해 ×1.15 (곱)', { passive: () => ({ bond: 0.15 }) }),
  // the critical blow's base is ×1.5: this adds what multiplies it by 1.15 per #치명
  card('cruel', '잔혹', 'amp', ['치명'], 'common', '#치명 1당 치명 피해 ×1.15 (곱)', { passive: (u) => ({ critDmg: 1.5 * (1.15 ** (tagsOf(u).치명 ?? 0) - 1) }) }),
];

const oath = (d: TraitDef, text: string): TraitDef => ({ ...d, kind: 'oath', text, ranks: 1 });
const keystone = (id: string, name: string, tags: TraitDef['tags'], cost: string, text: string, fx: Partial<TraitDef> = {}): TraitDef =>
  oath({ id, name, tags, pool: 'keystone', ranks: 1, cost, ...fx }, text);

/** The oaths (levels 10 and 14): the rules they bend live where those rules are (ultimate, damage, healing). */
export const KEYSTONE_CARDS: TraitDef[] = [
  keystone('bloodPact', '피의 계약', ['치유'], '회복 -30%', '궁극기가 대기 대신 체력 30% 소모'),
  keystone('shadowOath', '그림자 서약', ['은신'], '비은신 피해 +25%', '은신 중 턴당 체력 5% 회복, 은신 공격 3배'),
  keystone('immortal', '불사', ['생존'], '체력 -25%', '죽을 피해 → 3턴 무적 (전투당 1회)', { passive: () => ({ hp: -0.25 }) }),
  keystone('fanatic', '광신', ['생존'], '이동 -20%', '모든 발동 대기시간 절반', { passive: () => ({ move: -0.2 }) }),
  keystone('avatar', '원소의 화신', ['화염', '냉기', '전기'], '치명 불가', '적중 → 무작위 원소 부여', {
    trigger: () => ({ id: '원소의 화신', when: 'hit', run: (p, c) => { if (c.target) applyStatus(p, c.src, c.target, p.s.rng.pick(['burn', 'chill', 'shock']), c.t, c.ev); } }),
  }),
  keystone('loneWolf', '고독한 늑대', ['근접'], '협공 무효', '2칸 안 아군 없으면 피해 +60%'),
];
