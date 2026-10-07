import { applyStatus } from './status';
import { alive, damage, entOf, posOf, stats, type Party, type Unit } from './partyCore';
import { foesNear } from './cardFx';
import { heal } from './kitEffects';
import { linesOf } from './body';
import { consume, isCorpse } from './corpses';
import { card, rank, type TraitDef } from './traitTypes';
import type { BaseClass } from './partyDefs';
import type { TriggerDef } from './triggers';

const on = (u: Unit | undefined, id: 'freeze' | 'stun' | 'mark' | 'bleed', t: number) => !!u && (u.status[id]?.until ?? 0) > t;

const duo = (id: string, name: string, pair: [BaseClass, BaseClass], who: BaseClass | 'any', tags: TraitDef['tags'], text: string, trigger?: TriggerDef): TraitDef =>
  ({ ...card(id, name, 'duo', tags, 'duo', text, trigger ? { trigger: () => trigger } : {}), duo: pair, who });

/** The combo cards (spec §4): one for each pair of the six soul classes, offered and working only in a body holding both. */
const COMBOS: TraitDef[] = [
  duo('shatterDuo', '산산조각', ['warrior', 'mage'], 'warrior', ['냉기'], '빙결된 적을 근접으로 침 → 파쇄, 곁에 냉기',
    { id: '산산조각', when: 'beforeHit', test: (p, c) => on(c.target, 'freeze', c.t) && stats(c.src, c.t, p).range <= 1, run: (p, c) => {
      c.src.attackMult = (c.src.attackMult ?? 1) * 2; delete c.target!.status.freeze;
      for (const f of foesNear(p, posOf(p, c.target!), 1)) if (f !== c.target) applyStatus(p, c.src, f, 'chill', c.t, c.ev, 1, true);
    } }),
  duo('bait', '미끼와 사냥꾼', ['warrior', 'archer'], 'warrior', ['원거리'], '나를 친 적 → 표식',
    { id: '미끼와 사냥꾼', when: 'struck', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'mark', c.t, c.ev) }),
  // the counter doubling itself is in cardFx.counter
  duo('holyShield', '성스러운 방패', ['warrior', 'cleric'], 'warrior', ['방패'], '보호막이 있으면 반격 2배, 깨지면 분노 최대',
    { id: '성스러운 방패', when: 'shieldBreak', run: (_p, c) => { c.src.rage = 5; } }),
  duo('gap', '틈새', ['warrior', 'rogue'], 'any', ['치명'], '기절한 적 → 치명',
    { id: '틈새', when: 'beforeHit', test: (_p, c) => on(c.target, 'stun', c.t), run: (_p, c) => { c.src.nextCrit = true; } }),
  duo('bloodOffering', '피의 제물', ['warrior', 'necromancer'], 'any', ['출혈', '뼈'], '회오리 베기로 죽은 적의 시체가 즉시 폭발',
    { id: '피의 제물', when: 'kill', repeat: true, test: (p, c) => !!c.src.whirling && !!c.target && isCorpse(p, c.target), run: (p, c) => {
      const body = c.target!, at = posOf(p, body), amount = Math.max(1, Math.round(entOf(p, body.id)!.maxHp * 0.3));
      consume(body);
      for (const f of foesNear(p, at, 1)) damage(p, c.t, c.src.id, f, amount, c.ev, true, false, 'bone');
    } }),
  duo('elemArrow', '원소 화살', ['archer', 'mage'], 'any', ['원거리'], '표식된 적이 원소 반응 → 곁의 적에게 표식',
    { id: '원소 화살', when: 'reaction', test: (_p, c) => on(c.target, 'mark', c.t), run: (p, c) => { for (const f of foesNear(p, entOf(p, c.target!.id)!.pos, 1)) if (f !== c.target) applyStatus(p, c.src, f, 'mark', c.t, c.ev); } }),
  duo('purifyFlame', '정화의 불꽃', ['mage', 'cleric'], 'any', ['화염'], '넘친 치유 → 곁의 적에게 화상',
    { id: '정화의 불꽃', when: 'overflow', test: (_p, c) => !!c.target, run: (p, c) => { for (const f of foesNear(p, posOf(p, c.target!), 1)) applyStatus(p, c.src, f, 'burn', c.t, c.ev); } }),
  // the element itself is laid where the snare goes off (snares.ts)
  duo('elemTrap', '원소 함정', ['mage', 'rogue'], 'any', ['함정'], '함정이 터짐 → 원소 순환의 다음 원소 부여'),
  duo('iceCorpse', '얼음 시체', ['mage', 'necromancer'], 'any', ['냉기', '뼈'], '빙결된 적이 죽음 → 냉기 폭발(주변 1칸 빙결)',
    { id: '얼음 시체', when: 'kill', repeat: true, test: (_p, c) => !!c.target && on(c.target, 'freeze', c.t), run: (p, c) => {
      for (const f of foesNear(p, posOf(p, c.target!), 1)) applyStatus(p, c.src, f, 'freeze', c.t, c.ev);
    } }),
  duo('lightArrow', '빛의 화살', ['archer', 'cleric'], 'any', ['신성'], '표식된 적 적중 → 체력 4 회복',
    { id: '빛의 화살', when: 'hit', test: (_p, c) => on(c.target, 'mark', c.t), run: (p, c) => heal(p, c.src, c.src, 4, c.t, c.ev) }),
  duo('prey', '사냥감', ['archer', 'rogue'], 'any', ['치명'], '표식된 체력 40% 미만 적 → 피해 2배',
    { id: '사냥감', when: 'beforeHit', test: (p, c) => on(c.target, 'mark', c.t) && entOf(p, c.target!.id)!.hp < entOf(p, c.target!.id)!.maxHp * 0.4, run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 2; } }),
  // the second spear itself is thrown in cardsNecro.spear
  duo('boneArrow', '뼈 화살', ['archer', 'necromancer'], 'any', ['뼈'], '뼈 창이 표식된 적을 지남 → 그 적에게서 뼈 창 하나 더'),
  duo('bloodFeast', '피의 성찬', ['cleric', 'rogue'], 'any', ['출혈'], '출혈 중인 적 적중 → 체력 3 회복',
    { id: '피의 성찬', when: 'hit', test: (_p, c) => on(c.target, 'bleed', c.t), run: (p, c) => heal(p, c.src, c.src, 3, c.t, c.ev) }),
  // the shield itself is given by the corpse explosion (classKit, the necromancer's innate)
  duo('lifeCycle', '생명의 순환', ['cleric', 'necromancer'], 'any', ['방패', '뼈'], '시체 폭발마다 보호막 3'),
  // the poison cloud itself is left where the snare goes off (snares.ts)
  duo('poisonTrap', '독 함정', ['rogue', 'necromancer'], 'any', ['함정', '독'], '함정이 시체 곁에서 터짐 → 독구름(반경 2, 2턴)'),
];

export const COMBO_CARDS: TraitDef[] = COMBOS;
const COMBO_BY_ID = new Map(COMBOS.map((d) => [d.id, d]));

/** A combo works in a body that holds it and both its classes' souls. */
export function duoActive(u: Unit, id: string): boolean {
  const d = COMBO_BY_ID.get(id);
  return !!d?.duo && rank(u, id) > 0 && d.duo.every((c) => linesOf(u).includes(c));
}
/** Whether a combo is in play for this clone. */
export const duoFor = (_p: Party, u: Unit, id: string): boolean => duoActive(u, id);
/** The triggers of the combos in play in this body. */
export function duoTriggers(p: Party, u: Unit): TriggerDef[] {
  if (u.side !== 'hero' || u.summoner) return [];
  return COMBOS.filter((d) => d.trigger && duoFor(p, u, d.id)).map((d) => d.trigger!(1));
}
